"""FastAPI app factory for the RIAUWATCH API."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import add_rate_limiting, register_exception_handlers
from app.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    yield
    # Shutdown (if needed)


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

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_origins,
        allow_credentials=False,
        allow_methods=["GET", "HEAD", "OPTIONS"],
        allow_headers=["*"],
    )

    # Rate limiting (in-process, single-instance assumption)
    add_rate_limiting(app)

    # Exception handlers
    register_exception_handlers(app)

    # Health check endpoint (no rate limit)
    @app.get("/health", include_in_schema=False)
    async def health_check():
        return {"status": "ok"}

    # Include API routers
    from app.api.routers import (
        administrative_areas,
        air_quality,
        hotspots,
        meta,
        risk,
        status,
        weather,
    )

    app.include_router(status.router, prefix="/api/v1")
    app.include_router(hotspots.router, prefix="/api/v1")
    app.include_router(air_quality.router, prefix="/api/v1")
    app.include_router(weather.router, prefix="/api/v1")
    app.include_router(risk.router, prefix="/api/v1")
    app.include_router(administrative_areas.router, prefix="/api/v1")
    app.include_router(meta.router, prefix="/api/v1")

    return app
