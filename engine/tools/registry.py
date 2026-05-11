from __future__ import annotations

from typing import Any

from engine.tools.types import ToolResult
from engine.tools import bash as bash_tool
from engine.tools import file as file_tool
from engine.tools import search as search_tool


class ToolRegistry:
    def __init__(self, sandbox: Any | None = None) -> None:
        self._tools: dict[str, Any] = {
            "bash": bash_tool.execute,
            "file_read": file_tool.file_read,
            "file_write": file_tool.file_write,
            "file_list": file_tool.file_list,
            "web_search": search_tool.web_search,
        }
        self._sandbox = sandbox
        self._mcp_tools: dict[str, Any] = {}

    def set_sandbox(self, sandbox: Any) -> None:
        self._sandbox = sandbox

    def register_tool(self, name: str, handler: Any) -> None:
        self._tools[name] = handler

    def register_mcp_tool(self, name: str, handler: Any) -> None:
        self._mcp_tools[name] = handler

    async def execute(self, tool_name: str, **kwargs: Any) -> ToolResult:
        handler = self._mcp_tools.get(tool_name) or self._tools.get(tool_name)
        if handler is None:
            return ToolResult(
                output="",
                error=f"Unknown tool: {tool_name}. Available: {', '.join(self.list_tools())}",
                success=False,
            )

        if tool_name == "bash" and self._sandbox:
            return await self._execute_sandboxed(kwargs)
        return await handler(**kwargs)

    async def _execute_sandboxed(self, kwargs: dict[str, Any]) -> ToolResult:
        command = kwargs.get("command", "")
        timeout = kwargs.get("timeout", 30)
        cwd = kwargs.get("cwd")
        try:
            result = await self._sandbox.execute(command, timeout=timeout, cwd=cwd)
            success = result.get("exit_code", -1) == 0
            return ToolResult(
                output=result.get("stdout", ""),
                error=result.get("stderr") if not success else None,
                success=success,
            )
        except Exception as e:
            return ToolResult(output="", error=str(e), success=False)

    def list_tools(self) -> list[str]:
        return list(self._tools.keys()) + list(self._mcp_tools.keys())

    def get_definitions(self) -> list[dict]:
        from engine.tools.types import TOOL_DEFINITIONS
        definitions = list(TOOL_DEFINITIONS)
        for name in self._mcp_tools:
            definitions.append({
                "type": "function",
                "function": {
                    "name": name,
                    "description": f"MCP tool: {name}",
                    "parameters": {"type": "object", "properties": {}},
                },
            })
        return definitions
