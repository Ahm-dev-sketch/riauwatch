"""FastAPI app factory for the RIAUWATCH API."""

from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import add_rate_limiting, register_exception_handlers
from app.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    yield


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="RIAUWATCH API",
        description="Public API for fire hotspots, air quality, weather, and fire risk in Riau",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # Vercel Serverless path-restoration middleware
    @app.middleware("http")
    async def restore_vercel_path_middleware(request: Request, call_next: Callable) -> Response:
        matched_path = request.headers.get("x-matched-path") or request.headers.get("x-forwarded-uri")
        if matched_path and matched_path != "/api/index.py" and not matched_path.endswith(".py"):
            # Strip query string if present in header
            clean_path = matched_path.split("?")[0]
            request.scope["path"] = clean_path
        return await call_next(request)

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get_frontend_origins(),
        allow_credentials=False,
        allow_methods=["GET", "HEAD", "OPTIONS"],
        allow_headers=["*"],
    )

    # Rate limiting (in-process, single-instance assumption)
    add_rate_limiting(app)

    # Exception handlers
    register_exception_handlers(app)

    # Root informational endpoint
    @app.get("/", include_in_schema=False)
    @app.get("/api", include_in_schema=False)
    @app.get("/api/index.py", include_in_schema=False)
    async def root_info():
        return {
            "name": "RIAUWATCH API",
            "tagline": "Karhutla, Risiko Kebakaran, dan Kualitas Udara Riau",
            "version": "1.0.0",
            "status": "online",
            "docs": "/docs",
            "api_v1_prefix": "/api/v1",
        }

    # Health check endpoint (no rate limit)
    @app.get("/health", include_in_schema=False)
    async def health_check():
        return {"status": "ok"}

    # Include API routers (support both /api/v1 and /v1 prefixes for proxy compatibility)
    from app.api.routers import (
        administrative_areas,
        air_quality,
        hotspots,
        meta,
        risk,
        status,
        weather,
    )

    for prefix in ("/api/v1", "/v1"):
        app.include_router(status.router, prefix=prefix)
        app.include_router(hotspots.router, prefix=prefix)
        app.include_router(air_quality.router, prefix=prefix)
        app.include_router(weather.router, prefix=prefix)
        app.include_router(risk.router, prefix=prefix)
        app.include_router(administrative_areas.router, prefix=prefix)
        app.include_router(meta.router, prefix=prefix)

    return app
