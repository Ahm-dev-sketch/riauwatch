# RIAUWATCH backend — API + worker image (portable, no Vercel dependency)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv/app

COPY pyproject.toml README.md ./
COPY app ./app
RUN pip install --no-cache-dir -e .

EXPOSE 8000

# API mode (override command for worker jobs, e.g.: python -m app.worker firms-hotspots)
CMD ["python", "-m", "uvicorn", "app.api.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
