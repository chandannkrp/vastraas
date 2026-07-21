# vastraas.ai AI service (LangGraph pipeline runner).
# NOTE: build with the repo ROOT as context so the editable `backend` package
# (referenced as ../backend in uv.lock) is available:
#   docker build -f ai-service/Dockerfile -t vastraas-ai-service .
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
# Both projects (ai-service depends on ../backend).
COPY backend /app/backend
COPY ai-service /app/ai-service

WORKDIR /app/ai-service
RUN uv sync --frozen --no-dev

ENV PATH="/app/ai-service/.venv/bin:$PATH"
EXPOSE 8100
CMD ["sh", "-c", "uvicorn service.main:app --host 0.0.0.0 --port ${PORT:-8100}"]
