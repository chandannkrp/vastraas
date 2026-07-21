"""Tiny cache-aside helper. Uses Redis when REDIS_URL is set, otherwise an
in-process TTL dict. Both are best-effort — a cache miss/outage never breaks the
request, it just falls through to the source."""

import json
import time

from app.config import get_settings

settings = get_settings()

_mem: dict[str, tuple[str, float]] = {}
_redis = None
_redis_tried = False


def _client():
    global _redis, _redis_tried
    if _redis_tried:
        return _redis
    _redis_tried = True
    if settings.redis_url:
        try:
            import redis

            client = redis.from_url(settings.redis_url, decode_responses=True, socket_timeout=1)
            client.ping()
            _redis = client
        except Exception:  # noqa: BLE001
            _redis = None
    return _redis


def get_json(key: str):
    client = _client()
    if client is not None:
        try:
            v = client.get(key)
            return json.loads(v) if v else None
        except Exception:  # noqa: BLE001
            pass
    hit = _mem.get(key)
    if hit and hit[1] > time.time():
        return json.loads(hit[0])
    if hit:
        _mem.pop(key, None)
    return None


def set_json(key: str, value, ttl: int = 30) -> None:
    data = json.dumps(value, default=str)
    client = _client()
    if client is not None:
        try:
            client.setex(key, ttl, data)
            return
        except Exception:  # noqa: BLE001
            pass
    _mem[key] = (data, time.time() + ttl)


def cached(key: str, ttl: int, producer):
    """Return cached value for `key`, else compute via `producer()` and store it."""
    hit = get_json(key)
    if hit is not None:
        return hit
    value = producer()
    set_json(key, value, ttl)
    return value
