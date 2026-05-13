from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from typing import Any

from engine.tools.types import ToolResult

log = logging.getLogger("mix.tool_history")


@dataclass
class ToolExecutionRecord:
    id: str
    tool_name: str
    arguments: dict[str, Any]
    result: str
    success: bool
    execution_time_ms: float
    session_id: str
    timestamp: float
    chain_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tool_name": self.tool_name,
            "arguments": self.arguments,
            "result": self.result[:500],
            "success": self.success,
            "execution_time_ms": round(self.execution_time_ms, 2),
            "session_id": self.session_id,
            "timestamp": self.timestamp,
            "chain_id": self.chain_id,
        }


class ToolHistory:
    def __init__(self, max_records: int = 10000) -> None:
        self._records: list[ToolExecutionRecord] = []
        self._max_records = max_records

    async def record(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        result: ToolResult,
        session_id: str,
        duration_ms: float,
        chain_id: str | None = None,
    ) -> None:
        record = ToolExecutionRecord(
            id=uuid.uuid4().hex[:12],
            tool_name=tool_name,
            arguments=arguments,
            result=result.output[:500],
            success=result.success,
            execution_time_ms=duration_ms,
            session_id=session_id,
            timestamp=time.time(),
            chain_id=chain_id,
        )
        self._records.append(record)
        if len(self._records) > self._max_records:
            self._records = self._records[-self._max_records :]

    async def query(
        self,
        tool_name: str | None = None,
        session_id: str | None = None,
        chain_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[ToolExecutionRecord]:
        results = self._records
        if tool_name:
            results = [r for r in results if r.tool_name == tool_name]
        if session_id:
            results = [r for r in results if r.session_id == session_id]
        if chain_id:
            results = [r for r in results if r.chain_id == chain_id]
        return list(reversed(results))[offset : offset + limit]

    async def get_stats(self) -> dict[str, Any]:
        if not self._records:
            return {"total": 0, "tools": {}, "avg_time_ms": 0}
        tool_counts: dict[str, int] = {}
        total_time = 0.0
        success_count = 0
        for r in self._records:
            tool_counts[r.tool_name] = tool_counts.get(r.tool_name, 0) + 1
            total_time += r.execution_time_ms
            if r.success:
                success_count += 1
        return {
            "total": len(self._records),
            "success_rate": round(success_count / len(self._records) * 100, 1),
            "avg_time_ms": round(total_time / len(self._records), 2),
            "tools": tool_counts,
        }
