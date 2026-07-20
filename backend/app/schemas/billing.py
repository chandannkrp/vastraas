from datetime import datetime

from pydantic import BaseModel


class TokenSummary(BaseModel):
    limit: int
    used: int
    remaining: int
    percent_used: int
    daily: list[dict]


class TopUpRequest(BaseModel):
    amount: int = 100_000


class BusinessRow(BaseModel):
    id: str
    name: str
    email: str
    is_admin: bool
    created_at: datetime
    submissions: int
    published: int
    tokens_used: int
    token_limit: int


class GrowthMetrics(BaseModel):
    total_sellers: int
    new_sellers_7d: int
    total_submissions: int
    total_published: int
    total_tokens: int
    signups_daily: list[dict]
    submissions_daily: list[dict]


class SellerLogEntry(BaseModel):
    submission_id: str
    title: str | None
    status: str
    stage: str | None
    tokens: int
    created_at: datetime


class BusinessDetail(BaseModel):
    business: BusinessRow
    logs: list[SellerLogEntry]
