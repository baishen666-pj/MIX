from __future__ import annotations

from typing import Any

from engine.tools.types import ToolResult
from engine.tools import bash as bash_tool
from engine.tools import file as file_tool
from engine.tools import search as search_tool


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Any] = {
            "bash": bash_tool.execute,
            "file_read": file_tool.file_read,
            "file_write": file_tool.file_write,
            "file_list": file_tool.file_list,
            "web_search": search_tool.web_search,
        }

    async def execute(self, tool_name: str, **kwargs: Any) -> ToolResult:
        handler = self._tools.get(tool_name)
        if handler is None:
            return ToolResult(
                output="",
                error=f"Unknown tool: {tool_name}. Available: {', '.join(self._tools.keys())}",
                success=False,
            )
        return await handler(**kwargs)

    def list_tools(self) -> list[str]:
        return list(self._tools.keys())

    def get_definitions(self) -> list[dict]:
        from engine.tools.types import TOOL_DEFINITIONS
        return TOOL_DEFINITIONS
