"""Tests for engine.mcp.client — MCPClient register, discover, SSRF protection."""

from __future__ import annotations

import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from engine.mcp.client import MCPClient, MCPServerConfig, MCPTool, _validate_mcp_url


class TestValidateMCPUrl:

    def test_accepts_https_url(self) -> None:
        _validate_mcp_url("https://api.example.com/mcp")

    def test_accepts_http_url(self) -> None:
        _validate_mcp_url("http://remote-host.com/mcp")

    def test_rejects_invalid_scheme(self) -> None:
        with pytest.raises(ValueError, match="Invalid MCP URL scheme"):
            _validate_mcp_url("ftp://example.com")

    def test_rejects_localhost(self) -> None:
        with pytest.raises(ValueError, match="local address"):
            _validate_mcp_url("http://localhost:8080")

    def test_rejects_0000(self) -> None:
        with pytest.raises(ValueError):
            _validate_mcp_url("http://0.0.0.0:8080")

    def test_rejects_ipv6_loopback(self) -> None:
        with pytest.raises(ValueError):
            _validate_mcp_url("http://[::1]:8080")

    def test_rejects_private_ip(self) -> None:
        with pytest.raises(ValueError, match="private/reserved"):
            _validate_mcp_url("http://192.168.1.1/mcp")

    def test_rejects_loopback_ip(self) -> None:
        with pytest.raises(ValueError, match="private/reserved"):
            _validate_mcp_url("http://127.0.0.1/mcp")

    def test_rejects_no_hostname(self) -> None:
        with pytest.raises(ValueError, match="no hostname"):
            _validate_mcp_url("http:///path")


class TestMCPServerConfig:

    def test_defaults(self) -> None:
        cfg = MCPServerConfig(name="test", url="https://example.com")
        assert cfg.api_key == ""
        assert cfg.enabled is True


class TestMCPClient:

    def test_register_server(self) -> None:
        client = MCPClient()
        cfg = MCPServerConfig(name="svc", url="https://svc.example.com")
        client.register_server(cfg)
        servers = client.list_servers()
        assert len(servers) == 1
        assert servers[0]["name"] == "svc"

    def test_remove_server(self) -> None:
        client = MCPClient()
        cfg = MCPServerConfig(name="svc", url="https://svc.example.com")
        client.register_server(cfg)
        assert client.remove_server("svc") is True
        assert len(client.list_servers()) == 0

    def test_remove_server_cleans_tools(self) -> None:
        client = MCPClient()
        tool = MCPTool(name="mcp_svc_tool1", description="d", server="svc")
        client._tools["mcp_svc_tool1"] = tool
        cfg = MCPServerConfig(name="svc", url="https://svc.example.com")
        client.register_server(cfg)

        client.remove_server("svc")
        assert len(client.list_tools()) == 0

    def test_remove_nonexistent_server(self) -> None:
        client = MCPClient()
        assert client.remove_server("ghost") is False

    @pytest.mark.asyncio
    async def test_discover_tools_unknown_server(self) -> None:
        client = MCPClient()
        tools = await client.discover_tools("unknown")
        assert tools == []

    @pytest.mark.asyncio
    @patch("engine.mcp.client.httpx.AsyncClient")
    async def test_discover_tools_success(self, mock_client_cls) -> None:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "result": {
                "tools": [
                    {"name": "search", "description": "Search docs", "inputSchema": {"type": "object"}},
                ]
            }
        }
        mock_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        client = MCPClient()
        cfg = MCPServerConfig(name="docs", url="https://docs.example.com", api_key="key123")
        client.register_server(cfg)

        tools = await client.discover_tools("docs")
        assert len(tools) == 1
        assert tools[0].name == "mcp_docs_search"
        assert tools[0].server == "docs"

    @pytest.mark.asyncio
    async def test_call_tool_unknown(self) -> None:
        client = MCPClient()
        result = await client.call_tool("ghost_tool", {})
        assert "error" in result

    def test_get_tool_definitions_empty(self) -> None:
        client = MCPClient()
        assert client.get_tool_definitions() == []

    def test_get_tool_definitions_with_tools(self) -> None:
        client = MCPClient()
        tool = MCPTool(
            name="mcp_svc_search",
            description="Search",
            server="svc",
            parameters={"type": "object", "properties": {"q": {"type": "string"}}},
        )
        client._tools["mcp_svc_search"] = tool

        defs = client.get_tool_definitions()
        assert len(defs) == 1
        assert defs[0]["type"] == "function"
        assert defs[0]["function"]["name"] == "mcp_svc_search"
        assert "[MCP:svc]" in defs[0]["function"]["description"]

    def test_list_tools(self) -> None:
        client = MCPClient()
        client._tools["t1"] = MCPTool(name="t1", description="Tool 1", server="s1")
        client._tools["t2"] = MCPTool(name="t2", description="Tool 2", server="s2")

        tools = client.list_tools()
        assert len(tools) == 2
        names = {t["name"] for t in tools}
        assert names == {"t1", "t2"}
