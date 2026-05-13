"""Tests for engine.middleware.api_key_auth -- ApiKeyMiddleware."""

from __future__ import annotations

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from engine.middleware.api_key_auth import ApiKeyMiddleware

SECRET_KEY = "test-secret-key-12345"


def _make_app(api_key: str = SECRET_KEY) -> Starlette:
    async def handler(request):
        return PlainTextResponse("ok")

    return Starlette(
        routes=[
            Route("/api/health", handler),
            Route("/api/data", handler),
        ],
        middleware=[Middleware(ApiKeyMiddleware, api_key=api_key)],
    )


class TestApiKeyMiddlewareValidKey:
    def test_valid_bearer_token_passes(self) -> None:
        # Arrange
        app = _make_app()
        client = TestClient(app)

        # Act
        resp = client.get("/api/data", headers={"Authorization": f"Bearer {SECRET_KEY}"})

        # Assert
        assert resp.status_code == 200
        assert resp.text == "ok"


class TestApiKeyMiddlewareInvalidKey:
    def test_wrong_key_returns_401(self) -> None:
        # Arrange
        app = _make_app()
        client = TestClient(app)

        # Act
        resp = client.get("/api/data", headers={"Authorization": "Bearer wrong-key"})

        # Assert
        assert resp.status_code == 401
        assert resp.json()["error"] == "Unauthorized"

    def test_empty_bearer_returns_401(self) -> None:
        # Arrange
        app = _make_app()
        client = TestClient(app)

        # Act
        resp = client.get("/api/data", headers={"Authorization": "Bearer "})

        # Assert
        assert resp.status_code == 401


class TestApiKeyMiddlewareMissingKey:
    def test_no_authorization_header_returns_401(self) -> None:
        # Arrange
        app = _make_app()
        client = TestClient(app)

        # Act
        resp = client.get("/api/data")

        # Assert
        assert resp.status_code == 401

    def test_non_bearer_scheme_returns_401(self) -> None:
        # Arrange
        app = _make_app()
        client = TestClient(app)

        # Act
        resp = client.get("/api/data", headers={"Authorization": f"Basic {SECRET_KEY}"})

        # Assert
        assert resp.status_code == 401

    def test_malformed_header_returns_401(self) -> None:
        # Arrange
        app = _make_app()
        client = TestClient(app)

        # Act
        resp = client.get("/api/data", headers={"Authorization": "BearerExtraStuff"})

        # Assert
        assert resp.status_code == 401


class TestApiKeyMiddlewareHealthBypass:
    def test_health_endpoint_skips_auth(self) -> None:
        # Arrange
        app = _make_app()
        client = TestClient(app)

        # Act -- no Authorization header at all
        resp = client.get("/api/health")

        # Assert
        assert resp.status_code == 200
        assert resp.text == "ok"

    def test_health_endpoint_ignores_bad_key(self) -> None:
        # Arrange
        app = _make_app()
        client = TestClient(app)

        # Act -- wrong key on health endpoint still passes
        resp = client.get("/api/health", headers={"Authorization": "Bearer wrong"})

        # Assert
        assert resp.status_code == 200


class TestApiKeyMiddlewareErrorBody:
    def test_error_response_includes_details(self) -> None:
        # Arrange
        app = _make_app()
        client = TestClient(app)

        # Act
        resp = client.get("/api/data")

        # Assert
        body = resp.json()
        assert "error" in body
        assert "details" in body
        assert "Bearer" in body["details"]
