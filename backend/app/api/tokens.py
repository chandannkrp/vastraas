"""Seller token balance, usage graph, and (mock) top-up."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models.tables import Seller
from app.schemas.billing import TokenSummary, TopUpRequest
from app.services.tokens import daily_usage_for_seller, tokens_used_for_seller

router = APIRouter(prefix="/tokens", tags=["tokens"])


@router.get("/summary", response_model=TokenSummary)
def summary(user: Seller = Depends(get_current_user), db: Session = Depends(get_db)) -> TokenSummary:
    used = tokens_used_for_seller(db, user.id)
    remaining = max(user.token_limit - used, 0)
    percent = round(used / user.token_limit * 100) if user.token_limit else 0
    return TokenSummary(
        limit=user.token_limit,
        used=used,
        remaining=remaining,
        percent_used=min(percent, 100),
        daily=daily_usage_for_seller(db, user.id),
    )


@router.post("/topup", response_model=TokenSummary)
def topup(
    payload: TopUpRequest,
    user: Seller = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TokenSummary:
    # Mock top-up (no payment processor yet) — simply raises the limit.
    amount = max(0, min(payload.amount, 5_000_000))
    user.token_limit += amount
    db.commit()
    db.refresh(user)
    used = tokens_used_for_seller(db, user.id)
    remaining = max(user.token_limit - used, 0)
    percent = round(used / user.token_limit * 100) if user.token_limit else 0
    return TokenSummary(
        limit=user.token_limit,
        used=used,
        remaining=remaining,
        percent_used=min(percent, 100),
        daily=daily_usage_for_seller(db, user.id),
    )
