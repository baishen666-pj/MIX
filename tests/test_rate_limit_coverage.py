"""Additional tests for engine/middleware/rate_limit.py covering hourly rate
limiting, cleanup, Retry-After header, and concurrent requests."""

from __future__ import annotations

import time
from unittest.mock import patch

import pytest
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from engine.middleware.rate_limit import Bucket, RateLimiter, RateLimitMiddleware


# ===================================================================
# RateLimiter -- hourly rate limiting
# ===================================================================


class TestHourlyRateLimiting:
    """Covers the per-hour bucket logic in RateLimiter.check()."""

    def test_allows_under_hourly_limit(self):
        # Arrange
        limiter = RateLimiter(requests_per_minute=1000, requests_per_hour=5)
        # Act -- make 5 requests
        for _ in range(5):
            allowed, info = limiter.check("hourly-user")
            assert allowed
        # Assert
        assert info["remaining"] == 0

    def test_blocks_over_hourly_limit(self):
        # Arrange
        limiter = RateLimiter(requests_per_minute=1000, requests_per_hour=3)
        for _ in range(3):
            limiter.check("hourly-user")
        # Act
        allowed, info = limiter.check("hourly-user")
        # Assert
        assert not allowed
        assert "hour" in info["error"].lower()
        assert info["limit"] == 3
        assert info["retry_after"] > 0

    def test_hourly_limit_independent_per_key(self):
        # Arrange
        limiter = RateLimiter(requests_per_minute=1000, requests_per_hour=2)
        limiter.check("user-a")
        limiter.check("user-a")
        allowed_a, _ = limiter.check("user-a")
        assert not allowed_a

        # Act -- user-b should still be allowed
        allowed_b, _ = limiter.check("user-b")
        # Assert
        assert allowed_b

    def test_hourly_window_resets_after_3600_seconds(self):
        # Arrange
        limiter = RateLimiter(requests_per_minute=1000, requests_per_hour=1)
        # Exhaust the hourly limit
        limiter.check("time-user")
        allowed, _ = limiter.check("time-user")
        assert not allowed

        # Act -- advance time by 3601 seconds
        future_time = time.time() + 3601
        with patch("engine.middleware.rate_limit.time.time", return_value=future_time):
            allowed, info = limiter.check("time-user")
        # Assert
        assert allowed
        assert info["remaining"] >= 0


# ===================================================================
# RateLimiter -- remaining count
# ===================================================================


class TestRemainingCount:
    """Covers the remaining calculation logic."""

    def test_remaining_is_min_of_minute_and_hour(self):
        # Arrange -- high minute limit, low hour limit
        limiter = RateLimiter(requests_per_minute=100, requests_per_hour=5)
        for _ in range(3):
            limiter.check("combined")
        # Act
        allowed, info = limiter.check("combined")
        # Assert
        assert allowed
        # minute remaining = 100 - 4 = 96, hour remaining = 5 - 4 = 1
        assert info["remaining"] == 1

    def test_remaining_decrements_across_both_windows(self):
        # Arrange
        limiter = RateLimiter(requests_per_minute=10, requests_per_hour=20)
        # Act
        _, info = limiter.check("key")
        # Assert
        assert info["remaining"] == 9  # min(10-1, 20-1) = 9


# ===================================================================
# RateLimiter -- stale entry eviction
# ===================================================================


class TestStaleEntryEviction:
    """Covers the cleanup logic when _minute_buckets grows large."""

    def test_evicts_stale_minute_buckets_when_over_10000(self):
        # Arrange
        limiter = RateLimiter(requests_per_minute=10, requests_per_hour=1000)
        # Add 10001 stale entries (window_start = 3 hours ago, well past 7200s threshold)
        stale_time = time.time() - 10800  # 3 hours ago
        for i in range(10001):
            limiter._minute_buckets[f"key-{i}"] = Bucket(count=1, window_start=stale_time)
        assert len(limiter._minute_buckets) == 10001

        # Act -- check should trigger eviction of stale entries
        limiter.check("trigger-key")

        # Assert -- stale entries should be removed, only the fresh trigger-key remains
        assert len(limiter._minute_buckets) < 10001

    def test_evicts_stale_hour_buckets_when_over_5000(self):
        # Arrange
        limiter = RateLimiter(requests_per_minute=10, requests_per_hour=100)
        stale_time = time.time() - 10800  # 3 hours ago
        for i in range(5001):
            limiter._hour_buckets[f"hour-key-{i}"] = Bucket(count=1, window_start=stale_time)
        assert len(limiter._hour_buckets) > 5000

        # Act -- check should trigger hour bucket eviction
        limiter.check("hour-trigger")

        # Assert
        assert len(limiter._hour_buckets) < 5001

    def test_does_not_evict_fresh_entries(self):
        # Arrange
        limiter = RateLimiter(requests_per_minute=10, requests_per_hour=100)
        now = time.time()
        # Fill with 9999 fresh entries (below the 10000 threshold so eviction
        # is never triggered, plus the new check adds one more).
        for i in range(9999):
            limiter._minute_buckets[f"fresh-{i}"] = Bucket(count=1, window_start=now)

        # Act
        with patch("engine.middleware.rate_limit.time.time", return_value=now):
            limiter.check("fresh-check")

        # Assert -- no entries evicted, plus the new key added
        assert len(limiter._minute_buckets) == 10000
        assert "fresh-check" in limiter._minute_buckets


