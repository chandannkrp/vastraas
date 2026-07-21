"""The five agent nodes of the vastra pipeline.

Each node loads what it needs from the DB (keyed by submission/run id in the
state), does its work, records progress, and returns a partial state update.
"""

import base64
import io
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import select

from app.agents.llm import structured_llm
from app.agents.progress import add_usage, finish_stage, start_stage
from app.agents.schemas import MarketingContent, ProductAttributes, ProductListing
from app.agents.state import PipelineState
from app.config import get_settings
from app.db import SessionLocal
from app.models.tables import Image, PipelineRun, Product, Submission
from app.services.image_gen import aspect_for, build_prompt, get_image_service
from app.services.image_tiers import tier_for
from app.services.storage import get_storage

logger = logging.getLogger("vastra.agents")
settings = get_settings()
storage = get_storage()

def _get_run(db, rid: str) -> PipelineRun:
    return db.get(PipelineRun, rid)


def _usage(result: dict) -> tuple[int, int]:
    raw = result.get("raw")
    meta = getattr(raw, "usage_metadata", None) or {}
    return int(meta.get("input_tokens", 0)), int(meta.get("output_tokens", 0))


def _seller_hints(sub: Submission) -> str:
    parts = []
    for label, val in [
        ("title", sub.title),
        ("fabric type", sub.fabric_type),
        ("color", sub.color),
        ("width (in)", sub.width_inches),
        ("GSM", sub.gsm),
        ("notes", sub.notes),
    ]:
        if val:
            parts.append(f"{label}: {val}")
    return "; ".join(parts) or "(no details provided)"


