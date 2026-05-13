from __future__ import annotations

import time
from typing import Any, Awaitable, Callable

from engine.tools import bash as bash_tool
from engine.tools import calculator as calc_tool
from engine.tools import code_execution as code_exec_tool
from engine.tools import edit as edit_tool
from engine.tools import file as file_tool
from engine.tools import glob as glob_mod
from engine.tools import grep as grep_tool
from engine.tools import image_gen as image_gen_tool
from engine.tools import scraper as scraper_tool
from engine.tools import search as search_tool
from engine.tools import webfetch as webfetch_tool
from engine.tools.sandbox import FileSandbox
from engine.tools.approval import ApprovalManager
from engine.tools.dynamic import DynamicToolRegistry
from engine.tools.history import ToolHistory
from engine.tools.types import ToolResult

DANGER_LEVELS: dict[str, str] = {
    "bash": "dangerous",
    "file_write": "moderate",
    "file_edit": "moderate",
    "file_edit_lines": "moderate",
    "code_execute": "dangerous",
    "image_generate": "moderate",
    "file_read": "safe",
    "file_list": "safe",
    "web_search": "safe",
    "web_fetch": "safe",
    "grep": "safe",
    "glob": "safe",
    "calculator": "safe",
    "scraper": "safe",
}


class ToolRegistry:
    def __init__(self, sandbox: object | None = None, file_sandbox: FileSandbox | None = None) -> None:
        self._tools: dict[str, Callable[..., Awaitable[ToolResult]]] = {
            "bash": bash_tool.execute,
            "file_read": file_tool.file_read,
            "file_write": file_tool.file_write,
            "file_list": file_tool.file_list,
            "file_edit": edit_tool.file_edit,
            "file_edit_lines": edit_tool.file_edit_lines,
            "web_search": search_tool.web_search,
            "grep": grep_tool.content_search,
            "glob": glob_mod.glob_search,
            "web_fetch": webfetch_tool.web_fetch,
            "calculator": calc_tool.execute,
            "scraper": scraper_tool.execute,
            "code_execute": code_exec_tool.execute,
            "image_generate": image_gen_tool.execute,
        }
        self._sandbox = sandbox
        self._file_sandbox = file_sandbox
        self._mcp_tools: dict[str, Callable[..., Awaitable[ToolResult]]] = {}
        self._approval: ApprovalManager | None = None
        self._history: ToolHistory | None = None
        self._dynamic: DynamicToolRegistry | None = None

    def set_approval_manager(self, manager: ApprovalManager) -> None:
        self._approval = manager

    def set_history(self, history: ToolHistory) -> None:
        self._history = history

    def set_dynamic_registry(self, registry: DynamicToolRegistry) -> None:
        self._dynamic = registry

    def set_sandbox(self, sandbox: object) -> None:
        self._sandbox = sandbox

    def register_tool(self, name: str, handler: Callable[..., Awaitable[ToolResult]]) -> None:
        self._tools[name] = handler

    def register_mcp_tool(self, name: str, handler: Callable[..., Awaitable[ToolResult]]) -> None:
        self._mcp_tools[name] = handler

    def unregister_tool(self, name: str) -> bool:
        if name in self._tools:
            del self._tools[name]
            return True
        if name in self._mcp_tools:
            del self._mcp_tools[name]
            return True
        return False

    def get_danger_level(self, tool_name: str) -> str:
        return DANGER_LEVELS.get(tool_name, "safe")

    async def execute(self, tool_name: str, chain_id: str | None = None, **kwargs: Any) -> ToolResult:
        handler = self._mcp_tools.get(tool_name) or self._tools.get(tool_name)
        if handler is None and self._dynamic and self._dynamic.has_tool(tool_name):
            result = await self._dynamic.execute(tool_name, **kwargs)
            return ToolResult(
                output=result.get("output", ""),
                error=result.get("error"),
                success=result.get("success", False),
            )
        if handler is None:
            return ToolResult(
                output="",
                error=f"Unknown tool: {tool_name}. Available: {', '.join(self.list_tools())}",
                success=False,
            )

        if self._file_sandbox and tool_name in ("file_read", "file_write", "file_edit", "file_edit_lines", "file_list"):
            path_val = kwargs.get("path", ".")
            try:
                self._file_sandbox.validate_path(path_val)
            except PermissionError as e:
                return ToolResult(output="", error=str(e), success=False)

        danger = self.get_danger_level(tool_name)
        if self._approval and danger in ("moderate", "dangerous"):
            req = await self._approval.request_approval(tool_name, kwargs, danger)
            if req.status.value != "approved":
                return ToolResult(
                    output="",
                    error=f"Tool execution blocked: {req.status.value} (request {req.id})",
                    success=False,
                )

        start = time.monotonic()
        try:
            if tool_name == "bash" and self._sandbox:
                result = await self._execute_sandboxed(kwargs)
            else:
                result = await handler(**kwargs)
        except Exception as e:
            result = ToolResult(output="", error=str(e), success=False)

        duration_ms = (time.monotonic() - start) * 1000

        if self._history:
            await self._history.record(
                tool_name=tool_name,
                arguments=kwargs,
                result=result,
                session_id=kwargs.get("session_id", ""),
                duration_ms=duration_ms,
                chain_id=chain_id,
            )
        return result

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
        tools = list(self._tools.keys()) + list(self._mcp_tools.keys())
        if self._dynamic:
            tools.extend(self._dynamic.list_dynamic_tools_names())
        return tools

    def get_definitions(self) -> list[dict[str, Any]]:
        from engine.tools.types import TOOL_DEFINITIONS

        definitions = list(TOOL_DEFINITIONS)
        for name in self._mcp_tools:
            definitions.append(
                {
                    "type": "function",
                    "function": {
                        "name": name,
                        "description": f"MCP tool: {name}",
                        "parameters": {"type": "object", "properties": {}},
                    },
                }
            )
        if self._dynamic:
            definitions.extend(self._dynamic.get_definitions())
        return definitions
