"""Error handling utilities for the API."""

import logging
import time
from collections import defaultdict

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.api.models import ProblemDetail
from app.settings import settings

logger = logging.getLogger(__name__)


_HTTP_TITLES = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    422: "Validation Error",
    429: "Too Many Requests",
    500: "Internal Server Error",
    503: "Service Unavailable",
}


def _http_title(status_code: int) -> str:
    """Map an HTTP status code to a short problem title."""
    return _HTTP_TITLES.get(status_code, "Error")


def create_problem_response(
    request: Request,
    status_code: int,
    title: str,
    detail: str,
    type_: str = "about:blank",
) -> JSONResponse:
    """Create a RFC 9457 problem+json response."""
    problem = ProblemDetail(
        type=type_,
        title=title,
        status=status_code,
        detail=detail,
        instance=str(request.url),
    )
    return JSONResponse(
        status_code=status_code,
        content=problem.model_dump(mode="json"),
        media_type="application/problem+json",
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers on the FastAPI app."""

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        """Return HTTP errors (404, 422 raised in code, etc.) as problem+json."""
        logger.warning(
            "HTTP error",
            extra={"path": str(request.url), "status": exc.status_code, "detail": exc.detail},
        )
        return create_problem_response(
            request,
            exc.status_code,
            _http_title(exc.status_code),
            str(exc.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Handle 422 validation errors."""
        # Log the validation error details server-side
        logger.warning(
            "Validation error",
            extra={
                "path": str(request.url),
                "errors": exc.errors(),
            },
        )
        # Return generic message externally, but include field info
        details = []
        for error in exc.errors():
            loc = " -> ".join(str(x) for x in error["loc"])
            details.append(f"{loc}: {error['msg']}")
        detail = "Request validation failed: " + "; ".join(details)
        return create_problem_response(
            request,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Validation Error",
            detail,
            type_="https://tools.ietf.org/html/rfc9457#section-3.1",
        )

    @app.exception_handler(ValidationError)
    async def pydantic_validation_exception_handler(
        request: Request, exc: ValidationError
    ) -> JSONResponse:
        """Handle Pydantic validation errors."""
        logger.warning(
            "Pydantic validation error",
            extra={"path": str(request.url), "errors": exc.errors()},
        )
        return create_problem_response(
            request,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Validation Error",
            "Request data validation failed",
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(
        request: Request, exc: SQLAlchemyError
    ) -> JSONResponse:
        """Handle database errors - never leak SQL details."""
        logger.exception(
            "Database error",
            extra={"path": str(request.url)},
        )
        return create_problem_response(
            request,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Internal Server Error",
            "A database error occurred. Please try again later.",
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """Catch-all handler for unexpected errors."""
        logger.exception(
            "Unhandled exception",
            extra={"path": str(request.url)},
        )
        return create_problem_response(
            request,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Internal Server Error",
            "An unexpected error occurred. Please try again later.",
        )


# =============================================================================
# Rate Limiting Middleware (in-process, single-instance)
# =============================================================================


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    In-process sliding window rate limiter.

    NOTE: This is per-process and assumes a single API instance (MVP).
    For multi-instance deployments, replace with Redis-backed limiter.
    """

    def __init__(self, app: FastAPI, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.window_seconds = 60
        # In-memory store: {ip: [(timestamp, count), ...]}
        self._requests: dict[str, list[tuple[float, int]]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP, considering proxies."""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _clean_old_requests(self, ip: str, now: float) -> None:
        """Remove requests older than the window."""
        cutoff = now - self.window_seconds
        self._requests[ip] = [
            (ts, count) for ts, count in self._requests[ip] if ts > cutoff
        ]

    def _get_request_count(self, ip: str, now: float) -> int:
        """Get total request count in current window."""
        self._clean_old_requests(ip, now)
        return sum(count for _, count in self._requests[ip])

    def _add_request(self, ip: str, now: float) -> None:
        """Add a request to the window."""
        self._requests[ip].append((now, 1))

    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]
        # Skip rate limiting for health checks if needed
        if request.url.path in ("/health", "/healthz", "/ready"):
            response: Response = await call_next(request)
            return response

        client_ip = self._get_client_ip(request)
        now = time.time()

        current_count = self._get_request_count(client_ip, now)

        if current_count >= self.requests_per_minute:
            # Calculate retry-after
            oldest_in_window = min(
                (ts for ts, _ in self._requests[client_ip]), default=now
            )
            retry_after = int(self.window_seconds - (now - oldest_in_window)) + 1

            logger.warning(
                "Rate limit exceeded",
                extra={
                    "ip": client_ip,
                    "path": str(request.url),
                    "count": current_count,
                    "limit": self.requests_per_minute,
                },
            )
            resp = create_problem_response(
                request,
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too Many Requests",
                f"Rate limit exceeded. Maximum {self.requests_per_minute} requests per minute.",
                type_="https://tools.ietf.org/html/rfc9457#section-3.1",
            )
            resp.headers["Retry-After"] = str(retry_after)
            return resp

        self._add_request(client_ip, now)
        response = await call_next(request)

        # Add rate limit headers
        remaining = max(0, self.requests_per_minute - current_count - 1)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(now + self.window_seconds))

        final_response: Response = response
        return final_response


def add_rate_limiting(app: FastAPI) -> None:
    """Add rate limiting middleware to the app."""
    app.add_middleware(
        RateLimitMiddleware,  # type: ignore[arg-type]
        requests_per_minute=settings.rate_limit_per_minute,
    )
