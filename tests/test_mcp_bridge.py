"""Tests for engine.mcp.bridge — MCPToolBridge execute logic."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from engine.mcp.bridge import MCPToolBridge, json_dump
from engine.mcp.client import MCPClient


class TestMCPToolBridge:
    @pytest.mark.asyncio
    async def test_execute_success_with_text_content(self) -> None:
        client = MCPClient()
        client.call_tool = AsyncMock(
            return_value={
                "content": [
                    {"type": "text", "text": "Hello"},
                    {"type": "text", "text": "World"},
                ]
            }
        )

        bridge = MCPToolBridge(client)
        result = await bridge.execute("mcp_svc_tool", query="test")

        assert result.success is True
        assert "Hello" in result.output
        assert "World" in result.output

    @pytest.mark.asyncio
    async def test_execute_error_response(self) -> None:
        client = MCPClient()
        client.call_tool = AsyncMock(return_value={"error": "Connection refused"})

        bridge = MCPToolBridge(client)
        result = await bridge.execute("mcp_svc_tool")

        assert result.success is False
        assert "Connection refused" in result.error

    @pytest.mark.asyncio
    async def test_execute_non_list_content(self) -> None:
        client = MCPClient()
        client.call_tool = AsyncMock(return_value={"content": "plain string"})

        bridge = MCPToolBridge(client)
        result = await bridge.execute("mcp_svc_tool")

        assert result.success is True
        assert result.output == "plain string"

    @pytest.mark.asyncio
    async def test_execute_empty_result(self) -> None:
        client = MCPClient()
        client.call_tool = AsyncMock(return_value={})

        bridge = MCPToolBridge(client)
        result = await bridge.execute("mcp_svc_tool")

        assert result.success is True

    @pytest.mark.asyncio
    async def test_execute_mixed_content_types(self) -> None:
        client = MCPClient()
        client.call_tool = AsyncMock(
            return_value={
                "content": [
                    {"type": "image", "data": "base64..."},
                    {"type": "text", "text": "only text matters"},
                ]
            }
        )

        bridge = MCPToolBridge(client)
        result = await bridge.execute("mcp_svc_tool")

        assert result.success is True
        assert "only text matters" in result.output

    def test_json_dump(self) -> None:
        result = json_dump({"key": "value", "num": 42})
        assert '"key"' in result
        assert '"value"' in result
        assert "42" in result
