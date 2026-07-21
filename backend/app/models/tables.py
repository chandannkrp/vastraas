import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- Status/stage value constants (stored as plain strings for easy evolution) ---


class SubmissionStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    awaiting_review = "awaiting_review"
    published = "published"
    failed = "failed"
    rejected = "rejected"


class PipelineStage(str, enum.Enum):
    queued = "queued"
    extracting = "extracting"
    enhancing = "enhancing"
    drafting = "drafting"
    marketing = "marketing"
    publishing = "publishing"
    published = "published"
    failed = "failed"


# Ordered stages the pipeline advances through (for UI progress rendering).
PIPELINE_STAGES: list[str] = [
    PipelineStage.extracting.value,
    PipelineStage.enhancing.value,
    PipelineStage.drafting.value,
    PipelineStage.marketing.value,
    PipelineStage.publishing.value,
]


class ImageKind(str, enum.Enum):
    raw = "raw"
    enhanced = "enhanced"


class Seller(Base):
    __tablename__ = "sellers"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    token_limit: Mapped[int] = mapped_column(Integer, default=200_000)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    submissions: Mapped[list["Submission"]] = relationship(back_populates="seller")


class AppSetting(Base):
    """Runtime key/value config, editable by admins without redeploy — e.g. which
    LLM / image provider is active. Overrides the env defaults when present."""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class ShopifyConnection(Base):
    """A seller's own Shopify store credentials, so each seller publishes to
    their own store. One connection per seller."""

    __tablename__ = "shopify_connections"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    seller_id: Mapped[str] = mapped_column(ForeignKey("sellers.id"), unique=True, index=True)
    store_domain: Mapped[str] = mapped_column(String(255))
    # One of: a static Admin API token, OR a client id + secret (client-credentials grant).
    admin_token: Mapped[str | None] = mapped_column(String(255))
    client_id: Mapped[str | None] = mapped_column(String(255))
    client_secret: Mapped[str | None] = mapped_column(String(255))
    shop_name: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Submission(Base):
    """Raw intake from a seller: images + whatever info they provided."""

    __tablename__ = "submissions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    seller_id: Mapped[str] = mapped_column(ForeignKey("sellers.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default=SubmissionStatus.pending.value, index=True)

    # Seller-provided fields — all optional; agents fill the gaps
    title: Mapped[str | None] = mapped_column(String(255))
    fabric_type: Mapped[str | None] = mapped_column(String(120))
    color: Mapped[str | None] = mapped_column(String(120))
    price_per_meter: Mapped[float | None] = mapped_column(Float)
    width_inches: Mapped[float | None] = mapped_column(Float)
    gsm: Mapped[float | None] = mapped_column(Float)
    moq_meters: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text)

    # Customization choices that steer the agents:
    # {"image_shots": ["flatlay","draped",...], "tone": "editorial",
    #  "audience": "designers", "length": "standard"}
    customization: Mapped[dict | None] = mapped_column(JSON)

    source_channel: Mapped[str] = mapped_column(String(20), default="webapp")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    seller: Mapped[Seller] = relationship(back_populates="submissions")
    images: Mapped[list["Image"]] = relationship(back_populates="submission")
    product: Mapped["Product | None"] = relationship(back_populates="submission", uselist=False)
    pipeline_runs: Mapped[list["PipelineRun"]] = relationship(back_populates="submission")


class Image(Base):
    __tablename__ = "images"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    submission_id: Mapped[str] = mapped_column(ForeignKey("submissions.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20), default=ImageKind.raw.value)
    parent_image_id: Mapped[str | None] = mapped_column(ForeignKey("images.id"))
    storage_key: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(100), default="image/png")
    shot_type: Mapped[str | None] = mapped_column(String(40))  # flatlay | draped | macro | on_model
    approved: Mapped[bool | None] = mapped_column(Boolean, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    submission: Mapped[Submission] = relationship(back_populates="images")


class Product(Base):
    """Processed, publishable product derived from a submission."""

    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    submission_id: Mapped[str] = mapped_column(ForeignKey("submissions.id"), unique=True)
    attributes: Mapped[dict | None] = mapped_column(JSON)  # extraction agent output
    listing: Mapped[dict | None] = mapped_column(JSON)  # listing agent output
    marketing: Mapped[dict | None] = mapped_column(JSON)  # marketing/lookbook agent output
    shopify_product_gid: Mapped[str | None] = mapped_column(String(100), index=True)
    shopify_status: Mapped[str | None] = mapped_column(String(20))  # DRAFT | ACTIVE
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    submission: Mapped[Submission] = relationship(back_populates="product")


class TokenPurchase(Base):
    """A token top-up (Stripe or mock). Keyed by Stripe session id for idempotency."""

    __tablename__ = "token_purchases"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    seller_id: Mapped[str] = mapped_column(ForeignKey("sellers.id"), index=True)
    pack_id: Mapped[str] = mapped_column(String(40))
    tokens: Mapped[int] = mapped_column(Integer)
    amount: Mapped[int] = mapped_column(Integer)  # smallest currency unit (paise)
    currency: Mapped[str] = mapped_column(String(8), default="inr")
    provider: Mapped[str] = mapped_column(String(20), default="stripe")  # stripe | mock
    stripe_session_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | paid | failed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class PipelineRun(Base):
    """One end-to-end run of the agent pipeline for a submission. Audit + resumability."""

    __tablename__ = "pipeline_runs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    submission_id: Mapped[str] = mapped_column(ForeignKey("submissions.id"), index=True)
    stage: Mapped[str] = mapped_column(String(30), default=PipelineStage.queued.value)
    # Per-stage logs: [{stage, status, detail, at}]
    stage_log: Mapped[list | None] = mapped_column(JSON, default=list)
    error: Mapped[str | None] = mapped_column(Text)
    total_input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    submission: Mapped[Submission] = relationship(back_populates="pipeline_runs")
