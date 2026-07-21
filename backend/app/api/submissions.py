"""Submission intake + status: create (with images + customization), list, detail."""

import io
import json
import logging
import uuid
import zipfile

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.progress import build_progress
from app.agents.trigger import trigger_pipeline
from app.api.deps import get_current_user
from app.config import get_settings
from app.db import get_db
from app.models.tables import Image, ImageKind, PipelineRun, Product, Seller, Submission
from app.schemas.catalog import (
    ImageOut,
    SubmissionDetail,
    SubmissionListItem,
    SubmissionOut,
)
from app.services.image_gen import aspect_for, build_prompt, get_image_service
from app.services.image_tiers import public_tiers, tier_for
from app.services.shopify import ShopifyError, ShopifyPublisher, creds_for_seller
from app.services.storage import get_storage
from app.services.tokens import tokens_used_for_seller

settings = get_settings()

logger = logging.getLogger("vastra.api")
router = APIRouter(prefix="/submissions", tags=["submissions"])
storage = get_storage()

# Intake guardrails
MAX_UPLOAD_IMAGES = 8
MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB per image
MAX_PROMPT_CHARS = 1200


@router.get("/image-models")
def image_models() -> dict:
    """Image-generation tiers a seller can choose, with per-image token cost."""
    return {"models": public_tiers()}


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

    # --- Guardrails: bound the request so a single upload can't blow up cost or storage ---
    if len(images) > MAX_UPLOAD_IMAGES:
        raise HTTPException(status_code=400, detail=f"Too many images (max {MAX_UPLOAD_IMAGES}).")
    for up in images:
        if up.content_type and not up.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"'{up.filename}' is not an image.")

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

    # Cap free-text prompt length (defensive against abuse / runaway prompts).
    if isinstance(cust.get("custom_prompt"), str) and len(cust["custom_prompt"]) > MAX_PROMPT_CHARS:
        cust["custom_prompt"] = cust["custom_prompt"][:MAX_PROMPT_CHARS]

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
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"'{upload.filename}' is too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)}MB).",
            )
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


def _owned(db: Session, submission_id: str, user: Seller) -> Submission:
    sub = db.get(Submission, submission_id)
    if sub is None or (sub.seller_id != user.id and not user.is_admin):
        raise HTTPException(status_code=404, detail="Submission not found")
    return sub


