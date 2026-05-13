"""Comprehensive tests for engine.tools.history module.

Covers: ToolExecutionRecord, ToolHistory
Edge cases: query filters, offset/limit, empty history, max_records boundary, to_dict truncation.
"""

from __future__ import annotations

import pytest

from engine.tools.history import ToolExecutionRecord, ToolHistory
from engine.tools.types import ToolResult

# --- ToolExecutionRecord ---


class TestToolExecutionRecord:
    def test_to_dict(self):
        record = ToolExecutionRecord(
            id="abc123",
            tool_name="bash",
            arguments={"command": "ls"},
            result="file1.txt\nfile2.txt",
            success=True,
            execution_time_ms=15.5,
            session_id="sess1",
            timestamp=1000.0,
        )
        d = record.to_dict()
        assert d["id"] == "abc123"
        assert d["tool_name"] == "bash"
        assert d["arguments"] == {"command": "ls"}
        assert d["result"] == "file1.txt\nfile2.txt"
        assert d["success"] is True
        assert d["execution_time_ms"] == 15.5
        assert d["session_id"] == "sess1"
        assert d["timestamp"] == 1000.0

    def test_to_dict_truncates_long_result(self):
        long_result = "x" * 1000
        record = ToolExecutionRecord(
            id="id1",
            tool_name="test",
            arguments={},
            result=long_result,
            success=True,
            execution_time_ms=1.0,
            session_id="",
            timestamp=0.0,
        )
        d = record.to_dict()
        assert len(d["result"]) <= 500

    def test_to_dict_rounds_execution_time(self):
        record = ToolExecutionRecord(
            id="id2",
            tool_name="test",
            arguments={},
            result="",
            success=True,
            execution_time_ms=1.23456789,
            session_id="",
            timestamp=0.0,
        )
        d = record.to_dict()
        assert d["execution_time_ms"] == 1.23


# --- ToolHistory ---


@pytest.fixture
def history() -> ToolHistory:
    return ToolHistory(max_records=100)


async def _record(
    history: ToolHistory,
    tool_name: str = "bash",
    success: bool = True,
    session_id: str = "sess1",
    duration: float = 10.0,
) -> None:
    result = ToolResult(output="ok", success=success)
    if not success:
        result = ToolResult(output="", error="fail", success=False)
    await history.record(tool_name, {"arg": "val"}, result, session_id, duration)


class TestRecord:
    @pytest.mark.asyncio
    async def test_record_stores_entry(self, history: ToolHistory):
        await _record(history)
        records = await history.query()
        assert len(records) == 1
        assert records[0].tool_name == "bash"

    @pytest.mark.asyncio
    async def test_record_stores_multiple(self, history: ToolHistory):
        await _record(history, tool_name="bash")
        await _record(history, tool_name="file_read")
        await _record(history, tool_name="grep")
        records = await history.query()
        assert len(records) == 3

    @pytest.mark.asyncio
    async def test_record_has_unique_id(self, history: ToolHistory):
        await _record(history)
        await _record(history)
        records = await history.query()
        assert records[0].id != records[1].id


class TestMaxRecords:
    @pytest.mark.asyncio
    async def test_max_records_keeps_newest(self):
        h = ToolHistory(max_records=3)
        for i in range(5):
            result = ToolResult(output=f"result_{i}", success=True)
            await h.record("tool", {"i": i}, result, "", 1.0)
        records = await h.query()
        assert len(records) == 3

    @pytest.mark.asyncio
    async def test_max_records_one(self):
        h = ToolHistory(max_records=1)
        await _record(h, tool_name="first")
        await _record(h, tool_name="second")
        records = await h.query()
        assert len(records) == 1
        assert records[0].tool_name == "second"

    @pytest.mark.asyncio
    async def test_max_records_exact_boundary(self):
        h = ToolHistory(max_records=5)
        for i in range(5):
            await _record(h, tool_name=f"tool_{i}")
        records = await h.query()
        assert len(records) == 5


