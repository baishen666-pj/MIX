from starlette.testclient import TestClient
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.responses import PlainTextResponse
from starlette.routing import Route

from engine.middleware.request_logging import RequestLoggingMiddleware


def test_logging_adds_request_id_header() -> None:
    async def handler(request):
        return PlainTextResponse("ok")

    app = Starlette(
        routes=[Route("/test", handler)],
        middleware=[Middleware(RequestLoggingMiddleware)],
    )

    client = TestClient(app)
    resp = client.get("/test")
    assert resp.status_code == 200
    assert "x-request-id" in resp.headers
    assert len(resp.headers["x-request-id"]) == 12


def test_logging_preserves_custom_request_id() -> None:
    async def handler(request):
        return PlainTextResponse("ok")

    app = Starlette(
        routes=[Route("/test", handler)],
        middleware=[Middleware(RequestLoggingMiddleware)],
    )

    client = TestClient(app)
    resp = client.get("/test", headers={"X-Request-ID": "custom-id-123"})
    assert resp.headers["x-request-id"] == "custom-id-123"
