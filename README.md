# RIAUWATCH

**"Karhutla, Risiko Kebakaran, dan Kualitas Udara Riau"** — a free, independent public environmental monitoring platform for Riau, Indonesia.

The homepage answers one question within seconds: **"Bagaimana kondisi Riau sekarang?"**

RIAUWATCH aggregates public data (satellite hotspots, air quality, weather) and translates technical environmental information into understandable information for ordinary users. It is **not** a government system, **not** an emergency-response system, and **never** claims certainty it does not have (a satellite hotspot is an indication — **not** a confirmed fire).

- 100% free: no subscription, no premium tier, no paywall.
- Core features require **no login**: map, hotspots, air quality, fire risk, weather, location context.
- Full transparency: every figure carries its source and freshness (see `/data-sources` in the app and `docs/data-sources.md`).

## Status

Active development toward MVP. Backend (ingestion + API + risk engine) and frontend (map + panels + transparency pages) are implemented with green gates; **live verification is pending** — see [Limitations](#limitations) and [Roadmap](#roadmap).

| Area | State |
|---|---|
| Ingestion (FIRMS, Open-Meteo, OpenAQ, boundaries) | Implemented, fixture-tested; live run needs API keys + PostGIS |
| Public API v1 | Implemented, contract-tested |
| Risk engine (rules v0.1) | Implemented, unit-tested incl. worked example |
| Frontend (Next.js + MapLibre) | Implemented; production build green; 14/14 Playwright journeys green (mock mode) |

## Architecture

```
External sources (FIRMS, Open-Meteo, OpenAQ, geoBoundaries)
        │  scheduled fetch (cron → worker CLI)
        ▼
Ingestion Worker (FastAPI codebase, `worker` mode)
  Fetch → Validate → Quarantine → Normalize → Dedupe → Transform → Store → Log
        ▼
PostgreSQL 16 + PostGIS 3  ◄── single source of truth
        ▲
Backend API (FastAPI, `api` mode) — versioned REST, GeoJSON
        ▲
Next.js frontend (Vercel) — MapLibre GL, mock mode for offline dev
        ▲
Public users (no login)
```

Design docs: [`docs/architecture.md`](docs/architecture.md) · [`docs/database.md`](docs/database.md) · [`docs/risk-model.md`](docs/risk-model.md) · [`docs/data-sources.md`](docs/data-sources.md) · [`docs/discovery-report.md`](docs/discovery-report.md) · [`docs/deployment.md`](docs/deployment.md)

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) + TypeScript (strict) + Tailwind CSS + MapLibre GL |
| Basemap | OpenFreeMap (free, no key; OSM attribution) |
| Backend / API | Python + FastAPI + SQLAlchemy 2 + GeoAlchemy2 + Alembic |
| Database | PostgreSQL 16 + PostGIS 3 |
| HTTP client / validation | httpx + pydantic v2 |
| Tests | pytest (backend), Playwright + Vitest-style unit (frontend) |
| E2E browsers | Playwright Chromium |

## Data Sources

| Source | Provides | Terms |
|---|---|---|
| NASA FIRMS | Active-fire hotspots (VIIRS 375 m, MODIS 1 km), confidence values | Open data, attribution; free MAP_KEY required |
| Open-Meteo | Weather forecast + recent model conditions (temp, RH, precipitation, wind) | Free non-commercial, attribution |
| OpenAQ v3 | Ground-station PM2.5/PM10 | Open, attribution; free API key required |
| geoBoundaries + OpenStreetMap | Kabupaten/kota boundaries + basemap | CC-BY 4.0 / ODbL, attribution |
| BMKG | Official forecasts (link-out only for MVP — automated ingestion needs written permission) | Reference use |

Decisions and licensing detail: [`docs/data-sources.md`](docs/data-sources.md). In-app transparency: `/data-sources`.

## Database

PostgreSQL + PostGIS. Tables: `data_sources`, `administrative_areas`, `monitoring_stations`, `hotspots`, `air_quality_observations`, `weather_observations`, `risk_assessments`, `data_ingestion_logs`, `quarantine_rows`. Full DDL, idempotency keys, indexes, and retention: [`docs/database.md`](docs/database.md).

## Environment Variables

