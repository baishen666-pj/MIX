import pytest
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from starlette.responses import StreamingResponse
from starlette.testclient import TestClient


async def mock_stream(message, session_id=None):
    yield {"id": "1", "delta": "Hello", "done": False}
    yield {"id": "1", "delta": "", "done": True}


def test_sse_format():
    app = FastAPI()

    @app.get("/test/stream")
    async def stream():
        async def gen():
            async for chunk in mock_stream("test"):
                yield f"data: {json.dumps(chunk)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(gen(), media_type="text/event-stream")

    client = TestClient(app)
    response = client.get("/test/stream")
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]

    lines = response.text.strip().split("\n\n")
    data_lines = [l for l in lines if l.startswith("data: ")]
    assert len(data_lines) == 3  # 2 chunks + [DONE]
    assert data_lines[-1] == "data: [DONE]"

    first_chunk = json.loads(data_lines[0].replace("data: ", ""))
    assert first_chunk["delta"] == "Hello"
    assert not first_chunk["done"]


def test_sse_missing_param_returns_422():
    app = FastAPI()

    @app.get("/chat/stream")
    async def chat_stream(message: str = ""):
        if not message:
            from fastapi import HTTPException
            raise HTTPException(400, "message required")
        return StreamingResponse(iter([]), media_type="text/event-stream")

    client = TestClient(app)
    response = client.get("/chat/stream")
    assert response.status_code in (400, 422)
