"""Tests for engine.api.schemas — Pydantic model validation."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from engine.api.schemas import (
    ChatRequest,
    ChatResponse,
    CronScheduleRequest,
    DecomposeRequest,
    HealthResponse,
    MemoryEntryResponse,
    MemorySearchRequest,
    OrchestrateRequest,
    SkillExecuteRequest,
    StreamChunk,
)


class TestChatRequest:
    def test_minimal(self) -> None:
        req = ChatRequest(message="hello")
        assert req.message == "hello"
        assert req.session_id is None
        assert req.channel is None
        assert req.metadata is None

    def test_full(self) -> None:
        req = ChatRequest(
            message="test",
            session_id="sess_123",
            channel="web",
            metadata={"ip": "1.2.3.4"},
        )
        assert req.session_id == "sess_123"
        assert req.metadata["ip"] == "1.2.3.4"

    def test_missing_message_raises(self) -> None:
        with pytest.raises(ValidationError):
            ChatRequest()  # type: ignore[call-arg]


class TestChatResponse:
    def test_valid(self) -> None:
        resp = ChatResponse(id="r1", session_id="s1", content="Hi")
        assert resp.id == "r1"
        assert resp.tool_calls is None

    def test_with_tool_calls(self) -> None:
        resp = ChatResponse(
            id="r2",
            session_id="s2",
            content="",
            tool_calls=[{"name": "bash", "args": {"cmd": "ls"}}],
        )
        assert len(resp.tool_calls) == 1


class TestStreamChunk:
    def test_valid(self) -> None:
        chunk = StreamChunk(id="c1", session_id="s1", delta="Hello", done=False)
        assert chunk.done is False

    def test_done_chunk(self) -> None:
        chunk = StreamChunk(id="c1", session_id="s1", delta="", done=True)
        assert chunk.done is True


class TestSkillExecuteRequest:
    def test_minimal(self) -> None:
        req = SkillExecuteRequest(skill_name="search")
        assert req.args is None
        assert req.session_id is None

    def test_with_args(self) -> None:
        req = SkillExecuteRequest(skill_name="search", args={"q": "test"}, session_id="s1")
        assert req.args["q"] == "test"


class TestMemorySearchRequest:
    def test_defaults(self) -> None:
        req = MemorySearchRequest(query="find this")
        assert req.limit == 10
        assert req.tags is None

    def test_custom_limit(self) -> None:
        req = MemorySearchRequest(query="test", limit=5, tags=["python"])
        assert req.limit == 5
        assert req.tags == ["python"]


class TestMemoryEntryResponse:
    def test_valid(self) -> None:
        entry = MemoryEntryResponse(
            id="e1",
            type="note",
            content="Hello",
            tags=["test"],
            created_at="2024-01-01T00:00:00Z",
        )
        assert entry.type == "note"


class TestCronScheduleRequest:
    def test_minimal(self) -> None:
        req = CronScheduleRequest(name="daily", cron="0 9 * * *", message="Good morning")
        assert req.channel is None

    def test_with_channel(self) -> None:
        req = CronScheduleRequest(
            name="daily",
            cron="0 9 * * *",
            message="GM",
            channel="discord",
        )
        assert req.channel == "discord"


class TestDecomposeRequest:
    def test_defaults(self) -> None:
        req = DecomposeRequest(task="Build API")
        assert req.max_subtasks == 5

    def test_custom_max(self) -> None:
        req = DecomposeRequest(task="Big task", max_subtasks=10)
        assert req.max_subtasks == 10


class TestOrchestrateRequest:
    def test_valid(self) -> None:
        req = OrchestrateRequest(task="Do everything")
        assert req.task == "Do everything"


class TestHealthResponse:
    def test_valid(self) -> None:
        resp = HealthResponse(status="ok", version="1.0.0", engine="running")
        assert resp.status == "ok"
