# RIAUWATCH — Architecture Proposal (Phase 2)

**Date:** 2026-08-24 · **Status:** PROPOSAL — pending user confirmation before Phase 3
Companion docs: `data-sources.md` (adopted sources), `database.md` (schema), `risk-model.md` (scoring).

## 1. Principles

1. **Data validity first** — never fabricate; freshness always visible; observed vs derived clearly separated.
2. **No external API calls on browser request paths** — users read from our database, never directly from FIRMS/Open-Meteo/OpenAQ.
3. **Free & portable** — open-source stack only; backend must run anywhere Docker runs; no Vercel-specific backend dependencies.
4. **No-login public core** — map, hotspots, AQ, risk, weather are anonymous reads.
5. **Fail loudly internally, degrade gracefully publicly** — failed ingestion is logged and surfaced as "Data temporarily unavailable / may be delayed", never hidden.

## 2. High-Level Topology

```
External sources (FIRMS, Open-Meteo, OpenAQ, geoBoundaries)
        │  scheduled fetch (cron → worker CLI)
        ▼
Ingestion Worker (FastAPI codebase, `worker` runtime mode)
  Fetch → Validate → Normalize → Dedupe → Transform → Store → Log
        ▼
PostgreSQL 16 + PostGIS 3  ◄── single source of truth
        ▲
        │  read-only queries
Backend API (FastAPI, `api` runtime mode)  ── versioned REST, GeoJSON
        ▲
Next.js frontend (Vercel) ── MapLibre GL, SSR pages + client map
        ▲
Public users (no login required)
```

One Python codebase, two runtime modes (`api` = uvicorn; `worker` = CLI commands invoked by cron). This keeps deployment simple while enforcing that ingestion never runs inside request handlers.

## 3. Component Decisions

### Frontend — Next.js + TypeScript + Tailwind CSS
- App Router, server components for text/status content (fast first paint, SEO), client components only where interactivity demands (map, filters).
- MapLibre GL JS chosen over Leaflet: vector rendering + native clustering handle hotspot scale better; Leaflet remains a documented fallback if tile/vector constraints change.
- Deployable to Vercel; no backend logic embedded in the frontend.
- Exact framework versions pinned at scaffolding time (latest stable then) — not guessed now.

### Backend — FastAPI (Python). Laravel considered and rejected.
Rationale for Python/FastAPI:
1. Geospatial processing (point-in-polygon admin assignment, spatial aggregation) leans on geopandas/shapely/pyproj — mature in Python, weak in PHP.
2. The brief's future ML track (LR→RF/XGBoost/LightGBM, evaluation harness) is Python-native; same-language evolution avoids a second service later.
3. Ingestion is I/O-bound HTTP work — httpx async + pydantic validation fit naturally.
Laravel rejection reasons: weaker GIS ecosystem, ML would still require Python, and there is zero existing PHP code constraining us despite the Laragon host. If long-term maintenance by a PHP-only team ever becomes decisive, this decision can be revisited before heavy investment — flagged here deliberately.

### Database — PostgreSQL 16 + PostGIS 3
Single store for operational data, history, and ingestion observability. Schema in `docs/database.md`. Local dev via Docker Compose (Windows/Laragon parity risk mitigated by containerized Postgres).

### Scheduling — system cron → worker CLI
Cron table (initial):

| Job | Cadence | Rationale |
|---|---|---|
| firms_hotspots | every 2 h | NRT latency ~3 h; more frequent adds nothing |
| weather_points | every 2 h | forecast cycles + recent-past refresh |
| air_quality | every 2 h | station reporting cadence 1–6 h |
| boundaries_refresh | weekly | static releases |
| risk_recompute | event-driven after above | see risk-model.md |

Jitter/staggering between jobs; frequencies matched to source reality (no browser polling faster than source updates).

### Caching — deferred Redis, cheap first
MVP: HTTP `Cache-Control`/ETag on API responses + short-TTL server-side memoization. Redis enters only when measured need appears (concurrent load, rate-limit shaping). Architecture leaves a clean slot for it; not provisioned now (operational-cost priority).

## 4. API Proposal (v1)

Base path `/api/v1`. All public, no auth. Geo payloads = GeoJSON. Errors = RFC 9457 problem+json, generic messages externally, details in logs.

| Endpoint | Purpose |
|---|---|
| `GET /status` | Per-domain last-observation timestamps + degraded flags (powers freshness UI) |
| `GET /hotspots?bbox&date_from&date_to&kabupaten_id&min_confidence&limit&offset` | Hotspot features (capped page size, bbox max area enforced) |
| `GET /hotspots/summary?date_from&date_to&group_by=kabupaten` | Counts for headline stats |
| `GET /air-quality/latest?near=lat,lon\|kabupaten_id` | Nearest stations: value, category, observed_at age |
| `GET /air-quality/history?station_id&from&to` | Time series |
| `GET /weather/current?near=lat,lon\|kabupaten_id` | Latest observed/model conditions |
| `GET /weather/forecast?lat&lon` | Short-range forecast |
| `GET /risk/current?kabupaten_id\|all` | Levels + explainable factors jsonb |
| `GET /administrative-areas?level=kabupaten_kota` | Boundary GeoJSON |
| `GET /meta/data-sources` | Source registry powering `/data-sources` transparency page |

