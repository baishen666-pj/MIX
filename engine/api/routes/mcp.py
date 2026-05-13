"""MCP server listing and registration endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/mcp/servers")
async def mcp_servers():
    from engine.api import routes as _pkg

    if _pkg._mcp is None:
        return {"servers": []}
    return {"servers": _pkg._mcp.list_servers(), "tools": _pkg._mcp.list_tools()}


@router.post("/mcp/servers")
async def mcp_register(body: dict):
    from engine.api import routes as _pkg

    if _pkg._mcp is None:
        raise HTTPException(503, "MCP not initialized")
    from engine.mcp.client import MCPServerConfig

    config = MCPServerConfig(
        name=body.get("name", ""),
        url=body.get("url", ""),
        api_key=body.get("api_key", ""),
    )
    _pkg._mcp.register_server(config)
    tools = await _pkg._mcp.discover_tools(config.name)
    return {"status": "ok", "server": config.name, "tools_discovered": len(tools)}
