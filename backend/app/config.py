from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR.parent / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    # App
    app_name: str = "vastra.ai"
    debug: bool = True
    frontend_origin: str = "http://localhost:5173"
    # CORS: comma-separated list of allowed origins (falls back to frontend_origin).
    # Use "*" to allow any origin. Optionally a regex for dynamic subdomains.
    cors_origins: str = ""
    cors_origin_regex: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins or self.frontend_origin
        return [o.strip() for o in raw.split(",") if o.strip()]

    # AI service (agent pipeline). If set, the backend delegates pipeline runs
    # to this separate service over HTTP; if blank, it runs in-process.
    ai_service_url: str = ""

    # Auth / JWT
    secret_key: str = "change-me-in-production"
    jwt_secret: str = ""  # strong signing key (preferred over secret_key)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

    # Tokens — standard grant per seller; top-up increases the limit.
    # 1M free ≈ ~14 products (see cost model in app/services/pricing.py).
    default_token_limit: int = 1_000_000
    # Token-equivalent cost charged per generated image so usage reflects the
    # real gpt-image-1 spend, not just LLM tokens.
    image_token_cost: int = 20_000

    # Stripe (token top-ups). Leave blank to use instant mock top-up in dev.
    stripe_secret_key: str = ""
    stripe_publishing_key: str = ""
    stripe_webhook_secret: str = ""
    currency: str = "inr"
    checkout_success_url: str = "http://localhost:5173/dashboard?tab=tokens&checkout=success"
    checkout_cancel_url: str = "http://localhost:5173/dashboard?tab=tokens&checkout=cancel"

    # Seed admin (created on startup if no admin exists)
    admin_email: str = "admin@vastra.ai"
    admin_password: str = "admin12345"
    admin_name: str = "Vastra Admin"

    # Database
    database_url: str = f"sqlite:///{BASE_DIR / 'vastra.db'}"

    # Cache: Redis if REDIS_URL is set (e.g. redis://localhost:6379/0),
    # else a small in-process TTL cache. Speeds up slow/repeated reads.
    redis_url: str = ""

    # Object storage: "local" for dev, "s3" for AWS S3 (or R2) in prod
    storage_backend: str = "local"
    storage_local_dir: Path = BASE_DIR / "storage"
    # AWS S3
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-west-2"
    aws_bucket_name: str = ""
    # Optional custom endpoint (Cloudflare R2 etc.); leave blank for AWS S3
    s3_endpoint_url: str = ""

    @property
    def signing_key(self) -> str:
        return self.jwt_secret or self.secret_key

    # AI providers
    anthropic_api_key: str = ""
    claude_model: str = "claude-opus-4-8"

    # LLM (reasoning/copy agents): "openai" or "bedrock".
    llm_provider: str = "openai"
    # AWS Bedrock — auth via a long-term Bedrock API key (bearer token). The
    # region must have the model enabled under Bedrock → Model access.
    aws_bedrock_api_key: str = ""
    bedrock_model_id: str = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    bedrock_region: str = ""  # falls back to aws_region

    # Image generation provider: "gemini" (fast/cheap/photoreal, default) or "openai".
    image_provider: str = "gemini"

    # Google Gemini — image generation ("nano banana") + optional LLM.
    gemini_api_key: str = ""
    google_api_key: str = ""  # fallback name accepted by the Google SDK
    gemini_image_model: str = "gemini-2.5-flash-image"

    # OpenAI — LLM agents + (alternative) image generation
    openai_api_key: str = ""
    openai_chat_model: str = "gpt-4o-mini"  # reasoning/copy agents
    openai_image_model: str = "gpt-image-1"
    openai_image_size: str = "1024x1024"
    openai_image_quality: str = "high"  # high matches the studio reference look
    # When true, image service returns a placeholder instead of calling a provider
    dry_run_images: bool = True
    max_images_per_submission: int = 4
    # Max concurrent image generations per submission (parallelism = speed).
    image_concurrency: int = 4

    # Shopify (custom app on the live Impulse store)
    shopify_store_domain: str = ""  # e.g. "your-store.myshopify.com"
    shopify_admin_token: str = ""
    shopify_api_version: str = "2026-01"
    # Newer Shopify apps (Dev Dashboard) expose a Client ID + Client Secret
    # instead of a ready-made shpat_ token. When these are set (and no static
    # admin token is provided), the backend fetches a short-lived Admin API
    # token via the client-credentials grant — a server-to-server exchange that
    # needs no redirect URL, so it works in local dev. See services/shopify.py.
    shopify_client_id: str = ""
    shopify_client_secret: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
