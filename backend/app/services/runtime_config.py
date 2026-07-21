"""Runtime, admin-editable config that overrides env defaults without a redeploy.

Backed by the ``app_settings`` table with a short in-process TTL cache so hot
paths (every agent run) don't hit the DB each time.
"""

import time

from app.config import get_settings
from app.db import SessionLocal
from app.models.tables import AppSetting

settings = get_settings()

_TTL = 5.0
_cache: dict[str, tuple[str | None, float]] = {}

# Keys we allow admins to override, with their env fallback.
OVERRIDABLE = {
    "llm_provider": lambda: settings.llm_provider,
    "image_provider": lambda: settings.image_provider,
    "bedrock_model_id": lambda: settings.bedrock_model_id,
    "openai_chat_model": lambda: settings.openai_chat_model,
    "llm_fallback": lambda: "true",  # auto-fallback to the other provider on error
}


def get(key: str, default: str | None = None) -> str | None:
    now = time.time()
    cached = _cache.get(key)
    if cached and cached[1] > now:
        val = cached[0]
    else:
        with SessionLocal() as db:
            row = db.get(AppSetting, key)
            val = row.value if row else None
        _cache[key] = (val, now + _TTL)
    if val is not None:
        return val
    fallback = OVERRIDABLE.get(key)
    return fallback() if fallback else default


def set(key: str, value: str) -> None:
    with SessionLocal() as db:
        row = db.get(AppSetting, key)
        if row is None:
            db.add(AppSetting(key=key, value=value))
        else:
            row.value = value
        db.commit()
    _cache.pop(key, None)


def effective() -> dict[str, str | None]:
    """All overridable keys with their currently-effective values."""
    return {k: get(k) for k in OVERRIDABLE}


def bool_get(key: str, default: bool = True) -> bool:
    v = get(key)
    if v is None:
        return default
    return str(v).lower() in ("1", "true", "yes", "on")
