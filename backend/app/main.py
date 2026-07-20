from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    admin,
    analytics,
    auth,
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, submissions, images, products, analytics, connectors, tokens, admin):
    app.include_router(r.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}
