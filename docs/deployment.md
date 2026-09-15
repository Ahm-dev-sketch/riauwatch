# RIAUWATCH — Deployment Runbook

**Status:** code-complete, build-verified. Actual hosting provisioning and go-live are operator actions (accounts, keys, DNS) — this document is the complete runbook.

## 1. Target Topology

```
Users → Vercel (Next.js frontend, static + SSR)
            │  NEXT_PUBLIC_API_URL
            ▼
Contained host (Docker) — FastAPI (uvicorn, 1+ workers)
            │
            ▼
Managed PostgreSQL 16 + PostGIS 3
            ▲
Cron / scheduler → `python -m app.worker <job>` (same image)
```

The backend is deliberately portable: any host that runs the provided `backend/Dockerfile` works (VPS, Fly.io, Railway, Render, Cloud Run). Nothing backend-side depends on Vercel.

## 2. Prerequisites (operator)

1. GitHub repo pushed (this repo).
2. Free registrations: NASA FIRMS MAP_KEY (firms.modaps.eosdis.nasa.gov) and OpenAQ API key (openaq.org) — email signups.
3. PostgreSQL 16 with PostGIS 3 reachable from the backend host. Options (trade-offs):
   - **Supabase (recommended start):** free tier, PostGIS pre-enabled, connection pooling included. Verify the PostGIS version supports `UNIQUE NULLS NOT DISTINCT` (PostgreSQL 15+ — Supabase runs 15+).
   - Alternatives: Neon (Postgres 16+, PostGIS available), Aiven, AWS RDS, or self-hosted Postgres + `CREATE EXTENSION postgis`.
4. Frontend hosting: Vercel account (recommended) or any Node host serving `npm run build` output.

## 3. Database Setup

```sql
-- Once per database (superuser or managed-console SQL editor):
CREATE EXTENSION IF NOT EXISTS postgis;
```

```powershell
# From backend/ with DATABASE_URL pointing at production:
$env:DATABASE_URL="postgresql+psycopg://<user>:<pass>@<host>:5432/<db>"
python -m alembic upgrade head
```

Verify: `data_sources` has 5 seeded rows; PostGIS version `SELECT postgis_full_version();`.

## 4. Backend Deploy (Docker)

`backend/Dockerfile` builds the API+worker image (Python 3.12-slim, venv install, exposes 8000):

```powershell
Set-Location backend
docker build -t riauwatch-backend:latest .
docker run -d --name riauwatch-api --env-file .env.prod -p 8000:8000 riauwatch-backend:latest
```

Production env (values via host secret store, never in git): `DATABASE_URL`, `FIRMS_MAP_KEY`, `OPENAQ_API_KEY`, `FRONTEND_ORIGINS=https://<your-domain>`, `RATE_LIMIT_PER_MINUTE=60`, `LOG_LEVEL=INFO`, `INGEST_LOOKBACK_HOURS=48`.

Health check: `GET /api/v1/meta/data-sources` → 200 with 5 sources. DB-down behavior: generic 500 problem+json (no internals), `/status` degrades once ingestion runs.

## 5. Ingestion Scheduling

Same image, CLI mode (cron, systemd timers, or an in-cluster scheduler such as supercronic/ofelia):

| Job | Schedule | Command |
|---|---|---|
| firms-hotspots | every 2 h | `python -m app.worker firms-hotspots` |
| weather-points | every 2 h | `python -m app.worker weather-points` |
| air-quality | every 2 h | `python -m app.worker air-quality` |
| risk-recompute | after the above | `python -m app.worker risk-recompute` |
| boundaries-load | quarterly, manual | `python -m app.worker boundaries-load --file <geojson>` |

First-time backfill (required before risk works): `python -m app.worker weather-points --past-days 30` (up to 92), then `risk-recompute`. Confirm `data_ingestion_logs` shows `success` rows and `/api/v1/status` reports fresh timestamps.

## 6. Frontend Deploy (Vercel)

1. Import the GitHub repo; set **Root Directory** to `frontend/`.
2. Build defaults work (`npm run build`). Environment variables:
   - `NEXT_PUBLIC_API_URL=https://<backend-host>` (no trailing slash)
   - `NEXT_PUBLIC_USE_MOCKS=false` (critical — `true` shows the "Data contoh" badge)
   - Optional: `NEXT_PUBLIC_SITE_URL=https://<your-domain>` (canonical OG URLs)
3. Deploy; verify: homepage loads without login, map renders tiles, `/data-sources` lists live `meta` sources, no "Data contoh" badge visible.

## 7. DNS / TLS

Terminate TLS at the hosts (Vercel automatic; backend behind the container platform's TLS or a reverse proxy). No app changes needed. CORS: backend `FRONTEND_ORIGINS` must exactly match the public frontend origin.

## 8. Monitoring Basics (MVP)

- Watch `data_ingestion_logs`: alert (even manual daily check at first) on `failed` status or `running` rows older than 2× cadence.
- `/api/v1/status` is the machine-readable equivalent — `degraded: true` per domain drives the public "Data may be delayed" messaging automatically.
- Logs: structured JSON from the worker; retain per host defaults.
- Uptime: any HTTP monitor on `/api/v1/meta/data-sources` (API) and `/` (frontend).

## 9. Go-Live Checklist

- [ ] `FIRMS_MAP_KEY` + `OPENAQ_API_KEY` registered and set as secrets
- [ ] Production Postgres + PostGIS migrated (`alembic upgrade head`)
- [ ] Each ingestion job run once manually → `success` in logs
- [ ] Weather backfill (≥7 days) + `risk-recompute` completed
- [ ] OpenAQ Riau station inventory reviewed → WAQI fallback decision recorded (see docs/data-sources.md)
- [ ] `/api/v1/status` shows fresh timestamps, no degraded flags
- [ ] Frontend env `NEXT_PUBLIC_USE_MOCKS=false`, no mock badge in production
- [ ] `npm run build` + backend gates green on the deployed commit
- [ ] Smoke: map, popup with disclaimer, filters, risk factors, AQ timestamp, geolocation, mobile layout
- [ ] Independent review of this checklist by a second pair of eyes before announcing

## 10. Rollback

- Frontend: Vercel instant rollback to previous deployment.
- Backend: redeploy previous image tag; migrations are additive (0001/0002) — downgrade via `alembic downgrade -1` only if the release introduced a migration.
- Data: ingestion is idempotent — rerunning jobs after rollback is safe by construction.
