"""Tests for engine/api/routes/mcp.py -- MCP server listing and registration endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from engine.api.routes import init_routes, router


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_client(mcp=None):
    """Build a TestClient with fine-grained control over the MCP module."""
    app = FastAPI()
    app.include_router(router, prefix="/api")

    mock_tools = MagicMock()
    mock_tools._history = None
    mock_tools._approval = None
    mock_tools._dynamic = None

    with (
        patch("engine.api.routes.SkillLoader", return_value=MagicMock()),
        patch("engine.api.routes.ToolRegistry", return_value=mock_tools),
    ):
        init_routes(
            agent_loop=AsyncMock(),
            memory=AsyncMock(),
            skill_registry=None,
            learning=None,
            cron=None,
            agent_router=MagicMock(),
            mcp=mcp,
            api_key="test-key",
            decomposer=None,
            orchestrator=None,
            metrics=None,
            config=None,
            collaboration=None,
            rag_collections=None,
            rag_pipeline=None,
        )

    tc = TestClient(app, raise_server_exceptions=False)
    return tc


def _make_mcp(**overrides):
    """Create a mock MCP module."""
    mcp = MagicMock()
    mcp.list_servers = MagicMock(return_value=overrides.get("servers", []))
    mcp.list_tools = MagicMock(return_value=overrides.get("tools", []))
    mcp.register_server = MagicMock()
    mcp.discover_tools = AsyncMock(return_value=overrides.get("discovered_tools", []))
    return mcp


# ===================================================================
# GET /api/mcp/servers
# ===================================================================


class TestMCPServersList:
    """GET /api/mcp/servers"""

    def test_returns_empty_when_no_mcp_module(self):
        # Arrange
        c = _build_client(mcp=None)
        # Act
        resp = c.get("/api/mcp/servers")
        # Assert
        assert resp.status_code == 200
        assert resp.json()["servers"] == []

    def test_returns_servers_and_tools(self):
        # Arrange
        servers = [
            {"name": "weather-mcp", "url": "http://localhost:8081", "status": "connected"},
            {"name": "db-mcp", "url": "http://localhost:8082", "status": "connected"},
        ]
        tools = [
            {"name": "get_weather", "description": "Get weather data"},
            {"name": "query_db", "description": "Query the database"},
        ]
        mcp = _make_mcp(servers=servers, tools=tools)
        c = _build_client(mcp=mcp)
        # Act
        resp = c.get("/api/mcp/servers")
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["servers"]) == 2
        assert data["servers"][0]["name"] == "weather-mcp"
        assert len(data["tools"]) == 2
        assert data["tools"][1]["name"] == "query_db"

    def test_returns_empty_servers_when_mcp_initialized_but_empty(self):
        # Arrange
        mcp = _make_mcp(servers=[], tools=[])
        c = _build_client(mcp=mcp)
        # Act
        resp = c.get("/api/mcp/servers")
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["servers"] == []
        assert data["tools"] == []

    def test_calls_list_servers_and_list_tools(self):
        # Arrange
        mcp = _make_mcp()
        c = _build_client(mcp=mcp)
        # Act
        resp = c.get("/api/mcp/servers")
        # Assert
        assert resp.status_code == 200
        mcp.list_servers.assert_called_once()
        mcp.list_tools.assert_called_once()


# ===================================================================
# POST /api/mcp/servers
# ===================================================================


class TestMCPRegister:
    """POST /api/mcp/servers"""

    def test_returns_503_when_no_mcp_module(self):
        # Arrange
        c = _build_client(mcp=None)
        # Act
        resp = c.post("/api/mcp/servers", json={"name": "test", "url": "http://localhost:8080"})
        # Assert
        assert resp.status_code == 503
        assert "not initialized" in resp.json()["detail"].lower()

    def test_registers_server_successfully(self):
        # Arrange
        discovered = [
            {"name": "tool_a", "description": "Tool A"},
            {"name": "tool_b", "description": "Tool B"},
            {"name": "tool_c", "description": "Tool C"},
        ]
        mcp = _make_mcp(discovered_tools=discovered)
        c = _build_client(mcp=mcp)
        # Act
        resp = c.post("/api/mcp/servers", json={"name": "my-mcp", "url": "http://localhost:9000", "api_key": "secret"})
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["server"] == "my-mcp"
        assert data["tools_discovered"] == 3
        mcp.register_server.assert_called_once()
        mcp.discover_tools.assert_awaited_once_with("my-mcp")

    def test_registers_server_with_empty_fields(self):
        # Arrange -- name and url are empty strings
        mcp = _make_mcp(discovered_tools=[])
        c = _build_client(mcp=mcp)
        # Act
        resp = c.post("/api/mcp/servers", json={"name": "", "url": ""})
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["tools_discovered"] == 0

    def test_registers_server_without_api_key(self):
        # Arrange
        mcp = _make_mcp(discovered_tools=[{"name": "t1"}])
        c = _build_client(mcp=mcp)
        # Act
        resp = c.post("/api/mcp/servers", json={"name": "public-mcp", "url": "http://localhost:1234"})
        # Assert
        assert resp.status_code == 200
        assert resp.json()["tools_discovered"] == 1

    def test_returns_zero_tools_when_none_discovered(self):
        # Arrange
        mcp = _make_mcp(discovered_tools=[])
        c = _build_client(mcp=mcp)
        # Act
        resp = c.post("/api/mcp/servers", json={"name": "empty-mcp", "url": "http://localhost:5555"})
        # Assert
        assert resp.status_code == 200
        assert resp.json()["tools_discovered"] == 0