# --------------------------------------------------------------------------- #
# 1. Intake / extraction agent (vision)
# --------------------------------------------------------------------------- #
def intake_node(state: PipelineState) -> PipelineState:
    sid, rid = state["submission_id"], state["run_id"]
    with SessionLocal() as db:
        run = _get_run(db, rid)
        start_stage(db, run, "extracting")
        sub = db.get(Submission, sid)
        raws = [i for i in sub.images if i.kind == "raw"]

        content: list = [
            {
                "type": "text",
                "text": (
                    "Analyze this fabric for an e-commerce listing. "
                    f"Seller-provided details — {_seller_hints(sub)}. "
                    "Return the structured fabric profile. If unsure about a field, "
                    "make your best guess and list it in low_confidence_fields."
                ),
            }
        ]
        for img in raws[:3]:  # cap for cost
            try:
                b64 = base64.b64encode(storage.load(img.storage_key)).decode()
                content.append(
                    {"type": "image_url", "image_url": {"url": f"data:{img.content_type};base64,{b64}"}}
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("could not load raw image %s: %s", img.id, exc)

        llm = structured_llm(ProductAttributes, 0.2)
        result = llm.invoke(
            [
                SystemMessage(
                    "You are a textile expert who catalogues fabrics for a B2B marketplace. "
                    "Be precise and commercial."
                ),
                HumanMessage(content=content),
            ]
        )
        attrs: ProductAttributes = result["parsed"]
        add_usage(db, run, *_usage(result))

        product = db.scalar(select(Product).where(Product.submission_id == sid))
        if product is None:
            product = Product(submission_id=sid)
            db.add(product)
        product.attributes = attrs.model_dump()
        db.commit()

        finish_stage(
            db, run, "extracting",
            f"{attrs.fabric_type} · {', '.join(attrs.colors[:3]) or 'colour n/a'}",
        )
        return {"attributes": attrs.model_dump(), "product_id": product.id}


# --------------------------------------------------------------------------- #
# 2. Image agent (clean + generate)
# --------------------------------------------------------------------------- #
def image_node(state: PipelineState) -> PipelineState:
    sid, rid = state["submission_id"], state["run_id"]
    with SessionLocal() as db:
        run = _get_run(db, rid)
        start_stage(db, run, "enhancing")
        sub = db.get(Submission, sid)
        attrs = state.get("attributes", {})
        cust = sub.customization or {}
        # Full-body studio-led defaults (the seller's reference look).
        shots = cust.get("image_shots") or ["on_model", "draped", "flatlay"]
        shots = shots[: settings.max_images_per_submission]
        custom_prompt = (cust.get("custom_prompt") or "").strip()
        finish = cust.get("finish")  # e.g. matte, glossy, sheen
        dye = cust.get("dye")  # e.g. indigo, marigold — Indian dye palette
        texture = cust.get("texture")  # e.g. slub, ribbed, handloom
        pattern = cust.get("pattern")  # e.g. floral, block-print, ikat

        service = get_image_service()
        tier = tier_for(cust.get("image_quality"))
        descriptor = " ".join(
            p for p in [
                dye or attrs.get("color") or ", ".join(attrs.get("colors", [])),
                pattern or attrs.get("pattern") or "",
                texture or "",
                attrs.get("fabric_type", "fabric"),
                f"with a {finish} finish" if finish and finish != "original" else "",
            ] if p
        ).strip()

        # Prefer EDITING the seller's real photo so the true fabric colour/texture
        # is preserved; fall back to text-to-image only if no raw photo exists.
        raws = [i for i in sub.images if i.kind == "raw"]
        base_bytes = None
        if raws:
            try:
                from PIL import Image as PILImage

                im = PILImage.open(io.BytesIO(storage.load(raws[0].storage_key))).convert("RGB")
                buf = io.BytesIO()
                im.save(buf, format="PNG")
                base_bytes = buf.getvalue()
            except Exception as exc:  # noqa: BLE001
                logger.warning("could not load raw for edit: %s", exc)

        # Generate the shots concurrently — each provider call is a network-bound
        # 2-30s round trip, so parallelising is the single biggest speed win.
        started = time.monotonic()

        def _one(shot: str) -> tuple[str, bytes]:
            prompt = build_prompt(descriptor, shot, custom_prompt, has_reference=base_bytes is not None)
            aspect = aspect_for(shot)
            if base_bytes is not None:
                return shot, service.edit(base_bytes, prompt, aspect=aspect, quality=tier["quality"])
            return shot, service.generate(prompt, aspect=aspect, quality=tier["quality"])

        results: list[tuple[str, bytes]] = []
        errors: list[str] = []
        workers = max(1, min(settings.image_concurrency, len(shots)))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(_one, s): s for s in shots}
            for fut in as_completed(futures):
                try:
                    results.append(fut.result())
                except Exception as exc:  # noqa: BLE001
                    logger.warning("image generation failed for %s: %s", futures[fut], exc)
                    errors.append(futures[fut])

        # Persist on the main thread (SQLAlchemy sessions aren't thread-safe),
        # preserving the seller's requested shot order.
        by_shot = {shot: png for shot, png in results}
        image_ids: list[str] = []
        for shot in shots:
            png = by_shot.get(shot)
            if png is None:
                continue
            key = f"submissions/{sid}/gen_{shot}.png"
            storage.save(key, png, "image/png")
            img = Image(
                submission_id=sid,
                kind="enhanced",
                shot_type=shot,
                storage_key=key,
                content_type="image/png",
            )
            db.add(img)
            db.flush()
            image_ids.append(img.id)

        if not image_ids:
            raise RuntimeError(errors and f"all image generations failed ({', '.join(errors)})" or "no images generated")

        # Charge image generation by the chosen tier so usage reflects real spend.
        add_usage(db, run, 0, len(image_ids) * tier["tokens"])
        db.commit()

        elapsed = time.monotonic() - started
        mode = "dry-run" if settings.dry_run_images else ("edited" if base_bytes else "generated")
        detail = f"{len(image_ids)} {tier['label'].lower()} images ({mode}) in {elapsed:.0f}s"
        if errors:
            detail += f" · {len(errors)} failed"
        finish_stage(db, run, "enhancing", detail)
        return {"generated_image_ids": image_ids}


