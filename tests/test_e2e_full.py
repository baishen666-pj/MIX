"""End-to-end tests for the MIX Engine API — full stack without external dependencies."""

from __future__ import annotations

import json
import pytest
from pathlib import Path
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch

from engine.main import create_app
from engine.config import MixConfig, ProviderConfig, EngineConfig, MemoryConfig
from engine.memory.store import MemoryStore


def make_config(tmp_path: Path) -> MixConfig:
    return MixConfig(
        engine=EngineConfig(),
        llm=ProviderConfig(provider="openai", model="gpt-4o", api_key="test-key"),
        memory=MemoryConfig(db_path=tmp_path / "e2e.db"),
    )


class MockProvider:
    def __init__(self, responses: list[dict] | None = None) -> None:
        self._responses = list(responses or [])
        self._call_count = 0

    async def complete(self, **kwargs) -> dict:
        if self._call_count < len(self._responses):
            resp = self._responses[self._call_count]
            self._call_count += 1
            return resp
        return {"content": "fallback", "tool_calls": None, "usage": {"total_tokens": 10}}

    async def stream(self, **kwargs):
        yield {"delta": "fallback", "done": True}


@pytest.fixture
async def e2e_client(tmp_path: Path):
    config = make_config(tmp_path)
    app = create_app(config)

    from engine.api import routes as routes_mod
    provider = MockProvider()
    routes_mod._agent_loop.provider = provider

    # Manually connect memory since lifespan doesn't run with ASGITransport
    memory = routes_mod._memory
    if memory:
        await memory.connect()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    if memory:
        await memory.close()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class TestHealthE2E:

    @pytest.mark.asyncio
    async def test_health_endpoint(self, e2e_client: AsyncClient) -> None:
        resp = await e2e_client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["engine"] == "mix-python"


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

class TestChatE2E:

    @pytest.mark.asyncio
    async def test_chat_returns_response(self, tmp_path: Path) -> None:
        config = make_config(tmp_path)
        app = create_app(config)
        from engine.api import routes as routes_mod
        routes_mod._agent_loop.provider = MockProvider([
            {"content": "Hello! How can I help?", "tool_calls": None, "usage": {"total_tokens": 25}},
        ])
        if routes_mod._memory:
            await routes_mod._memory.connect()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/chat", json={"message": "Hi"})
            assert resp.status_code == 200
            data = resp.json()
            assert data["content"] == "Hello! How can I help?"
            assert data["session_id"]
        if routes_mod._memory:
            await routes_mod._memory.close()

    @pytest.mark.asyncio
    async def test_chat_invalid_body(self, e2e_client: AsyncClient) -> None:
        resp = await e2e_client.post("/api/chat", json={})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Memory
# ---------------------------------------------------------------------------

