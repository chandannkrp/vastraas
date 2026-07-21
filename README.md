# vastraas.ai

A team of AI agents for fabric sellers. Sellers upload raw smartphone photos +
basic info; the agents **upscale them into professional studio product imagery**,
write **customizable** listings, and publish them to the seller's own Shopify
store — then keep the store fresh with lookbooks and marketing.

Built for the Indian clothing market (designers & garmenters). Monorepo.

## Structure

- `backend/` — FastAPI API + auth, Shopify, tokens/billing, storage (Python 3.13, `uv`)
- `ai-service/` — LangGraph agent pipeline runner; reuses the `backend` app package
- `frontend/` — React 19 + TypeScript + Tailwind v4 (Vite) — landing, auth, dashboards

The backend delegates pipeline runs to `ai-service` over HTTP when `AI_SERVICE_URL`
is set; otherwise it runs the pipeline in-process.

## Providers (swappable)

- **Text agents (LLM):** OpenAI (`gpt-4o-mini`) or **AWS Bedrock** (Claude). Set
  `LLM_PROVIDER`. Bedrock authenticates with a Bedrock **API key** via the
  `AWS_BEARER_TOKEN_BEDROCK` bearer token — no AWS access-key pair needed.
  `structured_llm()` adds an automatic fallback to the other provider if one is down.
- **Image generation:** OpenAI `gpt-image-1` or Google **Gemini 2.5 Flash Image**.
  Set `IMAGE_PROVIDER`. Sellers pick a quality tier (Standard/Balanced/Premium)
  per shoot; the token cost is shown up front and charged by tier.
- Both providers are **switchable at runtime** from the Admin → System panel
  (no redeploy), stored in the `app_settings` table.

## Setup

```bash
cp .env.example .env      # set SECRET_KEY, ADMIN_*, DB, storage, provider keys
```

Image generation defaults to **dry-run** (`DRY_RUN_IMAGES=true`) so nothing hits a
paid API in dev. Set `DRY_RUN_IMAGES=false` and configure a provider to generate
for real. Publishing to Shopify requires `STORAGE_BACKEND=s3` (Shopify fetches
images via presigned URLs).

### Run locally (three services)

```bash
# backend  → http://localhost:8000  (/health, /docs)
cd backend && uv run uvicorn app.main:app --reload

# ai-service → http://localhost:8100  (set AI_SERVICE_URL=http://localhost:8100 in .env)
cd ai-service && uv run uvicorn service.main:app --port 8100 --reload

# frontend → http://localhost:5173
cd frontend && npm install && npm run dev
```

On first start the backend creates the DB tables and seeds the admin
(`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

## Shopify (per-seller)

Each seller connects **their own** store from the dashboard's Connectors tab:
store domain + either an Admin API token (`shpat_…`) or a **Client ID + Client
Secret** (exchanged for a token via the client-credentials grant — works in local
dev, no redirect URL). Credentials are verified live before they're saved.

## Performance

- `REDIS_URL` enables Redis caching (falls back to an in-process TTL cache when
  unset) for slow/repeated reads such as Shopify collections.
- Thumbnails lazy-load behind shimmering skeletons; image generation runs the
  requested shots concurrently.

## Deployment

Each service ships a Dockerfile; `docker-compose.yml` wires them together with
Redis.

```bash
# from the repo root, with a populated .env
docker compose up --build
# frontend → http://localhost:8080, backend → http://localhost:8000
```

- Build the frontend with your API URL: `VITE_API_BASE=https://api.example.com`.
- The ai-service image must be built with the **repo root** as context (it bundles
  the editable `backend` package) — compose already does this.
- CORS origins are configurable via `CORS_ORIGINS` (comma-separated) or
  `CORS_ORIGIN_REGEX`.

## Documentation

- [`PLAN.md`](PLAN.md) — what we're building, working style, the agents, status.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture, auth, data
  model, agent pipeline, environments.
- [`docs/decisions/`](docs/decisions/) — Architecture Decision Records (ADRs).
