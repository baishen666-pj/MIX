"""Routes package -- re-exports ``init_routes``, ``router``, and all names that
external code may patch so that existing imports continue to work unchanged.

Import patterns preserved:
    from engine.api.routes import init_routes, router
    from engine.api import routes as routes_mod
    patch("engine.api.routes.SkillLoader", ...)
    patch("engine.api.routes.ToolRegistry", ...)
    routes_mod._tools, routes_mod._memory, ...
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

# -- Sub-module routers ----------------------------------------------------
from engine.api.routes import (
    agents,
    chat,
    cron,
    health,
    learning,
    mcp,
    memory,
    models,
    plugins,
    rag,
    sessions,
    skills,
    tools,
    voice,
)

# Re-export classes that tests patch at the *package* level.
from engine.skills.loader import SkillLoader
from engine.tools.registry import ToolRegistry

# -- Compose the unified router -------------------------------------------

router = APIRouter()

for _sub in (
    health,
    chat,
    memory,
    sessions,
    plugins,
    skills,
    learning,
    cron,
    tools,
    agents,
    models,
    mcp,
    rag,
    voice,
):
    router.include_router(_sub.router)


# -- Module-level state (tests do routes_mod._tools, etc.) -----------------

_agent_loop: Any = None
_memory: Any = None
_skill_registry: Any = None
_skill_loader: Any = None
_learning: Any = None
_cron: Any = None
_tools: Any = None
_agent_router: Any = None
_mcp: Any = None
_api_key: str = ""
_decomposer: Any = None
_orchestrator: Any = None
_metrics: Any = None
_config: Any = None
_collaboration: Any = None
_rag_collections: Any = None
_rag_pipeline: Any = None


# -- init_routes -----------------------------------------------------------


def init_routes(
    agent_loop: Any,
    memory: Any | None = None,
    skill_registry: Any | None = None,
    learning: Any | None = None,
    cron: Any | None = None,
    agent_router: Any | None = None,
    mcp: Any | None = None,
    api_key: str = "",
    decomposer: Any | None = None,
    orchestrator: Any | None = None,
    metrics: Any | None = None,
    config: Any | None = None,
    collaboration: Any | None = None,
    rag_collections: Any | None = None,
    rag_pipeline: Any | None = None,
) -> None:
    """Initialise shared state consumed by all sub-module route handlers."""
    global \
        _agent_loop, \
        _memory, \
        _skill_registry, \
        _skill_loader, \
        _learning, \
        _cron, \
        _tools, \
        _agent_router, \
        _mcp, \
        _api_key, \
        _decomposer, \
        _orchestrator, \
        _metrics, \
        _config, \
        _collaboration, \
        _rag_collections, \
        _rag_pipeline
    _agent_loop = agent_loop
    _memory = memory
    _skill_registry = skill_registry
    _skill_loader = SkillLoader()
    _learning = learning
    _cron = cron
    _tools = ToolRegistry()
    _agent_router = agent_router
    _mcp = mcp
    _api_key = api_key
    _decomposer = decomposer
    _orchestrator = orchestrator
    _metrics = metrics
    _config = config
    _collaboration = collaboration
    _rag_collections = rag_collections
    _rag_pipeline = rag_pipeline