class TestQuery:
    @pytest.mark.asyncio
    async def test_query_empty_history(self, history: ToolHistory):
        records = await history.query()
        assert records == []

    @pytest.mark.asyncio
    async def test_query_by_tool_name(self, history: ToolHistory):
        await _record(history, tool_name="bash")
        await _record(history, tool_name="file_read")
        await _record(history, tool_name="bash")
        records = await history.query(tool_name="bash")
        assert len(records) == 2
        assert all(r.tool_name == "bash" for r in records)

    @pytest.mark.asyncio
    async def test_query_by_session_id(self, history: ToolHistory):
        await _record(history, session_id="sess_a")
        await _record(history, session_id="sess_b")
        await _record(history, session_id="sess_a")
        records = await history.query(session_id="sess_a")
        assert len(records) == 2

    @pytest.mark.asyncio
    async def test_query_combined_filters(self, history: ToolHistory):
        await _record(history, tool_name="bash", session_id="sess_a")
        await _record(history, tool_name="file_read", session_id="sess_a")
        await _record(history, tool_name="bash", session_id="sess_b")
        records = await history.query(tool_name="bash", session_id="sess_a")
        assert len(records) == 1

    @pytest.mark.asyncio
    async def test_query_returns_newest_first(self, history: ToolHistory):
        await _record(history, tool_name="first_tool")
        await _record(history, tool_name="second_tool")
        await _record(history, tool_name="third_tool")
        records = await history.query()
        assert records[0].tool_name == "third_tool"
        assert records[2].tool_name == "first_tool"

    @pytest.mark.asyncio
    async def test_query_limit(self, history: ToolHistory):
        for i in range(10):
            await _record(history, tool_name=f"tool_{i}")
        records = await history.query(limit=3)
        assert len(records) == 3

    @pytest.mark.asyncio
    async def test_query_offset(self, history: ToolHistory):
        for i in range(10):
            await _record(history, tool_name=f"tool_{i}")
        records = await history.query(offset=8)
        assert len(records) == 2

    @pytest.mark.asyncio
    async def test_query_offset_beyond_records(self, history: ToolHistory):
        await _record(history)
        records = await history.query(offset=100)
        assert records == []

    @pytest.mark.asyncio
    async def test_query_no_matching_tool(self, history: ToolHistory):
        await _record(history, tool_name="bash")
        records = await history.query(tool_name="nonexistent")
        assert records == []


class TestGetStats:
    @pytest.mark.asyncio
    async def test_stats_empty_history(self, history: ToolHistory):
        stats = await history.get_stats()
        assert stats["total"] == 0
        assert stats["tools"] == {}
        assert stats["avg_time_ms"] == 0

    @pytest.mark.asyncio
    async def test_stats_total_count(self, history: ToolHistory):
        await _record(history)
        await _record(history)
        await _record(history)
        stats = await history.get_stats()
        assert stats["total"] == 3

    @pytest.mark.asyncio
    async def test_stats_success_rate(self, history: ToolHistory):
        await _record(history, success=True)
        await _record(history, success=True)
        await _record(history, success=False)
        stats = await history.get_stats()
        assert stats["success_rate"] == 66.7

    @pytest.mark.asyncio
    async def test_stats_all_failures(self, history: ToolHistory):
        await _record(history, success=False)
        await _record(history, success=False)
        stats = await history.get_stats()
        assert stats["success_rate"] == 0.0

    @pytest.mark.asyncio
    async def test_stats_avg_time(self, history: ToolHistory):
        await _record(history, duration=10.0)
        await _record(history, duration=30.0)
        stats = await history.get_stats()
        assert stats["avg_time_ms"] == 20.0

    @pytest.mark.asyncio
    async def test_stats_tools_breakdown(self, history: ToolHistory):
        await _record(history, tool_name="bash")
        await _record(history, tool_name="bash")
        await _record(history, tool_name="file_read")
        stats = await history.get_stats()
        assert stats["tools"]["bash"] == 2
        assert stats["tools"]["file_read"] == 1