@router.patch("/{submission_id}/listing", response_model=SubmissionDetail)
def update_listing(
    submission_id: str,
    payload: dict,
    user: Seller = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubmissionDetail:
    _owned(db, submission_id, user)
    product = db.scalar(select(Product).where(Product.submission_id == submission_id))
    if product is None:
        raise HTTPException(status_code=404, detail="Product not ready")
    listing = dict(product.listing or {})
    for key in ("title", "description_html", "seo_title", "product_type"):
        if payload.get(key) is not None:
            listing[key] = payload[key]
    if isinstance(payload.get("tags"), list):
        listing["tags"] = payload["tags"]
    product.listing = listing
    db.commit()
    return get_submission(submission_id, user, db)


@router.post("/{submission_id}/regenerate-image", response_model=ImageOut)
def regenerate_image(
    submission_id: str,
    payload: dict,
    user: Seller = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ImageOut:
    sub = _owned(db, submission_id, user)
    if not user.is_admin and tokens_used_for_seller(db, sub.seller_id) >= user.token_limit:
        raise HTTPException(status_code=402, detail="Token balance exhausted. Top up to generate more.")

    product = db.scalar(select(Product).where(Product.submission_id == submission_id))
    attrs = (product.attributes if product else {}) or {}
    shot = payload.get("shot_type", "on_model")
    custom = (payload.get("prompt") or "").strip()
    descriptor = (
        f"{attrs.get('color') or ', '.join(attrs.get('colors', []))} "
        f"{attrs.get('pattern') or ''} {attrs.get('fabric_type', 'fabric')}"
    ).strip()

    service = get_image_service()
    sub_cust = sub.customization or {}
    tier = tier_for(payload.get("image_quality") or sub_cust.get("image_quality"))
    raws = [i for i in sub.images if i.kind == ImageKind.raw.value]
    aspect = aspect_for(shot)
    if raws:
        base = _normalize_png(storage.load(raws[0].storage_key))
        prompt = build_prompt(descriptor, shot, custom, has_reference=True)
        png = service.edit(base, prompt, aspect=aspect, quality=tier["quality"])
    else:
        prompt = build_prompt(descriptor, shot, custom, has_reference=False)
        png = service.generate(prompt, aspect=aspect, quality=tier["quality"])

    key = f"submissions/{submission_id}/gen_{shot}_{uuid.uuid4().hex[:6]}.png"
    storage.save(key, png, "image/png")
    img = Image(
        submission_id=submission_id, kind=ImageKind.enhanced.value,
        shot_type=shot, storage_key=key, content_type="image/png",
    )
    db.add(img)
    db.commit()
    db.refresh(img)
    return ImageOut(id=img.id, kind=img.kind, shot_type=img.shot_type, url=_image_url(img.id))


@router.get("/{submission_id}/images.zip")
def download_images_zip(
    submission_id: str,
    user: Seller = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    sub = _owned(db, submission_id, user)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, img in enumerate(x for x in sub.images if x.kind == ImageKind.enhanced.value):
            try:
                data = storage.load(img.storage_key)
            except FileNotFoundError:
                continue
            zf.writestr(f"{img.shot_type or 'image'}_{i + 1}.png", data)
    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="vastra-{submission_id[:8]}.zip"'},
    )


def _normalize_png(data: bytes) -> bytes:
    from PIL import Image as PILImage

    im = PILImage.open(io.BytesIO(data)).convert("RGB")
    out = io.BytesIO()
    im.save(out, format="PNG")
    return out.getvalue()


@router.post("/{submission_id}/publish")
def publish_to_shopify(
    submission_id: str,
    payload: dict,
    user: Seller = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    creds = creds_for_seller(db, user.id)
    if not creds.configured:
        raise HTTPException(status_code=400, detail="Shopify is not connected. Connect your store first.")
    if not hasattr(storage, "presigned_url"):
        raise HTTPException(status_code=400, detail="Publishing requires S3 storage (STORAGE_BACKEND=s3).")

    sub = _owned(db, submission_id, user)
    product = db.scalar(select(Product).where(Product.submission_id == submission_id))
    if product is None:
        raise HTTPException(status_code=404, detail="Product not ready")

    # Ordered list of image ids to publish; default to all enhanced images.
    image_ids = payload.get("image_ids") or [
        i.id for i in sub.images if i.kind == ImageKind.enhanced.value
    ]
    id_to_img = {i.id: i for i in sub.images}
    image_urls: list[tuple[str, str]] = []
    for iid in image_ids:
        img = id_to_img.get(iid)
        if img is None:
            continue
        try:
            image_urls.append((storage.presigned_url(img.storage_key, 3600), img.shot_type or ""))
        except Exception as exc:  # noqa: BLE001
            logger.warning("could not presign image %s: %s", iid, exc)

    listing = product.listing or {}
    attrs = product.attributes or {}
    title = payload.get("title") or listing.get("title") or sub.title or "Fabric"
    metafields = {
        "gsm": payload.get("gsm") or (str(sub.gsm) if sub.gsm else ""),
        "width": payload.get("width") or (str(sub.width_inches) if sub.width_inches else ""),
        "composition": payload.get("composition") or attrs.get("composition") or "",
        "care": payload.get("care") or (listing.get("care_instructions") or ""),
        "set_contents": payload.get("set_contents") or "",
    }

    try:
        result = ShopifyPublisher(creds).publish(
            title=title,
            description_html=payload.get("description_html") or listing.get("description_html") or "",
            product_type=payload.get("product_type") or listing.get("product_type") or "Fabric",
            vendor=payload.get("vendor") or user.name,
            tags=payload.get("tags") or listing.get("tags") or attrs.get("tags") or [],
            status=payload.get("status", "DRAFT").upper(),
            price=payload.get("price"),
            compare_at_price=payload.get("compare_at_price"),
            image_urls=image_urls,
            metafields=metafields,
            collection_ids=payload.get("collection_ids") or [],
            existing_gid=product.shopify_product_gid,
        )
    except ShopifyError as exc:
        raise HTTPException(status_code=400, detail=f"Shopify error: {exc}")

    # Persist edits + shopify linkage.
    for key in ("title", "description_html", "product_type", "set_contents", "care"):
        if payload.get(key) is not None:
            listing[key] = payload[key]
    if isinstance(payload.get("tags"), list):
        listing["tags"] = payload["tags"]
    if payload.get("price") is not None:
        listing["price"] = payload["price"]
    product.listing = listing
    product.shopify_product_gid = result["gid"]
    product.shopify_status = result["status"] or payload.get("status", "DRAFT").upper()
    sub.status = "published"
    db.commit()

    return result


@router.post("/publish-set")
def publish_set_to_shopify(
    payload: dict,
    user: Seller = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Publish several submissions as a single Shopify product (a "set").

    Fabric sellers often sell a curated group of fabrics together. This
    aggregates the enhanced images from every selected submission into one
    Shopify product, so the whole set lists as a single item.
    """
    creds = creds_for_seller(db, user.id)
    if not creds.configured:
        raise HTTPException(status_code=400, detail="Shopify is not connected. Connect your store first.")
    if not hasattr(storage, "presigned_url"):
        raise HTTPException(status_code=400, detail="Publishing requires S3 storage (STORAGE_BACKEND=s3).")

    submission_ids = payload.get("submission_ids") or []
    if len(submission_ids) < 2:
        raise HTTPException(status_code=400, detail="Select at least two products to publish as a set.")

    subs = [_owned(db, sid, user) for sid in submission_ids]

    # Optional explicit image selection (ids may span several submissions);
    # otherwise every enhanced image from each submission, in selection order.
    wanted_ids = payload.get("image_ids")
    image_urls: list[tuple[str, str]] = []
    member_titles: list[str] = []
    for sub in subs:
        product = db.scalar(select(Product).where(Product.submission_id == sub.id))
        p_title = (product.listing or {}).get("title") if product else None
        member_titles.append(p_title or sub.title or "Fabric")
        enhanced = [i for i in sub.images if i.kind == ImageKind.enhanced.value]
        chosen = [i for i in enhanced if not wanted_ids or i.id in wanted_ids]
        for img in chosen:
            try:
                image_urls.append((storage.presigned_url(img.storage_key, 3600), img.shot_type or ""))
            except Exception as exc:  # noqa: BLE001
                logger.warning("could not presign image %s: %s", img.id, exc)

    if not image_urls:
        raise HTTPException(status_code=400, detail="The selected products have no images to publish.")

    title = payload.get("title") or f"{member_titles[0]} — Fabric Set"
    set_contents = payload.get("set_contents") or "\n".join(
        f"• {t}" for t in member_titles if t
    )

    try:
        result = ShopifyPublisher(creds).publish(
            title=title,
            description_html=payload.get("description_html") or "",
            product_type=payload.get("product_type") or "Fabric Set",
            vendor=payload.get("vendor") or user.name,
            tags=payload.get("tags") or ["set", "bundle"],
            status=payload.get("status", "DRAFT").upper(),
            price=payload.get("price"),
            compare_at_price=payload.get("compare_at_price"),
            image_urls=image_urls,
            metafields={
                "composition": payload.get("composition") or "",
                "care": payload.get("care") or "",
                "set_contents": set_contents,
            },
            collection_ids=payload.get("collection_ids") or [],
        )
    except ShopifyError as exc:
        raise HTTPException(status_code=400, detail=f"Shopify error: {exc}")

    # Link every member submission to the shared set product.
    for sub in subs:
        product = db.scalar(select(Product).where(Product.submission_id == sub.id))
        if product is not None:
            product.shopify_product_gid = result["gid"]
            product.shopify_status = result["status"] or payload.get("status", "DRAFT").upper()
        sub.status = "published"
    db.commit()

    result["submission_ids"] = submission_ids
    return result
