"""Image-generation model tiers the seller can choose before a shoot.

Three balanced options trading quality against token spend. `tokens` is what we
charge per generated image for that tier, and drives the "how much will this
cost" estimate shown in the UI — so this dict is the single source of truth for
both the estimate and the actual charge.
"""

IMAGE_TIERS: dict[str, dict] = {
    "standard": {
        "key": "standard",
        "label": "Standard",
        "quality": "low",  # gpt-image-1 quality
        "tokens": 10_000,
        "blurb": "Fast & economical — clean catalogue shots.",
    },
    "balanced": {
        "key": "balanced",
        "label": "Balanced",
        "quality": "medium",
        "tokens": 25_000,
        "blurb": "Best value — sharp, studio-grade detail.",
    },
    "premium": {
        "key": "premium",
        "label": "Premium",
        "quality": "high",
        "tokens": 50_000,
        "blurb": "Highest fidelity — editorial, magazine-ready.",
    },
}

DEFAULT_TIER = "balanced"


def tier_for(key: str | None) -> dict:
    return IMAGE_TIERS.get((key or DEFAULT_TIER), IMAGE_TIERS[DEFAULT_TIER])


def public_tiers() -> list[dict]:
    """Tiers as the frontend needs them (ordered cheapest → priciest)."""
    order = ["standard", "balanced", "premium"]
    return [
        {
            "key": IMAGE_TIERS[k]["key"],
            "label": IMAGE_TIERS[k]["label"],
            "tokens_per_image": IMAGE_TIERS[k]["tokens"],
            "blurb": IMAGE_TIERS[k]["blurb"],
            "recommended": k == DEFAULT_TIER,
        }
        for k in order
    ]
