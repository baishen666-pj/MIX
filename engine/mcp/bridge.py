from __future__ import annotations

from typing import Any

from engine.mcp.client import MCPClient
from engine.tools.types import ToolResult


class MCPToolBridge:
    def __init__(self, mcp_client: MCPClient) -> None:
        self.mcp = mcp_client

    async def execute(self, tool_name: str, **kwargs: Any) -> ToolResult:
        result = await self.mcp.call_tool(tool_name, kwargs)
        if "error" in result:
            return ToolResult(output="", error=result["error"], success=False)

        content = result.get("content", [])
        if isinstance(content, list):
            text_parts = [c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"]
            output = "\n".join(text_parts) if text_parts else json_dump(result)
        else:
            output = str(content)

        return ToolResult(output=output)


def json_dump(obj: Any) -> str:
    import json

    return json.dumps(obj, default=str)
