"""Tests for engine.api.routes package state management.

Covers module-level defaults, init_routes() assignments, reinit behavior,
and _state.py importability.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import engine.api.routes as routes_mod
from engine.api.routes import init_routes
from engine.skills.loader import SkillLoader
from engine.tools.registry import ToolRegistry


def _patch_deps():
    """Context manager that patches SkillLoader and ToolRegistry constructors."""
    return (
        patch.object(SkillLoader, "__init__", return_value=None),
        patch.object(ToolRegistry, "__init__", return_value=None),
    )


class TestInitRoutesAssignsState:
    def test_sets_agent_loop(self):
        mock = AsyncMock()
        with _patch_deps()[0], _patch_deps()[1]:
            init_routes(agent_loop=mock)
        assert routes_mod._agent_loop is mock

    def test_sets_memory(self):
        mock = AsyncMock()
        with _patch_deps()[0], _patch_deps()[1]:
            init_routes(agent_loop=AsyncMock(), memory=mock)
        assert routes_mod._memory is mock

    def test_sets_api_key(self):
        with _patch_deps()[0], _patch_deps()[1]:
            init_routes(agent_loop=AsyncMock(), api_key="secret-key")
        assert routes_mod._api_key == "secret-key"

    def test_sets_optional_params(self):
        with _patch_deps()[0], _patch_deps()[1]:
            init_routes(
                agent_loop=AsyncMock(),
                skill_registry=MagicMock(),
                learning=MagicMock(),
                cron=MagicMock(),
                agent_router=MagicMock(),
                mcp=MagicMock(),
                decomposer=MagicMock(),
                orchestrator=MagicMock(),
                metrics=AsyncMock(),
                config=MagicMock(),
                collaboration=MagicMock(),
                rag_collections=AsyncMock(),
                rag_pipeline=AsyncMock(),
            )
        assert routes_mod._skill_registry is not None
        assert routes_mod._learning is not None
        assert routes_mod._cron is not None
        assert routes_mod._agent_router is not None
        assert routes_mod._mcp is not None
        assert routes_mod._decomposer is not None
        assert routes_mod._orchestrator is not None
        assert routes_mod._metrics is not None
        assert routes_mod._config is not None
        assert routes_mod._collaboration is not None
        assert routes_mod._rag_collections is not None
        assert routes_mod._rag_pipeline is not None

    def test_creates_skill_loader_instance(self):
        with (
            patch.object(SkillLoader, "__init__", return_value=None) as mock_init,
            _patch_deps()[1],
        ):
            init_routes(agent_loop=AsyncMock())
        mock_init.assert_called_once()
        assert isinstance(routes_mod._skill_loader, SkillLoader)

    def test_creates_tool_registry_instance(self):
        with (
            _patch_deps()[0],
            patch.object(ToolRegistry, "__init__", return_value=None) as mock_init,
        ):
            init_routes(agent_loop=AsyncMock())
        mock_init.assert_called_once()
        assert isinstance(routes_mod._tools, ToolRegistry)


class TestReinitOverwrites:
    def test_overwrites_previous_state(self):
        mock_1 = AsyncMock(name="first")
        mock_2 = AsyncMock(name="second")
        with _patch_deps()[0], _patch_deps()[1]:
            init_routes(agent_loop=mock_1)
            assert routes_mod._agent_loop is mock_1
            init_routes(agent_loop=mock_2)
            assert routes_mod._agent_loop is mock_2

    def test_overwrites_api_key(self):
        with _patch_deps()[0], _patch_deps()[1]:
            init_routes(agent_loop=AsyncMock(), api_key="old")
            init_routes(agent_loop=AsyncMock(), api_key="new")
        assert routes_mod._api_key == "new"


class TestStateModule:
    def test_state_module_importable(self):
        from engine.api.routes import _state as state

        assert state is not None

    def test_router_exists(self):
        assert routes_mod.router is not None