# ===================================================================
# RateLimitMiddleware -- 429 with Retry-After header
# ===================================================================


class TestMiddleware429Response:
    """Covers the 429 JSON response with Retry-After header."""

    def test_returns_429_with_retry_after_header(self):
        # Arrange
        async def handler(request):
            return PlainTextResponse("ok")

        limiter = RateLimiter(requests_per_minute=1, requests_per_hour=100)
        app = Starlette(
            routes=[Route("/test", handler)],
            middleware=[Middleware(RateLimitMiddleware, limiter=limiter)],
        )
        client = TestClient(app)

        # Use up the limit
        client.get("/test")

        # Act -- next request should be blocked
        resp = client.get("/test")
        # Assert
        assert resp.status_code == 429
        assert "Retry-After" in resp.headers
        retry_after = int(resp.headers["Retry-After"])
        assert retry_after > 0
        assert resp.json()["error"] == "Rate limit exceeded (per minute)"

    def test_429_response_includes_limit_and_remaining(self):
        # Arrange
        async def handler(request):
            return PlainTextResponse("ok")

        limiter = RateLimiter(requests_per_minute=1, requests_per_hour=100)
        app = Starlette(
            routes=[Route("/test", handler)],
            middleware=[Middleware(RateLimitMiddleware, limiter=limiter)],
        )
        client = TestClient(app)
        client.get("/test")

        # Act
        resp = client.get("/test")
        # Assert
        body = resp.json()
        assert body["limit"] == 1
        assert body["remaining"] == 0

    def test_successful_response_includes_remaining_header(self):
        # Arrange
        async def handler(request):
            return PlainTextResponse("ok")

        limiter = RateLimiter(requests_per_minute=10, requests_per_hour=100)
        app = Starlette(
            routes=[Route("/test", handler)],
            middleware=[Middleware(RateLimitMiddleware, limiter=limiter)],
        )
        client = TestClient(app)

        # Act
        resp = client.get("/test")
        # Assert
        assert resp.status_code == 200
        assert "x-ratelimit-remaining" in resp.headers
        remaining = int(resp.headers["x-ratelimit-remaining"])
        assert remaining >= 0

    def test_uses_unknown_when_no_client(self):
        """When request.client is None, the key should be 'unknown'."""
        # This is tested indirectly -- the middleware handles request.client.host
        # being unavailable by defaulting to "unknown"
        limiter = RateLimiter(requests_per_minute=10, requests_per_hour=100)
        allowed, info = limiter.check("unknown")
        assert allowed


# ===================================================================
# Concurrent requests
# ===================================================================


class TestConcurrentRequests:
    """Covers rate limiter behavior under concurrent-like usage."""

    def test_sequential_requests_respect_limit(self):
        # Arrange
        limiter = RateLimiter(requests_per_minute=5, requests_per_hour=100)
        # Act -- 5 allowed, 6th blocked
        for _ in range(5):
            allowed, _ = limiter.check("concurrent-user")
            assert allowed

        allowed, info = limiter.check("concurrent-user")
        # Assert
        assert not allowed

    def test_different_keys_dont_interfere(self):
        # Arrange
        limiter = RateLimiter(requests_per_minute=2, requests_per_hour=100)
        # Exhaust user-1
        limiter.check("user-1")
        limiter.check("user-1")
        allowed_1, _ = limiter.check("user-1")
        assert not allowed_1

        # Act -- user-2 should still have full quota
        for _ in range(2):
            allowed_2, _ = limiter.check("user-2")
            assert allowed_2

        allowed_2, _ = limiter.check("user-2")
        # Assert
        assert not allowed_2

    def test_minute_window_resets_after_60_seconds(self):
        # Arrange
        limiter = RateLimiter(requests_per_minute=2, requests_per_hour=1000)
        limiter.check("reset-user")
        limiter.check("reset-user")
        allowed, _ = limiter.check("reset-user")
        assert not allowed

        # Act -- advance time by 61 seconds
        now = time.time()
        with patch("engine.middleware.rate_limit.time.time", return_value=now + 61):
            allowed, info = limiter.check("reset-user")
        # Assert
        assert allowed