# --------------------------------------------------------------------------- #
# 3. Listing agent
# --------------------------------------------------------------------------- #
def listing_node(state: PipelineState) -> PipelineState:
    sid, rid = state["submission_id"], state["run_id"]
    with SessionLocal() as db:
        run = _get_run(db, rid)
        start_stage(db, run, "drafting")
        sub = db.get(Submission, sid)
        attrs = state.get("attributes", {})
        cust = sub.customization or {}
        tone = cust.get("tone", "editorial")
        audience = cust.get("audience", "designers")
        length = cust.get("length", "standard")
        custom_prompt = (cust.get("custom_prompt") or "").strip()
        seller_note = f" Seller's specific request: {custom_prompt}." if custom_prompt else ""

        llm = structured_llm(ProductListing, 0.5)
        result = llm.invoke(
            [
                SystemMessage(
                    "You write Shopify product listings for a premium fabric marketplace. "
                    "Return clean semantic HTML for the description (no <html>/<body> wrapper)."
                ),
                HumanMessage(
                    f"Fabric profile: {attrs}. "
                    f"Write the listing in a {tone} tone for an audience of {audience}. "
                    f"Description length: {length}. Include care guidance if relevant.{seller_note}"
                ),
            ]
        )
        listing: ProductListing = result["parsed"]
        add_usage(db, run, *_usage(result))

        product = db.scalar(select(Product).where(Product.submission_id == sid))
        product.listing = listing.model_dump()
        db.commit()

        finish_stage(db, run, "drafting", listing.title)
        return {"listing": listing.model_dump()}


# --------------------------------------------------------------------------- #
# 4. Marketing / lookbook agent
# --------------------------------------------------------------------------- #
def marketing_node(state: PipelineState) -> PipelineState:
    sid, rid = state["submission_id"], state["run_id"]
    with SessionLocal() as db:
        run = _get_run(db, rid)
        start_stage(db, run, "marketing")
        attrs = state.get("attributes", {})
        listing = state.get("listing", {})

        llm = structured_llm(MarketingContent, 0.7)
        result = llm.invoke(
            [
                SystemMessage("You are a fashion marketing copywriter for a fabric brand."),
                HumanMessage(
                    f"Fabric: {attrs}. Listing title: {listing.get('title')}. "
                    "Write a lookbook caption, a short marketing hook, hashtags, and a "
                    "collection suggestion."
                ),
            ]
        )
        marketing: MarketingContent = result["parsed"]
        add_usage(db, run, *_usage(result))

        product = db.scalar(select(Product).where(Product.submission_id == sid))
        product.marketing = marketing.model_dump()
        db.commit()

        finish_stage(db, run, "marketing", marketing.marketing_blurb[:60])
        return {"marketing": marketing.model_dump()}


# --------------------------------------------------------------------------- #
# 5. Publisher agent (Shopify)
# --------------------------------------------------------------------------- #
def publisher_node(state: PipelineState) -> PipelineState:
    sid, rid = state["submission_id"], state["run_id"]
    with SessionLocal() as db:
        run = _get_run(db, rid)
        start_stage(db, run, "publishing")
        sub = db.get(Submission, sid)
        product = db.scalar(select(Product).where(Product.submission_id == sid))

        from app.services.shopify import creds_for_seller

        connected = creds_for_seller(db, sub.seller_id).configured
        if connected:
            # Real Shopify publishing is wired in the Shopify-integration slice.
            # Until the store handshake is confirmed, stage as DRAFT locally.
            product.shopify_status = "DRAFT"
            detail = "Draft prepared for Shopify."
        else:
            product.shopify_status = "draft_local"
            detail = "Shopify not connected — product staged, ready to publish."

        sub.status = "awaiting_review"
        run.stage = "published"
        db.commit()

        finish_stage(db, run, "published", detail)
        return {}
