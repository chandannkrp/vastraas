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

    # Tokens — standard grant per seller; top-up increases the limit
    default_token_limit: int = 200_000

    # Seed admin (created on startup if no admin exists)
    admin_email: str = "admin@vastra.ai"
    admin_password: str = "admin12345"
    admin_name: str = "Vastra Admin"

    # Database
    database_url: str = f"sqlite:///{BASE_DIR / 'vastra.db'}"

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

    # OpenAI — LLM agents + image generation
    openai_api_key: str = ""
    openai_chat_model: str = "gpt-4o-mini"  # reasoning/copy agents
    openai_image_model: str = "gpt-image-1"
    openai_image_size: str = "1024x1024"
    openai_image_quality: str = "low"  # low keeps dev cost minimal
    # When true, image service returns a placeholder instead of calling OpenAI
    dry_run_images: bool = True
    max_images_per_submission: int = 4

    # Shopify (custom app on the live Impulse store)
    shopify_store_domain: str = ""  # e.g. "your-store.myshopify.com"
    shopify_admin_token: str = ""
    shopify_api_version: str = "2026-01"


@lru_cache
def get_settings() -> Settings:
    return Settings()