class TestMemoryE2E:

    @pytest.mark.asyncio
    async def test_memory_create_and_search(self, e2e_client: AsyncClient) -> None:
        resp = await e2e_client.post("/api/memory", json={"content": "test memory entry", "type": "context"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

        resp = await e2e_client.post("/api/memory/search", json={"query": "test memory", "limit": 5})
        assert resp.status_code == 200
        results = resp.json()
        assert len(results) >= 1

    @pytest.mark.asyncio
    async def test_memory_get_and_delete(self, e2e_client: AsyncClient) -> None:
        resp = await e2e_client.post("/api/memory", json={"content": "to delete", "type": "fact"})
        entry_id = resp.json()["id"]

        resp = await e2e_client.get(f"/api/memory/{entry_id}")
        assert resp.status_code == 200
        assert resp.json()["content"] == "to delete"

        resp = await e2e_client.delete(f"/api/memory/{entry_id}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

class TestSessionsE2E:

    @pytest.mark.asyncio
    async def test_sessions_list(self, e2e_client: AsyncClient) -> None:
        resp = await e2e_client.get("/api/sessions")
        assert resp.status_code == 200
        assert "sessions" in resp.json()


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

class TestToolsE2E:

    @pytest.mark.asyncio
    async def test_tools_list(self, e2e_client: AsyncClient) -> None:
        resp = await e2e_client.get("/api/tools")
        assert resp.status_code == 200
        data = resp.json()
        assert "tools" in data


# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------

class TestAgentsE2E:

    @pytest.mark.asyncio
    async def test_agents_list(self, e2e_client: AsyncClient) -> None:
        resp = await e2e_client.get("/api/agents")
        assert resp.status_code == 200
        assert "agents" in resp.json()


# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------

class TestSkillsE2E:

    @pytest.mark.asyncio
    async def test_skills_list(self, e2e_client: AsyncClient) -> None:
        resp = await e2e_client.get("/api/skills")
        assert resp.status_code == 200
        assert "skills" in resp.json()


# ---------------------------------------------------------------------------
# Cron
# ---------------------------------------------------------------------------

class TestCronE2E:

    @pytest.mark.asyncio
    async def test_cron_schedule_and_list(self, e2e_client: AsyncClient) -> None:
        resp = await e2e_client.post("/api/cron/schedule", json={
            "name": "daily_greeting",
            "cron": "0 9 * * *",
            "message": "Good morning!",
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
        job_id = resp.json()["job"]["id"]

        resp = await e2e_client.get("/api/cron/jobs")
        assert resp.status_code == 200
        assert len(resp.json()["jobs"]) >= 1

        resp = await e2e_client.delete(f"/api/cron/jobs/{job_id}")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Learning
# ---------------------------------------------------------------------------

class TestLearningE2E:

    @pytest.mark.asyncio
    async def test_learning_insights(self, e2e_client: AsyncClient) -> None:
        resp = await e2e_client.get("/api/learning/insights")
        assert resp.status_code == 200
        assert "insights" in resp.json()


# ---------------------------------------------------------------------------
# MCP
# ---------------------------------------------------------------------------

class TestMCPE2E:

    @pytest.mark.asyncio
    async def test_mcp_servers_empty(self, e2e_client: AsyncClient) -> None:
        resp = await e2e_client.get("/api/mcp/servers")
        assert resp.status_code == 200
        assert resp.json()["servers"] == []


# ---------------------------------------------------------------------------
# Voice
# ---------------------------------------------------------------------------

class TestVoicePathE2E:

    @pytest.mark.asyncio
    async def test_voice_stt_path_missing(self, e2e_client: AsyncClient) -> None:
        resp = await e2e_client.post("/api/voice/stt/path", json={"path": ""})
        assert resp.status_code == 200
        assert "error" in resp.json()

    @pytest.mark.asyncio
    @patch("openai.AsyncOpenAI")
    async def test_voice_tts(self, mock_openai_cls, e2e_client: AsyncClient) -> None:
        mock_client = AsyncMock()
        mock_response = MagicMock()

        def fake_stream(path: str) -> None:
            Path(path).write_bytes(b"fake audio")

        mock_response.stream_to_file = fake_stream
        mock_client.audio.speech.create.return_value = mock_response
        mock_openai_cls.return_value = mock_client

        resp = await e2e_client.post("/api/voice/tts", json={"text": "Hello", "voice": "alloy"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# SSE Streaming
# ---------------------------------------------------------------------------

class TestSSEStreamE2E:

    @pytest.mark.asyncio
    async def test_sse_chat_stream(self, tmp_path: Path) -> None:
        config = make_config(tmp_path)
        app = create_app(config)
        from engine.api import routes as routes_mod

        chunks_sent = []

        async def fake_stream(**kwargs):
            for text in ["Hello", " world", "!"]:
                chunks_sent.append(text)
                yield {"delta": text, "done": False}
            yield {"delta": "", "done": True}

        routes_mod._agent_loop.provider.stream = fake_stream
        if routes_mod._memory:
            await routes_mod._memory.connect()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/chat/stream?message=Hi", follow_redirects=True)
            assert resp.status_code == 200
            body = resp.text
            assert "data:" in body
            assert "[DONE]" in body
        if routes_mod._memory:
            await routes_mod._memory.close()


# ---------------------------------------------------------------------------
# Token Budget
# ---------------------------------------------------------------------------

class TestTokenBudgetE2E:

    @pytest.mark.asyncio
    async def test_chat_returns_tokens_used(self, tmp_path: Path) -> None:
        config = make_config(tmp_path)
        app = create_app(config)
        from engine.api import routes as routes_mod
        routes_mod._agent_loop.provider = MockProvider([
            {"content": "Response", "tool_calls": None, "usage": {"total_tokens": 42}},
        ])
        if routes_mod._memory:
            await routes_mod._memory.connect()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/chat", json={"message": "test"})
            assert resp.status_code == 200
            data = resp.json()
            assert "tokens_used" in data.get("metadata", {})
        if routes_mod._memory:
            await routes_mod._memory.close()