Conventions: pagination caps; `bbox` validated (≤ ~1°×1°); parameterized queries only; CORS restricted to frontend origin; per-IP rate limit (~60 req/min burst) at API layer; internal ingestion triggers are CLI/cron-only, never HTTP-exposed in MVP.

## 5. Data Ingestion Design

Stages (per source adapter): **Fetch** (httpx, timeouts, ≤3 retries w/ exponential backoff + jitter) → **Validate** (pydantic schemas; invalid rows quarantined + counted, never silently dropped) → **Normalize** (units, UTC timestamptz, confidence vocabularies, EPSG:4326) → **Dedupe** (DB unique constraints + `ON CONFLICT` upserts — reruns are safe by construction) → **Transform** (admin-area assignment via `ST_Covers`, derived fields) → **Store** (batched inserts) → **Log** (mandatory `data_ingestion_logs` row: success/partial/failed, counts, error detail, params, window covered).

Rate-limit awareness: per-source minimum-interval clients sized to documented limits (FIRMS ~5,000 tx/10 min; Open-Meteo ~10 req/s; OpenAQ free tier ~60 req/min — exact numbers re-verified live in Phase 3).

Failure handling: any exception ⇒ log row with status `failed`/`partial`; `/status` flips domain to degraded after N consecutive failures; UI shows staleness messaging. No retry storms: backoff caps + cron cadence bounds attempts.

Observability MVP: structured JSON logs + ingestion-log table + `/status`. External alerting/metrics intentionally out of MVP scope.

## 6. Testing Strategy

- **Unit (pytest):** validators, normalizers, unit conversions, risk scoring incl. missing-factor renormalization and threshold boundaries.
- **Integration (real Postgres+PostGIS via Docker):** ingestion idempotency (same fixture twice ⇒ identical row count), duplicate-prevention under unique keys, geospatial correctness (Pekanbaru centroid falls inside its kabupaten polygon), API contract tests (FastAPI TestClient).
- **Fixtures:** recorded sample responses from each live source checked into `tests/fixtures/` with provenance notes; adapters tested against fixtures, live calls verified separately in Phase 3 validation tasks.
- **Frontend:** Vitest + Testing Library for freshness/unavailable-state rendering; Playwright E2E covering the ten critical journeys (no-login load, map, hotspot layer/popup, filters, risk, AQ, geolocation, mobile layout, stale/unavailable states).
- **Gates per phase:** ruff + mypy (backend), eslint + tsc (frontend), full test suite, production build. Security: pip-audit/npm audit + gitleaks pre-commit/CI.

## 7. Security Considerations

- Secrets env-only; `.env.example` documents names/structure only; gitleaks blocks commits.
- All external data treated as untrusted input: schema-validated before storage.
- Public API: strict query validation, pagination/bbox caps, rate limiting, CORS allowlist, secure headers, no internal error leakage.
- Privacy: browser geolocation stays client-side; precise coordinates never persisted server-side; only coarse kabupaten-level context computed from them.
- Supply chain: pinned dependencies + lockfiles committed; automated dependency auditing.
- No client-side secrets; frontend holds only public URLs.

## 8. Implementation Plan (Phases 3–12)

| Phase | Scope | Exit criteria |
|---|---|---|
| 3 Ingestion | Live keys registered; FIRMS + Open-Meteo + OpenAQ + boundaries adapters; logs | Live end-to-end ingest into local PostGIS; idempotency tests green; real-data shape verified against assumptions |
| 4 API | v1 endpoints + status | Contract tests pass; freshness/degraded semantics correct |
| 5 Map | MapLibre map, hotspot layer, popups, filters, legend | E2E journeys 1–5 pass with real data |
| 6 Air quality | AQ panels, nearest-station, history, unavailable states | Stale/unavailable messaging verified against real gaps |
| 7 Fire risk | Risk computation + explainable UI | Risk unit/integration tests green; disclaimers present |
| 8 Weather + location | Weather panels, geolocation context | Privacy checklist met; journey 8 passes |
| 9 Responsive UX | Mobile refinement, accessibility, hierarchy | Designer review done; keyboard/ARIA checks pass |
| 10 QA + security | Full E2E suite, audits, hardening | All gates green; findings remediated |
| 11 Deploy | Prod topology, CI/CD, monitoring basics | Production build deployed; smoke tests pass (**checkpoint before this phase**) |
| 12 Docs | README + docs set finalized | Docs match running system |

## 9. Open Decisions (explicitly NOT assumed)

1. **Map basemap tiles** — candidate free providers (OpenFreeMap, Carto non-commercial tier, OSM raster policy) have licensing nuances; verify terms during Phase 5 prep. Marked UNVERIFIED until checked.
2. **Production hosting for DB + worker** — cost/portability trade-offs (managed Postgres vs self-host VPS vs Fly.io/Railway-class). Decision due at the Phase 11 checkpoint, not now.
3. **BMKG** — user decided: link-out only for MVP. A written-permission track may be revisited post-MVP.
4. **Redis/cache layer** — revisit on measured load evidence.
