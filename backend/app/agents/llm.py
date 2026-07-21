"""LLM factory for the agents — OpenAI or AWS Bedrock, switchable at runtime.

`structured_llm()` is what the agents use: it builds the structured-output chain
for the active provider and, when enabled, adds an automatic fallback to the
other provider so a billing/quota outage on one doesn't take the pipeline down.
"""

import logging
import os

from app.config import get_settings
from app.services import runtime_config

logger = logging.getLogger("vastra.agents")
settings = get_settings()


def active_llm_provider() -> str:
    return (runtime_config.get("llm_provider") or "openai").lower()


def _provider_configured(provider: str) -> bool:
    if provider == "bedrock":
        return bool(settings.aws_bedrock_api_key)
    return bool(settings.openai_api_key)


def _build(provider: str, temperature: float):
    if provider == "bedrock":
        from langchain_aws import ChatBedrockConverse

        if settings.aws_bedrock_api_key:
            os.environ.setdefault("AWS_BEARER_TOKEN_BEDROCK", settings.aws_bedrock_api_key)
        return ChatBedrockConverse(
            model=runtime_config.get("bedrock_model_id") or settings.bedrock_model_id,
            region_name=settings.bedrock_region or settings.aws_region,
            temperature=temperature,
            max_tokens=4096,
        )

    from langchain_openai import ChatOpenAI

    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY not configured")
    return ChatOpenAI(
        model=runtime_config.get("openai_chat_model") or settings.openai_chat_model,
        api_key=settings.openai_api_key,
        temperature=temperature,
        timeout=60,
        max_retries=2,
    )


def get_chat_llm(temperature: float = 0.3):
    """The active provider's chat model (no fallback wrapper)."""
    return _build(active_llm_provider(), temperature)


def structured_llm(schema, temperature: float = 0.3):
    """Structured-output chain for the active provider, with automatic fallback
    to the other provider (if configured and enabled)."""
    primary = active_llm_provider()
    chain = _build(primary, temperature).with_structured_output(schema, include_raw=True)

    other = "openai" if primary == "bedrock" else "bedrock"
    if runtime_config.bool_get("llm_fallback", True) and _provider_configured(other):
        try:
            backup = _build(other, temperature).with_structured_output(schema, include_raw=True)
            return chain.with_fallbacks([backup])
        except Exception as exc:  # noqa: BLE001
            logger.warning("could not build fallback LLM (%s): %s", other, exc)
    return chain
