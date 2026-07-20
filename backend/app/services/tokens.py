"""Token accounting — usage is derived from PipelineRun token counters so it can
never drift from what was actually consumed."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.tables import PipelineRun, Submission


def _run_tokens_col():
    return func.coalesce(func.sum(PipelineRun.total_input_tokens), 0) + func.coalesce(
        func.sum(PipelineRun.total_output_tokens), 0
    )


def tokens_used_for_sellers(db: Session, seller_ids: list[str]) -> int:
    if not seller_ids:
        return 0
    sub_ids = db.scalars(select(Submission.id).where(Submission.seller_id.in_(seller_ids))).all()
    if not sub_ids:
        return 0
    return int(db.scalar(select(_run_tokens_col()).where(PipelineRun.submission_id.in_(sub_ids))) or 0)


def tokens_used_for_seller(db: Session, seller_id: str) -> int:
    return tokens_used_for_sellers(db, [seller_id])


def daily_usage_for_seller(db: Session, seller_id: str, days: int = 14) -> list[dict]:
    """Per-day token usage for the last `days` days (zero-filled)."""
    since = datetime.now(timezone.utc) - timedelta(days=days - 1)
    sub_ids = db.scalars(select(Submission.id).where(Submission.seller_id == seller_id)).all()
    rows = []
    if sub_ids:
        day = func.date(PipelineRun.created_at)
        rows = db.execute(
            select(day.label("d"), _run_tokens_col().label("t"))
            .where(PipelineRun.submission_id.in_(sub_ids), PipelineRun.created_at >= since)
            .group_by(day)
        ).all()
    by_day = {str(r.d): int(r.t or 0) for r in rows}

    out = []
    base = datetime.now(timezone.utc).date()
    for i in range(days - 1, -1, -1):
        d = str(base - timedelta(days=i))
        out.append({"date": d, "tokens": by_day.get(d, 0)})
    return out
