from __future__ import annotations

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

import logging

log = logging.getLogger("mix.http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("x-request-id", uuid.uuid4().hex[:12])
        start = time.monotonic()

        log.info(
            "%s %s request_id=%s",
            request.method,
            request.url.path,
            request_id,
        )

        response = await call_next(request)

        elapsed_ms = (time.monotonic() - start) * 1000
        log.info(
            "%s %s %d %.0fms request_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            request_id,
        )

        response.headers["X-Request-ID"] = request_id
        return response
