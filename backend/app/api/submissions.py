"""Submission intake + status: create (with images + customization), list, detail."""

import json
import logging

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.progress import build_progress
from app.agents.trigger import trigger_pipeline
from app.api.deps import get_current_user
from app.db import get_db
from app.models.tables import Image, ImageKind, PipelineRun, Product, Seller, Submission
from app.schemas.catalog import (
    ImageOut,
    SubmissionDetail,
    SubmissionListItem,
    SubmissionOut,
)
from app.services.storage import get_storage
from app.services.tokens import tokens_used_for_seller

logger = logging.getLogger("vastra.api")
router = APIRouter(prefix="/submissions", tags=["submissions"])
storage = get_storage()


def _image_url(image_id: str) -> str:
    return f"/api/images/{image_id}"


def _latest_run(db: Session, submission_id: str) -> PipelineRun | None:
    return db.scalar(
        select(PipelineRun)
        .where(PipelineRun.submission_id == submission_id)
        .order_by(PipelineRun.created_at.desc())
    )


@router.post("", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
def create_submission(
    background: BackgroundTasks,
    images: list[UploadFile] = File(...),
    title: str | None = Form(None),
    fabric_type: str | None = Form(None),
    color: str | None = Form(None),
    price_per_meter: float | None = Form(None),
    width_inches: float | None = Form(None),
    gsm: float | None = Form(None),
    notes: str | None = Form(None),
    customization: str | None = Form(None),  # JSON string
    user: Seller = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubmissionOut:
    if not images:
        raise HTTPException(status_code=400, detail="At least one image is required")

    # Token gate — block if the seller's balance is exhausted.
    used = tokens_used_for_seller(db, user.id)
    if used >= user.token_limit:
        raise HTTPException(
            status_code=402,
            detail="Token balance exhausted. Top up to keep generating products.",
        )

    try:
        cust = json.loads(customization) if customization else {}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="customization must be valid JSON")

    submission = Submission(
        seller_id=user.id,
        title=title,
        fabric_type=fabric_type,
        color=color,
        price_per_meter=price_per_meter,
        width_inches=width_inches,
        gsm=gsm,
        notes=notes,
        customization=cust,
        status="pending",
    )
    db.add(submission)
    db.flush()  # get submission.id

    for idx, upload in enumerate(images):
        data = upload.file.read()
        ext = (upload.filename or "img").split(".")[-1][:5]
        key = f"submissions/{submission.id}/raw_{idx}.{ext}"
        storage.save(key, data, upload.content_type or "image/jpeg")
        db.add(
            Image(
                submission_id=submission.id,
                kind=ImageKind.raw.value,
                storage_key=key,
                content_type=upload.content_type or "image/jpeg",
            )
        )
    db.commit()
    db.refresh(submission)

    # Kick off the agent pipeline (via the ai-service if configured).
    trigger_pipeline(background, submission.id)

    return SubmissionOut.model_validate(submission)


@router.get("", response_model=list[SubmissionListItem])
def list_submissions(
    user: Seller = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[SubmissionListItem]:
    subs = db.scalars(
        select(Submission)
        .where(Submission.seller_id == user.id)
        .order_by(Submission.created_at.desc())
    ).all()

    items: list[SubmissionListItem] = []
    for sub in subs:
        run = _latest_run(db, sub.id)
        progress = build_progress(run)
        raw = next((i for i in sub.images if i.kind == ImageKind.raw.value), None)
        gen = next((i for i in sub.images if i.kind == ImageKind.enhanced.value), None)
        thumb = gen or raw
        items.append(
            SubmissionListItem(
                id=sub.id,
                title=sub.title,
                fabric_type=sub.fabric_type,
                status=sub.status,
                created_at=sub.created_at,
                stage=progress["current"],
                percent=progress["percent"],
                thumbnail_url=_image_url(thumb.id) if thumb else None,
            )
        )
    return items


@router.get("/{submission_id}", response_model=SubmissionDetail)
def get_submission(
    submission_id: str,
    user: Seller = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubmissionDetail:
    sub = db.get(Submission, submission_id)
    if sub is None or (sub.seller_id != user.id and not user.is_admin):
        raise HTTPException(status_code=404, detail="Submission not found")

    run = _latest_run(db, submission_id)
    product = db.scalar(select(Product).where(Product.submission_id == submission_id))

    images = [
        ImageOut(id=i.id, kind=i.kind, shot_type=i.shot_type, url=_image_url(i.id))
        for i in sorted(sub.images, key=lambda x: x.kind, reverse=True)
    ]

    return SubmissionDetail(
        submission=SubmissionOut.model_validate(sub),
        customization=sub.customization,
        progress=build_progress(run),
        attributes=product.attributes if product else None,
        listing=product.listing if product else None,
        marketing=product.marketing if product else None,
        images=images,
        shopify_status=product.shopify_status if product else None,
    )
