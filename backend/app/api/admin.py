"""Admin analytics — registered businesses, their usage/logs, and SaaS growth."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agents.progress import build_progress
from app.api.deps import require_admin
from app.db import get_db
from app.models.tables import PipelineRun, Seller, Submission
from app.schemas.billing import (
    BusinessDetail,
    BusinessRow,
    GrowthMetrics,
    SellerLogEntry,
)
from app.services.tokens import tokens_used_for_seller

router = APIRouter(prefix="/admin", tags=["admin"])


def _business_row(db: Session, seller: Seller) -> BusinessRow:
    subs = db.scalars(select(Submission).where(Submission.seller_id == seller.id)).all()
    published = sum(1 for s in subs if s.status in ("awaiting_review", "published"))
    return BusinessRow(
        id=seller.id,
        name=seller.name,
        email=seller.email,
        is_admin=seller.is_admin,
        created_at=seller.created_at,
        submissions=len(subs),
        published=published,
        tokens_used=tokens_used_for_seller(db, seller.id),
        token_limit=seller.token_limit,
    )


@router.get("/sellers", response_model=list[BusinessRow])
def list_businesses(_: Seller = Depends(require_admin), db: Session = Depends(get_db)) -> list[BusinessRow]:
    sellers = db.scalars(select(Seller).order_by(Seller.created_at.desc())).all()
    return [_business_row(db, s) for s in sellers]


@router.get("/sellers/{seller_id}", response_model=BusinessDetail)
def business_detail(
    seller_id: str, _: Seller = Depends(require_admin), db: Session = Depends(get_db)
) -> BusinessDetail:
    seller = db.get(Seller, seller_id)
    if seller is None:
        raise HTTPException(status_code=404, detail="Business not found")

    subs = db.scalars(
        select(Submission)
        .where(Submission.seller_id == seller_id)
        .order_by(Submission.created_at.desc())
    ).all()

    logs: list[SellerLogEntry] = []
    for sub in subs[:50]:
        run = db.scalar(
            select(PipelineRun)
            .where(PipelineRun.submission_id == sub.id)
            .order_by(PipelineRun.created_at.desc())
        )
        prog = build_progress(run)
        logs.append(
            SellerLogEntry(
                submission_id=sub.id,
                title=sub.title,
                status=sub.status,
                stage=prog["current"],
                tokens=prog["tokens"],
                created_at=sub.created_at,
            )
        )
    return BusinessDetail(business=_business_row(db, seller), logs=logs)


def _daily_counts(db: Session, model_date_col, days: int = 14) -> list[dict]:
    """Per-day row counts, bucketed in Python so the result never depends on the
    DB's ``date()`` semantics or tz serialisation (the old ``func.date`` +
    ``.label('d')`` approach silently returned empties — the charts were blank)."""
    base = datetime.now(timezone.utc).date()
    since = datetime.now(timezone.utc) - timedelta(days=days - 1)
    by_day: dict[str, int] = {}
    for (created_at,) in db.execute(select(model_date_col).where(model_date_col >= since)).all():
        if created_at is None:
            continue
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        key = created_at.astimezone(timezone.utc).date().isoformat()
        by_day[key] = by_day.get(key, 0) + 1
    return [
        {"date": (base - timedelta(days=i)).isoformat(), "count": by_day.get((base - timedelta(days=i)).isoformat(), 0)}
        for i in range(days - 1, -1, -1)
    ]


@router.get("/growth", response_model=GrowthMetrics)
def growth(_: Seller = Depends(require_admin), db: Session = Depends(get_db)) -> GrowthMetrics:
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    total_sellers = db.scalar(select(func.count(Seller.id)).where(Seller.is_admin.is_(False))) or 0
    new_7d = (
        db.scalar(
            select(func.count(Seller.id)).where(
                Seller.is_admin.is_(False), Seller.created_at >= week_ago
            )
        )
        or 0
    )
    total_subs = db.scalar(select(func.count(Submission.id))) or 0
    total_published = (
        db.scalar(
            select(func.count(Submission.id)).where(
                Submission.status.in_(["awaiting_review", "published"])
            )
        )
        or 0
    )
    total_tokens = (
        db.scalar(
            select(
                func.coalesce(func.sum(PipelineRun.total_input_tokens), 0)
                + func.coalesce(func.sum(PipelineRun.total_output_tokens), 0)
            )
        )
        or 0
    )
    return GrowthMetrics(
        total_sellers=int(total_sellers),
        new_sellers_7d=int(new_7d),
        total_submissions=int(total_subs),
        total_published=int(total_published),
        total_tokens=int(total_tokens),
        signups_daily=_daily_counts(db, Seller.created_at),
        submissions_daily=_daily_counts(db, Submission.created_at),
    )


# --------------------------------------------------------------------------- #
# System: provider config, model usage, and stored files
# --------------------------------------------------------------------------- #
@router.get("/config")
def get_config(_: Seller = Depends(require_admin)) -> dict:
    from app.services import runtime_config

    return {
        "effective": runtime_config.effective(),
        "options": {
            "llm_provider": ["openai", "bedrock"],
            "image_provider": ["openai", "gemini"],
        },
    }


@router.put("/config")
def update_config(payload: dict, _: Seller = Depends(require_admin)) -> dict:
    from app.services import runtime_config

    allowed = set(runtime_config.OVERRIDABLE)
    for key, value in payload.items():
        if key in allowed and value is not None:
            runtime_config.set(key, str(value))
    return {"effective": runtime_config.effective()}


@router.get("/usage")
def model_usage(_: Seller = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    from app.services import runtime_config
    from app.services.image_tiers import public_tiers

    total_runs = db.scalar(select(func.count(PipelineRun.id))) or 0
    total_in = db.scalar(select(func.coalesce(func.sum(PipelineRun.total_input_tokens), 0))) or 0
    total_out = db.scalar(select(func.coalesce(func.sum(PipelineRun.total_output_tokens), 0))) or 0
    from app.models.tables import Image, ImageKind

    images_generated = (
        db.scalar(select(func.count(Image.id)).where(Image.kind == ImageKind.enhanced.value)) or 0
    )
    return {
        "providers": runtime_config.effective(),
        "runs": int(total_runs),
        "input_tokens": int(total_in),
        "output_tokens": int(total_out),
        "total_tokens": int(total_in) + int(total_out),
        "images_generated": int(images_generated),
        "image_tiers": public_tiers(),
    }


@router.get("/files")
def list_files(
    prefix: str = "", limit: int = 100, _: Seller = Depends(require_admin)
) -> dict:
    from app.services.storage import get_storage

    storage = get_storage()
    if not hasattr(storage, "list_objects"):
        return {"files": [], "backend": "unknown"}
    files = storage.list_objects(prefix=prefix, limit=limit)
    # Attach a viewable URL: presigned for S3, the images API for local.
    for f in files:
        if hasattr(storage, "presigned_url"):
            try:
                f["url"] = storage.presigned_url(f["key"], 900)
            except Exception:  # noqa: BLE001
                f["url"] = None
    return {"files": files, "backend": "s3" if hasattr(storage, "presigned_url") else "local"}


@router.delete("/files")
def delete_file(payload: dict, _: Seller = Depends(require_admin)) -> dict:
    from app.services.storage import get_storage

    key = (payload.get("key") or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="key is required")
    get_storage().delete(key)
    return {"deleted": key}
