import pytest
from unittest.mock import AsyncMock, MagicMock

from engine.middleware.rate_limit import RateLimiter, RateLimitMiddleware


# --- Unit: RateLimiter core logic ---


def test_allows_under_limit() -> None:
    limiter = RateLimiter(requests_per_minute=5, requests_per_hour=100)
    for _ in range(5):
        allowed, info = limiter.check("user1")
        assert allowed
    assert info["remaining"] == 0


def test_blocks_over_minute_limit() -> None:
    limiter = RateLimiter(requests_per_minute=3, requests_per_hour=1000)
    for _ in range(3):
        limiter.check("user1")

    allowed, info = limiter.check("user1")
    assert not allowed
    assert info["error"] == "Rate limit exceeded (per minute)"
    assert info["limit"] == 3
    assert info["retry_after"] > 0


def test_independent_keys() -> None:
    limiter = RateLimiter(requests_per_minute=2, requests_per_hour=100)
    limiter.check("user1")
    limiter.check("user1")

    allowed, _ = limiter.check("user1")
    assert not allowed

    allowed2, info2 = limiter.check("user2")
    assert allowed2


def test_remaining_decrements() -> None:
    limiter = RateLimiter(requests_per_minute=10, requests_per_hour=100)
    _, info1 = limiter.check("key")
    assert info1["remaining"] == 9
    _, info2 = limiter.check("key")
    assert info2["remaining"] == 8


# --- Integration: FastAPI middleware ---


@pytest.mark.asyncio
async def test_middleware_passes_within_limit() -> None:
    from starlette.testclient import TestClient
    from starlette.applications import Starlette
    from starlette.middleware import Middleware
    from starlette.responses import PlainTextResponse
    from starlette.routing import Route

    async def handler(request):
        return PlainTextResponse("ok")

    limiter = RateLimiter(requests_per_minute=10, requests_per_hour=100)
    app = Starlette(
        routes=[Route("/test", handler)],
        middleware=[Middleware(RateLimitMiddleware, limiter=limiter)],
    )

    client = TestClient(app)
    resp = client.get("/test")
    assert resp.status_code == 200
    assert resp.headers.get("x-ratelimit-remaining") is not None


@pytest.mark.asyncio
async def test_middleware_returns_429_over_limit() -> None:
    from starlette.testclient import TestClient
    from starlette.applications import Starlette
    from starlette.middleware import Middleware
    from starlette.responses import PlainTextResponse
    from starlette.routing import Route

    async def handler(request):
        return PlainTextResponse("ok")

    limiter = RateLimiter(requests_per_minute=2, requests_per_hour=100)
    app = Starlette(
        routes=[Route("/test", handler)],
        middleware=[Middleware(RateLimitMiddleware, limiter=limiter)],
    )

    client = TestClient(app)
    client.get("/test")
    client.get("/test")
    resp = client.get("/test")
    assert resp.status_code == 429
    assert "Retry-After" in resp.headers
    assert resp.json()["error"] == "Rate limit exceeded (per minute)"
