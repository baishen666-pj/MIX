from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

import httpx


@dataclass
class MCPServerConfig:
    name: str
    url: str
    api_key: str = ""
    enabled: bool = True


@dataclass
class MCPTool:
    name: str
    description: str
    server: str
    parameters: dict = field(default_factory=dict)


class MCPClient:
    def __init__(self) -> None:
        self._servers: dict[str, MCPServerConfig] = {}
        self._tools: dict[str, MCPTool] = {}

    def register_server(self, config: MCPServerConfig) -> None:
        self._servers[config.name] = config

    def remove_server(self, name: str) -> bool:
        if name in self._servers:
            del self._servers[name]
            tools_to_remove = [t for t, tool in self._tools.items() if tool.server == name]
            for t in tools_to_remove:
                del self._tools[t]
            return True
        return False

    async def discover_tools(self, server_name: str) -> list[MCPTool]:
        server = self._servers.get(server_name)
        if not server:
            return []

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                headers = {"Content-Type": "application/json"}
                if server.api_key:
                    headers["Authorization"] = f"Bearer {server.api_key}"

                resp = await client.post(
                    f"{server.url}/tools/list",
                    headers=headers,
                    json={"jsonrpc": "2.0", "method": "tools/list", "id": 1},
                )
                data = resp.json()

                tools = []
                result = data.get("result", {})
                for tool_data in result.get("tools", []):
                    tool = MCPTool(
                        name=f"mcp_{server_name}_{tool_data['name']}",
                        description=tool_data.get("description", ""),
                        server=server_name,
                        parameters=tool_data.get("inputSchema", {}),
                    )
                    self._tools[tool.name] = tool
                    tools.append(tool)
                return tools
        except Exception:
            return []

    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> dict:
        tool = self._tools.get(tool_name)
        if not tool:
            return {"error": f"MCP tool '{tool_name}' not found"}

        server = self._servers.get(tool.server)
        if not server:
            return {"error": f"MCP server '{tool.server}' not found"}

        original_name = tool_name.removeprefix(f"mcp_{tool.server}_")

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                headers = {"Content-Type": "application/json"}
                if server.api_key:
                    headers["Authorization"] = f"Bearer {server.api_key}"

                resp = await client.post(
                    f"{server.url}/tools/call",
                    headers=headers,
                    json={
                        "jsonrpc": "2.0",
                        "method": "tools/call",
                        "params": {"name": original_name, "arguments": arguments},
                        "id": 2,
                    },
                )
                return resp.json().get("result", {})
        except Exception as e:
            return {"error": str(e)}

    def get_tool_definitions(self) -> list[dict]:
        definitions = []
        for tool in self._tools.values():
            definitions.append({
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": f"[MCP:{tool.server}] {tool.description}",
                    "parameters": tool.parameters,
                },
            })
        return definitions

    def list_servers(self) -> list[dict]:
        return [
            {"name": s.name, "url": s.url, "enabled": s.enabled}
            for s in self._servers.values()
        ]

    def list_tools(self) -> list[dict]:
        return [
            {"name": t.name, "description": t.description, "server": t.server}
            for t in self._tools.values()
        ]
