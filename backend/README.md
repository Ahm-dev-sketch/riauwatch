# RIAUWATCH Backend

FastAPI service with two runtime modes (same codebase):

- **API mode** — public read API: `python -m uvicorn app.api.main:create_app --factory --port 8000`
- **Worker mode** — ingestion jobs: `python -m app.worker {firms-hotspots,weather-points,air-quality,boundaries-load,risk-recompute}`

Full docs: `../docs/architecture.md`, `../docs/database.md`, `../docs/risk-model.md`, `../docs/deployment.md`.

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
$env:DATABASE_URL="postgresql+psycopg://user:pass@localhost:5432/riauwatch"
python -m alembic upgrade head
python -m pytest -q
```
