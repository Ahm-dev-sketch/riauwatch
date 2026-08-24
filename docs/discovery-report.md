# RIAUWATCH — Phase 0 Discovery Report

**Date:** 2026-08-24 · **Branch:** `phase-0-discovery` · **Path inspected:** `D:\laragon\www\riauwatch`

## Executive Summary

The repository directory was completely empty at inspection time: no source code, no package manifests, no configuration files, and no version history existed. RIAUWATCH is therefore a **greenfield build** — there is no existing functionality to preserve, no legacy stack constraint, and no in-repo infrastructure to reuse. Git was initialized during this phase on branch `phase-0-discovery`. The recommended direction follows the project brief: a Next.js/TypeScript/Tailwind frontend deployable to Vercel, a portable ingestion/API service backed by PostgreSQL+PostGIS, MapLibre-based mapping, and scheduled ingestion restricted to openly licensed sources validated in Phase 1 (`docs/data-sources.md`). No application code has been written; architecture design (Phase 2) awaits explicit confirmation.

## Current Stack

None. The directory contained zero entries — no `package.json`, no lockfiles, no framework artifacts, no language runtime configuration. There is no existing stack to identify. Package manager selection will happen at scaffolding time (npm/pnpm for the frontend; pip/uv for any Python service).

## Existing Architecture

None. No application, service, or pipeline code exists. No monorepo/workspace layout, no routing, no API surface.

## Existing Database/Backend

None. No database schemas, migrations, ORM configs, connection strings, or backend services exist. Note: the host machine runs Laragon (a Windows local dev stack commonly used for PHP/MySQL), but nothing in this project currently uses it. PostgreSQL+PostGIS is not provisioned locally yet.

## Existing Frontend Structure

None. No pages, components, styles, or asset directories exist.

## Existing Reusable Components

Nothing reusable exists inside the repository. Host-environment conveniences only: Laragon for local web serving (unused so far), and whatever runtimes (Node.js, Python, Docker) are installed system-wide — these were not yet exercised and must be verified during scaffolding.

## Existing Testing Setup

None. No test runners, specs, fixtures, CI workflows, or E2E harnesses exist. The testing strategy (unit, integration, ingestion idempotency, geospatial queries, risk calculation, Playwright E2E) will be established from scratch in later phases.

## Existing Deployment Setup

None. No Dockerfiles, CI/CD pipelines, hosting configs, or domain/DNS artifacts exist. Target direction per brief: frontend on Vercel; ingestion/backend kept portable (not Vercel-locked). Concrete hosting for the database and scheduled worker has cost/licensing consequences and will be surfaced as a decision point in the Phase 2 proposal.

## Environment Configuration Structure

No environment files exist (`.env`, `.env.local`, or similar) — there are no secrets present, so there was nothing to inspect or expose. Baseline policy going forward:

- Secrets only via environment variables; never hardcoded, logged, or committed.
- `.gitignore` (added this phase) excludes `.env*` while allowing `.env.example`.
- `.env.example` will document variable **names and structure only** (e.g., `FIRMS_MAP_KEY=`, `OPENAQ_API_KEY=`), never values.

## What Can Be Reused

- Nothing in-repo (empty start).
- Newly created this phase: git repository on `phase-0-discovery`, `.gitignore`, `docs/discovery-report.md`, `docs/data-sources.md`.
- Phase 1 research results (source licensing/rate-limit findings) are directly reusable as ingestion design input.

## What Is Missing

Everything required for a running platform:

- Project scaffolding (frontend app, backend/ingestion service, workspace layout)
- Database provisioning + PostGIS extension + schema/migrations
- Ingestion pipeline (fetch → validate → normalize → dedupe → store → log)
- Public API layer
- Map/UI, risk-scoring module, alert/status UI
- Tests (unit/integration/E2E), lint/format tooling, CI
- Deployment configuration and monitoring/observability
- Transparency pages (`/data-sources`, disclaimers), SEO assets, README/docs set

## Potential Technical Risks

1. **PM2.5 ground-station scarcity in Riau** — OpenAQ coverage for Riau appears thin (exact station count unverified). Air-quality features must degrade gracefully ("Data temporarily unavailable") rather than fabricate values.
2. **BMKG / KLHK terms restrict automated ingestion** — official Indonesian weather/AQ data cannot be auto-pulled without written permission. Primary pipelines therefore rely on open alternatives (Open-Meteo, OpenAQ); BMKG becomes link-out/reference or a later formal-permission track.
3. **FIRMS MAP_KEY dependency** — hotspots ingestion is blocked until a free key is registered; a missing-key state must be handled, not hidden.
4. **Interpretation risk** — satellite hotspots ≠ confirmed fires. Pipeline must preserve confidence fields; UI must carry the disclaimer everywhere hotspots appear.
5. **Dev/prod parity** — Windows/Laragon development vs Linux production; PostGIS provisioning differs locally (Docker recommended for reproducibility).
6. **Split-deployment complexity** — Vercel frontend + portable worker/database introduces scheduling and hosting decisions with real cost implications (flagged for the Phase 2 checkpoint).
7. **Licensing drift** — source terms change over time; `docs/data-sources.md` must carry a review cadence.
8. **Single-source fragility for air quality** — if OpenAQ Riau coverage proves too thin, a secondary source (WAQI/PurpleAir, both conditional) or explicit unavailability messaging is required.

## Recommended Architecture Direction

Aligned with the brief and Phase 1 findings:

- **Frontend:** Next.js + TypeScript + Tailwind CSS, server-rendered public pages, deployable to Vercel. MapLibre GL preferred over Leaflet for vector rendering/clustering at scale; Leaflet remains an acceptable fallback.
- **Database:** PostgreSQL + PostGIS as the single source of truth (hotspots, air quality, weather observations, admin areas, risk assessments, sources, ingestion logs).
- **Backend/ingestion:** a portable service, cleanly separated from the frontend. Recommendation: **Python/FastAPI** for the ingestion+API service — strongest geospatial ecosystem (geopandas/shapely/pyproj) and a natural path to the future ML horizons named in the brief. Laravel is viable if long-term PHP maintenance is decisive; final rationale will be presented in the Phase 2 proposal before any code.
- **Scheduling:** cron-driven ingestion matched to each source's real update frequency (FIRMS ~every few hours; weather 1–6 h; AQ 1–6 h). No browser polling faster than source refresh.
- **Deferred decisions (cost/portability consequences):** managed Postgres provider vs self-hosted, worker hosting, optional Redis cache. These will be presented explicitly at the Phase 2 checkpoint, not assumed.