Names only — never commit values (see `.env.example` at repo root and `frontend/.env.example`):

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | PostgreSQL connection string |
| `FIRMS_MAP_KEY` | backend | NASA FIRMS API key (free registration) |
| `OPENAQ_API_KEY` | backend | OpenAQ v3 API key (free registration) |
| `FRONTEND_ORIGINS` | backend | CORS allowlist |
| `RATE_LIMIT_PER_MINUTE` | backend | Public API rate limit (default 60) |
| `NEXT_PUBLIC_API_URL` | frontend | Backend base URL (default http://localhost:8000) |
| `NEXT_PUBLIC_USE_MOCKS` | frontend | `true` = realistic mock data with "Data contoh" badge |

## Local Development

Prerequisites: Python 3.12+, Node 22+, and (for live DB work) PostgreSQL 16 + PostGIS 3 — via `docker-compose.yml` where Docker exists.

```powershell
# Backend
Set-Location backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
$env:DATABASE_URL="postgresql+psycopg://user:pass@localhost:5432/riauwatch"
python -m alembic upgrade head
python -m pytest -q
python -m uvicorn app.api.main:create_app --factory --reload --port 8000

# Frontend (mock mode — no backend needed)
Set-Location ..\frontend
npm install
$env:NEXT_PUBLIC_USE_MOCKS="true"; npm run dev   # http://localhost:3000
```

Useful checks: `ruff check .` / `mypy app` (backend); `npx tsc --noEmit`, `npm run lint`, `npm run build` (frontend); `npx playwright test` (frontend E2E, mock mode).

## Data Ingestion

```powershell
# From backend/ with DATABASE_URL set:
python -m app.worker firms-hotspots [--day-range 2]
python -m app.worker weather-points [--past-days 7]   # backfill for risk history
python -m app.worker air-quality
python -m app.worker boundaries-load --file <geojson>
python -m app.worker risk-recompute
```

Every run writes a `data_ingestion_logs` row (inserted as `running` at start), quarantines invalid rows with reasons, respects source rate limits, and is idempotent by construction (unique constraints + `ON CONFLICT` policies per [`docs/database.md`](docs/database.md) §4). Suggested cron cadences: [`docs/architecture.md`](docs/architecture.md) §3.

## API

Base path `/api/v1` (all GET, no auth): `status`, `hotspots`, `hotspots/summary`, `air-quality/latest`, `air-quality/history`, `weather/current`, `weather/forecast`, `risk/current`, `administrative-areas`, `administrative-areas/lookup`, `meta/data-sources`. GeoJSON payloads, RFC 9457 problem+json errors, pagination/bbox caps, per-IP rate limiting. Full table: [`docs/architecture.md`](docs/architecture.md) §4.

## Deployment

See [`docs/deployment.md`](docs/deployment.md) — Vercel frontend steps, portable backend (Dockerfile included), managed-Postgres options, cron setup, and the go-live checklist.

## Testing & Quality Gates

- Backend: 165+ unit tests; integration tests marker-gated (`pytest -m "not integration"` runs anywhere; full suite needs PostGIS).
- Frontend: TypeScript strict, ESLint, production build, 14 Playwright journeys (map, popups, filters, risk, AQ, geolocation granted/denied, mobile, keyboard list, tile-failure fallback, freshness).
- Security: dependency audits clean, repo secret-scan clean, env-only secrets, rate-limited public API, read-only API discipline, no precise user-location storage.
- Provenance: recorded fixtures carry `PROVENANCE.md`; synthetic fixtures are marked SYNTHETIC until live keys verify their shapes.

## Limitations (honest)

- Live ingestion not yet run in production: needs free `FIRMS_MAP_KEY` + `OPENAQ_API_KEY` registrations and a PostGIS-capable database.
- OpenAQ ground-station coverage in Riau may be thin — the app degrades to "Data temporarily unavailable" rather than inventing values; WAQI fallback is designed but not yet built.
- Risk scores are a transparent unvalidated heuristic (rules v0.1), not a validated prediction — labeled as such everywhere.
- BMKG content is link-out/reference only (automated ingestion requires their written permission).
- Map tiles need network access to OpenFreeMap; the app degrades to the accessible data list when tiles fail.
- Screen-reader pass with VoiceOver/NVDA and a real-browser tile check are still recommended.

## Disclaimer

RIAUWATCH is an independent public information platform and an aggregator of public data. It is **not** an official government system, **not** an emergency response system, and **not** a replacement for official disaster information. Satellite hotspots are heat indications, **not** confirmed fires. For emergencies, follow official sources (BMKG, BNPB, and local authorities).

## Roadmap

- Live verification (keys + PostGIS) and OpenAQ Riau coverage decision (WAQI fallback if needed)
- NOAA HMS smoke-layer enhancement; rainfall climatology calibration for risk weights
- Alert/status UI → opt-in browser notifications, then email/Telegram channels
- BMKG written-permission track for official data ingestion
- ML comparison track (logistic regression → gradient boosting) against the rules baseline only after backtestable history exists — never marketed before validation
- Hosting: production deploy per [`docs/deployment.md`](docs/deployment.md)

## License

To be assigned — intended open-source (MIT recommended for code; data remains under its sources' licenses, attributed on `/data-sources`).
