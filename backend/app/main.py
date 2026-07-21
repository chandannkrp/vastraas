from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    admin,
    analytics,
    auth,
    billing,
    connectors,
    images,
    products,
    submissions,
    tokens,
)
from app.config import get_settings
from app.db import init_db
from app.seed import ensure_admin

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ensure_admin()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# CORS origins are configurable: CORS_ORIGINS (comma-separated) takes precedence,
# else the single FRONTEND_ORIGIN. "*" allows any origin (disables credentials,
# which browsers forbid alongside a wildcard).
_origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials="*" not in _origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, submissions, images, products, analytics, connectors, tokens, admin, billing):
    app.include_router(r.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}
