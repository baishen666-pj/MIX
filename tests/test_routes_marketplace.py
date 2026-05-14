"""HTTP-level tests for marketplace routes in engine.api.routes.plugins."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from engine.skills.marketplace import MarketplaceIndex


def _build_client(
    marketplace: MarketplaceIndex | None = None,
    skill_registry: MagicMock | None = None,
) -> TestClient:
    from engine.api.routes import init_routes
    from engine.main import create_app
    from engine.config import MixConfig

    config = MixConfig.load()
    # Suppress side-effects
    config.memory.db_path = Path("test_mp.db")

    with (
        patch("engine.main.MemoryStore") as MockMem,
        patch("engine.main.ToolRegistry"),
        patch("engine.main.DynamicToolRegistry"),
        patch("engine.main.ApprovalManager"),
        patch("engine.main.ToolHistory"),
        patch("engine.main.AgentLoop"),
        patch("engine.main.SkillRegistry", return_value=skill_registry or MagicMock()),
        patch("engine.main.LearningLoop"),
        patch("engine.main.CronScheduler"),
        patch("engine.main.AgentRouter"),
        patch("engine.main.MCPClient"),
        patch("engine.main.AgentBus"),
        patch("engine.main.TaskDecomposer"),
        patch("engine.main.TaskOrchestrator"),
        patch("engine.main.CollaborationEngine"),
        patch("engine.main.MetricsCollector"),
        patch("engine.main.SkillWatcher"),
        patch("engine.main.PluginContext"),
        patch("engine.main.RAGPipeline", return_value=None),
    ):
        mock_mem = MagicMock()
        MockMem.return_value = mock_mem

        app = create_app(config)

    # Manually init routes with our marketplace
    from engine.api import routes as routes_mod
    from engine.skills.loader import SkillLoader
    from engine.tools.registry import ToolRegistry

    reg = skill_registry or MagicMock()
    reg.skills = {}
    routes_mod._skill_registry = reg
    routes_mod._skill_loader = SkillLoader()
    routes_mod._marketplace = marketplace

    return TestClient(app, raise_server_exceptions=False)


# -- helpers ---------------------------------------------------------------

def _make_marketplace(tmp_path: Path, entries: list[dict]) -> MarketplaceIndex:
    p = tmp_path / "idx.json"
    p.write_text(json.dumps({"version": 1, "entries": entries}), encoding="utf-8")
    idx = MarketplaceIndex(p)
    idx.load()
    return idx


# -- tests -----------------------------------------------------------------


class TestMarketplaceList:
    def test_returns_entries(self, tmp_path: Path) -> None:
        mp = _make_marketplace(tmp_path, [
            {"id": "a", "name": "A", "description": "desc", "version": "1",
             "category": "utilities", "tags": [], "source_url": "", "handler": "python", "triggers": []},
        ])
        client = _build_client(marketplace=mp)
        resp = client.get("/api/plugins/marketplace")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["entries"]) == 1
        assert body["entries"][0]["id"] == "a"

    def test_empty_without_marketplace(self) -> None:
        client = _build_client(marketplace=None)
        resp = client.get("/api/plugins/marketplace")
        assert resp.status_code == 200
        assert resp.json()["entries"] == []

    def test_filters_by_category(self, tmp_path: Path) -> None:
        mp = _make_marketplace(tmp_path, [
            {"id": "a", "name": "A", "description": "", "version": "1",
             "category": "utilities", "tags": [], "source_url": "", "handler": "python", "triggers": []},
            {"id": "b", "name": "B", "description": "", "version": "1",
             "category": "data", "tags": [], "source_url": "", "handler": "python", "triggers": []},
        ])
        client = _build_client(marketplace=mp)
        resp = client.get("/api/plugins/marketplace?category=utilities")
        assert len(resp.json()["entries"]) == 1

    def test_filters_by_query(self, tmp_path: Path) -> None:
        mp = _make_marketplace(tmp_path, [
            {"id": "a", "name": "Weather", "description": "weather tool", "version": "1",
             "category": "utilities", "tags": [], "source_url": "", "handler": "python", "triggers": []},
        ])
        client = _build_client(marketplace=mp)
        resp = client.get("/api/plugins/marketplace?q=weather")
        assert len(resp.json()["entries"]) == 1
        resp2 = client.get("/api/plugins/marketplace?q=nope")
        assert len(resp2.json()["entries"]) == 0


class TestMarketplaceDetail:
    def test_returns_entry(self, tmp_path: Path) -> None:
        mp = _make_marketplace(tmp_path, [
            {"id": "calc", "name": "Calc", "description": "math", "version": "1",
             "category": "utilities", "tags": [], "source_url": "", "handler": "python", "triggers": ["/calc"]},
        ])
        client = _build_client(marketplace=mp)
        resp = client.get("/api/plugins/marketplace/calc")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Calc"

    def test_404_for_unknown(self, tmp_path: Path) -> None:
        mp = _make_marketplace(tmp_path, [])
        client = _build_client(marketplace=mp)
        resp = client.get("/api/plugins/marketplace/nope")
        assert resp.status_code == 404

    def test_503_without_marketplace(self) -> None:
        client = _build_client(marketplace=None)
        resp = client.get("/api/plugins/marketplace/x")
        assert resp.status_code == 503


class TestMarketplaceInstall:
    def test_returns_404_for_unknown(self, tmp_path: Path) -> None:
        mp = _make_marketplace(tmp_path, [])
        client = _build_client(marketplace=mp)
        resp = client.post("/api/plugins/marketplace/install", json={"id": "nope"})
        assert resp.status_code == 404

    def test_503_without_registry(self, tmp_path: Path) -> None:
        mp = _make_marketplace(tmp_path, [
            {"id": "x", "name": "X", "description": "", "version": "1",
             "category": "utilities", "tags": [], "source_url": "https://example.com/x",
             "handler": "python", "triggers": []},
        ])
        reg = MagicMock()
        reg.skills = {}
        client = _build_client(marketplace=mp, skill_registry=reg)
        # Simulate registry being None at request time
        from engine.api import routes as routes_mod
        routes_mod._skill_registry = None
        resp = client.post("/api/plugins/marketplace/install", json={"id": "x"})
        assert resp.status_code == 503
        routes_mod._skill_registry = reg

    def test_400_for_missing_id(self, tmp_path: Path) -> None:
        mp = _make_marketplace(tmp_path, [])
        client = _build_client(marketplace=mp)
        resp = client.post("/api/plugins/marketplace/install", json={})
        assert resp.status_code == 400


class TestMarketplaceRefresh:
    def test_refresh_returns_count(self, tmp_path: Path) -> None:
        mp = _make_marketplace(tmp_path, [
            {"id": "a", "name": "A", "description": "", "version": "1",
             "category": "utilities", "tags": [], "source_url": "", "handler": "python", "triggers": []},
        ])
        client = _build_client(marketplace=mp)
        resp = client.post("/api/plugins/marketplace/refresh")
        assert resp.status_code == 200
        assert resp.json()["entries_loaded"] >= 1

    def test_503_without_marketplace(self) -> None:
        client = _build_client(marketplace=None)
        resp = client.post("/api/plugins/marketplace/refresh")
        assert resp.status_code == 503


class TestPluginsAlias:
    def test_get_plugins_returns_available(self) -> None:
        reg = MagicMock()
        reg.skills = {}
        reg.list_available.return_value = [{"name": "test", "version": "1"}]
        client = _build_client(skill_registry=reg)
        resp = client.get("/api/plugins")
        assert resp.status_code == 200
        assert len(resp.json()["plugins"]) == 1
