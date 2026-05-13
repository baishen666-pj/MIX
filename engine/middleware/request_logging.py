from __future__ import annotations

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from engine.utils.logging import get_logger, request_id_var

log = get_logger("mix.http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("x-request-id", uuid.uuid4().hex[:12])
        token = request_id_var.set(request_id)
        start = time.monotonic()

        try:
            log.info(
                "%s %s",
                request.method,
                request.url.path,
            )

            response = await call_next(request)

            elapsed_ms = (time.monotonic() - start) * 1000
            log.info(
                "%s %s %d %.0fms",
                request.method,
                request.url.path,
                response.status_code,
                elapsed_ms,
            )

            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            request_id_var.reset(token)
