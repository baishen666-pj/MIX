"""End-to-end integration tests for Engine API endpoints.

Uses FastAPI TestClient with a mocked LLM provider to test
the full request->response pipeline without real API calls.
"""

import json
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch
from starlette.testclient import TestClient

from engine.config import (
    MixConfig, ProviderConfig, EngineConfig, GatewayConfig,
    MemoryConfig, RateLimitConfig,
)
from engine.main import create_app


@pytest.fixture
def test_config(tmp_path: Path) -> MixConfig:
    return MixConfig(
        engine=EngineConfig(host="127.0.0.1", port=18700),
        gateway=GatewayConfig(host="127.0.0.1", port=18789),
        llm=ProviderConfig(provider="openai", model="gpt-4", api_key="test-key"),
        memory=MemoryConfig(db_path=tmp_path / "test.db", max_entries=100),
        rate_limit=RateLimitConfig(enabled=False),
    )


@pytest.fixture
def mock_llm():
    with patch("engine.agent.loop.create_provider") as mock_create:
        async def fake_complete(messages, tools=None, **kwargs):
            return {"content": "Hello! I am MIX bot.", "tool_calls": None}

        async def fake_stream(messages, tools=None, **kwargs):
            yield {"delta": "Hello!", "done": False, "tool_calls": None}
            yield {"delta": " I am MIX.", "done": False, "tool_calls": None}
            yield {"delta": "", "done": True, "tool_calls": None}

        provider = AsyncMock()
        provider.complete = fake_complete
        provider.stream = fake_stream
        mock_create.return_value = provider
        yield provider


@pytest.fixture
def client(test_config: MixConfig, mock_llm):
    app = create_app(test_config)
    with TestClient(app) as c:
        yield c


class TestEngineHealth:
    def test_health_returns_ok(self, client: TestClient):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["engine"] == "mix-python"
        assert "version" in data


class TestEngineChat:
    def test_chat_returns_response(self, client: TestClient):
        resp = client.post("/api/chat", json={
            "message": "Hello",
            "session_id": "e2e-chat-1",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert "session_id" in data
        assert data["content"] == "Hello! I am MIX bot."

    def test_chat_with_session_id(self, client: TestClient):
        resp = client.post("/api/chat", json={
            "message": "Hello",
            "session_id": "test-session-1",
        })
        assert resp.status_code == 200
        assert resp.json()["session_id"] == "test-session-1"

    def test_chat_empty_message_works_with_session(self, client: TestClient):
        resp = client.post("/api/chat", json={
            "message": "",
            "session_id": "e2e-empty-1",
        })
        assert resp.status_code == 200
        assert resp.json()["content"] == "Hello! I am MIX bot."

    def test_chat_missing_message_fails(self, client: TestClient):
        resp = client.post("/api/chat", json={})
        assert resp.status_code == 422


class TestEngineMemory:
    def test_memory_search_empty(self, client: TestClient):
        resp = client.post("/api/memory/search", json={
            "query": "test",
            "limit": 10,
        })
        assert resp.status_code == 200
        assert resp.json() == []

    def test_memory_search_after_chat(self, client: TestClient):
        client.post("/api/chat", json={
            "message": "my favorite color is blue",
            "session_id": "e2e-mem-1",
        })

        resp = client.post("/api/memory/search", json={
            "query": "favorite color",
            "limit": 10,
        })
        assert resp.status_code == 200
        results = resp.json()
        assert len(results) > 0
        assert any("blue" in e["content"] for e in results)

    def test_memory_get_nonexistent(self, client: TestClient):
        resp = client.get("/api/memory/nonexistent-id")
        assert resp.status_code == 200
        assert resp.json() is None


class TestEngineSkills:
    def test_skills_list(self, client: TestClient):
        resp = client.get("/api/skills")
        assert resp.status_code == 200
        data = resp.json()
        assert "skills" in data
        assert isinstance(data["skills"], list)

    def test_skills_execute_not_found(self, client: TestClient):
        resp = client.post("/api/skills/execute", json={
            "skill_name": "nonexistent",
        })
        assert resp.status_code == 200
        assert "error" in resp.json()


class TestEngineTools:
    def test_tools_list(self, client: TestClient):
        resp = client.get("/api/tools")
        assert resp.status_code == 200
        data = resp.json()
        assert "tools" in data
        assert "definitions" in data

    def test_bash_tool_execute(self, client: TestClient):
        resp = client.post("/api/tools/bash/execute", json={
            "command": "echo e2e",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "e2e" in data["output"]


class TestEngineLearning:
    def test_learning_insights(self, client: TestClient):
        resp = client.get("/api/learning/insights")
        assert resp.status_code == 200
        data = resp.json()
        assert "insights" in data


class TestEngineCron:
    def test_cron_list_empty(self, client: TestClient):
        resp = client.get("/api/cron/jobs")
        assert resp.status_code == 200
        data = resp.json()
        assert "jobs" in data

    def test_cron_schedule_and_list(self, client: TestClient):
        resp = client.post("/api/cron/schedule", json={
            "name": "test-job",
            "cron": "*/5 * * * *",
            "message": "hello",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["job"]["name"] == "test-job"

        resp2 = client.get("/api/cron/jobs")
        jobs = resp2.json()["jobs"]
        assert any(j["name"] == "test-job" for j in jobs)

    def test_cron_delete(self, client: TestClient):
        schedule = client.post("/api/cron/schedule", json={
            "name": "to-delete",
            "cron": "0 * * * *",
            "message": "bye",
        })
        job_id = schedule.json()["job"]["id"]

        resp = client.delete(f"/api/cron/jobs/{job_id}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True


class TestEngineAgents:
    def test_agents_list(self, client: TestClient):
        resp = client.get("/api/agents")
        assert resp.status_code == 200
        data = resp.json()
        assert "agents" in data
        assert isinstance(data["agents"], list)


class TestEngineMCP:
    def test_mcp_servers_list(self, client: TestClient):
        resp = client.get("/api/mcp/servers")
        assert resp.status_code == 200
        data = resp.json()
        assert "servers" in data


class TestEngineStreaming:
    def test_ws_stream_chat(self, client: TestClient):
        # WebSocket route is under /api prefix via include_router
        with client.websocket_connect("/api/ws/stream") as ws:
            ws.send_text(json.dumps({"message": "Hi", "session_id": "e2e-ws-1"}))
            chunks = []
            for _ in range(10):
                data = ws.receive_json()
                chunks.append(data)
                if data.get("done"):
                    break

        assert len(chunks) >= 2
        full_text = "".join(c.get("delta", "") for c in chunks)
        assert "Hello!" in full_text
        assert chunks[-1]["done"] is True
