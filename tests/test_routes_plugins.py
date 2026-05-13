"""Tests for engine/api/routes/plugins.py -- plugin reload, install, uninstall,
update, and available-list endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from engine.api.routes import init_routes, router


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_client(skill_registry=None):
    """Build a TestClient with fine-grained control over skill_registry."""
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
            skill_registry=skill_registry,
            learning=None,
            cron=None,
            agent_router=MagicMock(),
            mcp=None,
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


def _make_skill_registry(**overrides):
    """Create a mock skill registry with standard method stubs."""
    reg = MagicMock()
    reg.load_all = MagicMock(return_value=overrides.get("load_all_count", 5))
    reg.list_available = MagicMock(return_value=overrides.get("available", []))
    reg.install = MagicMock(return_value=overrides.get("install_manifest", None))
    reg.uninstall = MagicMock(return_value=overrides.get("uninstall_result", True))
    reg.update = MagicMock(return_value=overrides.get("update_manifest", None))
    return reg


def _make_manifest(name="test-skill", version="1.0.0"):
    m = MagicMock()
    m.name = name
    m.version = version
    return m


# ===================================================================
# POST /api/plugins/reload
# ===================================================================


class TestPluginsReload:
    """POST /api/plugins/reload"""

    def test_returns_503_when_no_registry(self):
        # Arrange
        c = _build_client(skill_registry=None)
        # Act
        resp = c.post("/api/plugins/reload")
        # Assert
        assert resp.status_code == 503
        assert "detail" in resp.json()

    def test_reloads_skills_and_returns_count(self):
        # Arrange
        registry = _make_skill_registry(load_all_count=7)
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.post("/api/plugins/reload")
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["skills_loaded"] == 7
        registry.load_all.assert_called_once()

    def test_reload_returns_zero_skills(self):
        # Arrange
        registry = _make_skill_registry(load_all_count=0)
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.post("/api/plugins/reload")
        # Assert
        assert resp.status_code == 200
        assert resp.json()["skills_loaded"] == 0


# ===================================================================
# POST /api/plugins/install
# ===================================================================


class TestPluginsInstall:
    """POST /api/plugins/install"""

    def test_returns_503_when_no_registry(self):
        # Arrange
        c = _build_client(skill_registry=None)
        # Act
        resp = c.post("/api/plugins/install", json={"source": "https://example.com"})
        # Assert
        assert resp.status_code == 503
        assert "not initialized" in resp.json()["detail"].lower()

    def test_returns_400_when_source_missing(self):
        # Arrange
        registry = _make_skill_registry()
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.post("/api/plugins/install", json={"version": "2.0"})
        # Assert
        assert resp.status_code == 400
        assert "source" in resp.json()["detail"].lower()

    def test_returns_400_when_source_empty_string(self):
        # Arrange
        registry = _make_skill_registry()
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.post("/api/plugins/install", json={"source": ""})
        # Assert
        assert resp.status_code == 400

    def test_returns_400_when_install_fails(self):
        # Arrange -- install returns None to indicate failure
        registry = _make_skill_registry(install_manifest=None)
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.post("/api/plugins/install", json={"source": "https://bad.example.com"})
        # Assert
        assert resp.status_code == 400
        assert "failed" in resp.json()["detail"].lower()

    def test_installs_skill_successfully(self):
        # Arrange
        manifest = _make_manifest("my-plugin", "2.5.0")
        registry = _make_skill_registry(install_manifest=manifest)
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.post("/api/plugins/install", json={"source": "https://example.com/plugin", "version": "2.5.0"})
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["skill"]["name"] == "my-plugin"
        assert data["skill"]["version"] == "2.5.0"
        registry.install.assert_called_once_with("https://example.com/plugin", version="2.5.0")

    def test_installs_without_version(self):
        # Arrange
        manifest = _make_manifest("bare-plugin", "1.0")
        registry = _make_skill_registry(install_manifest=manifest)
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.post("/api/plugins/install", json={"source": "https://example.com/p"})
        # Assert
        assert resp.status_code == 200
        registry.install.assert_called_once_with("https://example.com/p", version=None)


# ===================================================================
# POST /api/plugins/uninstall
# ===================================================================


class TestPluginsUninstall:
    """POST /api/plugins/uninstall"""

    def test_returns_503_when_no_registry(self):
        # Arrange
        c = _build_client(skill_registry=None)
        # Act
        resp = c.post("/api/plugins/uninstall", json={"name": "test"})
        # Assert
        assert resp.status_code == 503

    def test_returns_400_when_name_missing(self):
        # Arrange
        registry = _make_skill_registry()
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.post("/api/plugins/uninstall", json={})
        # Assert
        assert resp.status_code == 400
        assert "name" in resp.json()["detail"].lower()

    def test_returns_400_when_name_empty(self):
        # Arrange
        registry = _make_skill_registry()
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.post("/api/plugins/uninstall", json={"name": ""})
        # Assert
        assert resp.status_code == 400

    def test_returns_404_when_skill_not_found(self):
        # Arrange -- uninstall returns False
        registry = _make_skill_registry(uninstall_result=False)
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.post("/api/plugins/uninstall", json={"name": "nonexistent"})
        # Assert
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_uninstalls_skill_successfully(self):
        # Arrange
        registry = _make_skill_registry(uninstall_result=True)
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.post("/api/plugins/uninstall", json={"name": "old-plugin"})
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["removed"] == "old-plugin"
        registry.uninstall.assert_called_once_with("old-plugin")


# ===================================================================
# POST /api/plugins/update
# ===================================================================


class TestPluginsUpdate:
    """POST /api/plugins/update"""

    def test_returns_503_when_no_registry(self):
        # Arrange
        c = _build_client(skill_registry=None)
        # Act
        resp = c.post("/api/plugins/update", json={"name": "test"})
        # Assert
        assert resp.status_code == 503

    def test_returns_400_when_name_missing(self):
        # Arrange
        registry = _make_skill_registry()
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.post("/api/plugins/update", json={})
        # Assert
        assert resp.status_code == 400

    def test_returns_400_when_name_empty(self):
        # Arrange
        registry = _make_skill_registry()
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.post("/api/plugins/update", json={"name": ""})
        # Assert
        assert resp.status_code == 400

    def test_returns_404_when_skill_not_found_or_no_source(self):
        # Arrange -- update returns None
        registry = _make_skill_registry(update_manifest=None)
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.post("/api/plugins/update", json={"name": "ghost-plugin"})
        # Assert
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower() or "no source" in resp.json()["detail"].lower()

    def test_updates_skill_successfully(self):
        # Arrange
        manifest = _make_manifest("updatable-plugin", "3.0.0")
        registry = _make_skill_registry(update_manifest=manifest)
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.post("/api/plugins/update", json={"name": "updatable-plugin"})
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["skill"]["name"] == "updatable-plugin"
        assert data["skill"]["version"] == "3.0.0"
        registry.update.assert_called_once_with("updatable-plugin")


# ===================================================================
# GET /api/plugins/available
# ===================================================================


class TestPluginsAvailable:
    """GET /api/plugins/available"""

    def test_returns_empty_list_when_no_registry(self):
        # Arrange
        c = _build_client(skill_registry=None)
        # Act
        resp = c.get("/api/plugins/available")
        # Assert
        assert resp.status_code == 200
        assert resp.json()["plugins"] == []

    def test_returns_available_plugins_without_query(self):
        # Arrange
        available = [
            {"name": "weather", "version": "1.0"},
            {"name": "calculator", "version": "2.3"},
        ]
        registry = _make_skill_registry(available=available)
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.get("/api/plugins/available")
        # Assert
        assert resp.status_code == 200
        plugins = resp.json()["plugins"]
        assert len(plugins) == 2
        assert plugins[0]["name"] == "weather"
        registry.list_available.assert_called_once_with(query="")

    def test_returns_filtered_plugins_with_query(self):
        # Arrange
        filtered = [{"name": "weather", "version": "1.0"}]
        registry = _make_skill_registry(available=filtered)
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.get("/api/plugins/available?q=wea")
        # Assert
        assert resp.status_code == 200
        plugins = resp.json()["plugins"]
        assert len(plugins) == 1
        registry.list_available.assert_called_once_with(query="wea")

    def test_returns_empty_when_no_plugins_match_query(self):
        # Arrange
        registry = _make_skill_registry(available=[])
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.get("/api/plugins/available?q=nonexistent")
        # Assert
        assert resp.status_code == 200
        assert resp.json()["plugins"] == []
