from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass, field

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


@dataclass
class Bucket:
    count: int = 0
    window_start: float = 0.0


class RateLimiter:
    def __init__(self, requests_per_minute: int = 60, requests_per_hour: int = 1000) -> None:
        self._rpm = requests_per_minute
        self._rph = requests_per_hour
        self._minute_buckets: dict[str, Bucket] = {}
        self._hour_buckets: dict[str, Bucket] = defaultdict(lambda: Bucket(count=0, window_start=0.0))

    def check(self, key: str) -> tuple[bool, dict]:
        now = time.time()

        # Per-minute
        minute = self._minute_buckets.get(key)
        if minute is None:
            minute = Bucket(count=0, window_start=now)
            self._minute_buckets[key] = minute

        if now - minute.window_start >= 60:
            minute.count = 0
            minute.window_start = now

        if minute.count >= self._rpm:
            return False, {
                "error": "Rate limit exceeded (per minute)",
                "retry_after": int(60 - (now - minute.window_start)),
                "limit": self._rpm,
                "remaining": 0,
            }

        minute.count += 1

        # Per-hour
        hour = self._hour_buckets[key]
        if now - hour.window_start >= 3600:
            hour.count = 0
            hour.window_start = now

        if hour.count >= self._rph:
            return False, {
                "error": "Rate limit exceeded (per hour)",
                "retry_after": int(3600 - (now - hour.window_start)),
                "limit": self._rph,
                "remaining": 0,
            }

        hour.count += 1

        return True, {
            "remaining": min(
                self._rpm - minute.count,
                self._rph - hour.count,
            ),
        }


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limiter: RateLimiter) -> None:
        super().__init__(app)
        self._limiter = limiter

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        client_ip = request.client.host if request.client else "unknown"
        allowed, info = self._limiter.check(client_ip)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content=info,
                headers={"Retry-After": str(info.get("retry_after", 60))},
            )

        response = await call_next(request)
        remaining = info.get("remaining", -1)
        if remaining >= 0:
            response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
