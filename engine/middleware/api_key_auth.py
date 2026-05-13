from __future__ import annotations

import hmac

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class ApiKeyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, api_key: str) -> None:
        super().__init__(app)
        # TODO: store as hash instead of plain string to reduce exposure in memory
        self._api_key = api_key

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/api/health":
            return await call_next(request)

        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer ") and hmac.compare_digest(auth[7:], self._api_key):
            return await call_next(request)

        return JSONResponse(
            status_code=401,
            content={"error": "Unauthorized", "details": "Provide Authorization: Bearer <engine-api-key>"},
        )
