"""Shared fixtures for API route tests."""

from __future__ import annotations

import sys
import warnings
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from engine.api.routes import init_routes, router

# Suppress Windows ProactorEventLoop "Event loop is closed" warnings
if sys.platform == "win32":
    warnings.filterwarnings("ignore", message=".*Event loop is closed.*", category=ResourceWarning)


def _make_mock_agent_loop() -> AsyncMock:
    loop = AsyncMock()
    loop.chat = AsyncMock(
        return_value={
            "id": "resp-1",
            "session_id": "sess-1",
            "content": "Hello back",
            "tool_calls": None,
            "metadata": None,
        }
    )
    loop.chat_stream = MagicMock()
    return loop


def _make_mock_memory() -> AsyncMock:
    memory = AsyncMock()
    memory.search = AsyncMock(return_value=[])
    memory.get = AsyncMock(return_value=None)
    memory.delete = AsyncMock(return_value=True)
    memory.store = AsyncMock()
    memory.ingest_document = AsyncMock(return_value=["id1", "id2"])
    memory.list_sessions = AsyncMock(return_value=[])
    memory.save_session = AsyncMock()
    memory.load_session = AsyncMock(return_value=None)
    memory.delete_session = AsyncMock(return_value=False)
    memory.search_sessions = AsyncMock(return_value=[])
    memory.export_session = AsyncMock(return_value=None)
    return memory


def _make_mock_metrics() -> AsyncMock:
    metrics = AsyncMock()
    metrics.get_metrics = AsyncMock(
        return_value={
            "uptime_seconds": 100.0,
            "window_seconds": 60,
            "requests": {
                "total": 0,
                "by_endpoint": {},
                "by_status": {},
                "avg_duration_ms": 0.0,
                "p95_duration_ms": 0.0,
                "recent_count": 0,
            },
            "llm": {
                "total_calls": 0,
                "by_provider": {},
                "avg_latency_ms": 0.0,
                "total_tokens": 0,
                "recent_calls": 0,
            },
            "sessions": {"active_count": 0},
            "memory": {"entry_count": 0},
            "timestamp": 1234567890.0,
        }
    )
    metrics.prometheus_format = AsyncMock(return_value="# mix test metrics\nmix_uptime_seconds 100\n")
    return metrics


def _make_mock_agent_router() -> MagicMock:
    ar = MagicMock()
    ar.list_agents = MagicMock(return_value=[])
    ar.register_agent = MagicMock(side_effect=Exception("not implemented"))
    ar.get_agent = MagicMock(return_value=None)
    ar.update_agent = MagicMock(return_value=False)
    ar.delete_agent = MagicMock(return_value=False)
    return ar


def _make_mock_config() -> MagicMock:
    cfg = MagicMock()
    cfg._to_dict = MagicMock(
        return_value={
            "engine": {"host": "127.0.0.1", "port": 18700, "debug": False},
            "llm": {"provider": "openrouter", "model": "openai/gpt-4o"},
        }
    )
    return cfg


def _make_mock_collaboration() -> MagicMock:
    collab = MagicMock()
    plan = MagicMock()
    plan.id = "plan-1"
    plan.status = "completed"
    collab.create_plan = MagicMock(return_value=plan)
    collab.execute_plan = AsyncMock(return_value={"answer": "done"})
    collab.get_plan_status = MagicMock(return_value=None)
    collab.get_active_plans = MagicMock(return_value=[])
    return collab


def _make_mock_rag_collections() -> AsyncMock:
    mgr = AsyncMock()
    collection = MagicMock()
    collection.id = "coll-1"
    collection.name = "test-collection"
    collection.description = "A test collection"
    collection.document_count = 0
    collection.embedding_model = "all-MiniLM-L6-v2"
    mgr.create_collection = AsyncMock(return_value=collection)
    mgr.list_collections = AsyncMock(return_value=[collection])
    mgr.get_collection = AsyncMock(return_value=collection)
    mgr.delete_collection = AsyncMock(return_value=True)
    mgr.list_documents = AsyncMock(return_value=[])
    mgr.delete_document = AsyncMock(return_value=True)
    return mgr


def _make_mock_rag_pipeline() -> AsyncMock:
    pipe = AsyncMock()
    response = MagicMock()
    response.answer = "Test answer"
    response.citations = []
    response.retrieved_chunks = 3
    response.reranked_chunks = 2
    response.latency_ms = 42.5
    pipe.query = AsyncMock(return_value=response)
    pipe.ingest = AsyncMock(return_value={"chunks": 5})
    return pipe


@pytest.fixture()
def client():
    """Create a TestClient with mocked dependencies injected via init_routes."""
    app = FastAPI()
    app.include_router(router, prefix="/api")

    agent_loop = _make_mock_agent_loop()
    memory = _make_mock_memory()
    metrics = _make_mock_metrics()
    agent_router = _make_mock_agent_router()
    config = _make_mock_config()
    collaboration = _make_mock_collaboration()
    rag_collections = _make_mock_rag_collections()
    rag_pipeline = _make_mock_rag_pipeline()

    mock_tools = MagicMock()
    mock_tools._history = None
    mock_tools._approval = None
    mock_tools._dynamic = None

    with (
        patch("engine.api.routes.SkillLoader", return_value=MagicMock()),
        patch("engine.api.routes.ToolRegistry", return_value=mock_tools),
    ):
        init_routes(
            agent_loop=agent_loop,
            memory=memory,
            skill_registry=None,
            learning=None,
            cron=None,
            agent_router=agent_router,
            mcp=None,
            api_key="test-key",
            decomposer=None,
            orchestrator=None,
            metrics=metrics,
            config=config,
            collaboration=collaboration,
            rag_collections=rag_collections,
            rag_pipeline=rag_pipeline,
        )

    tc = TestClient(app, raise_server_exceptions=False)
    # Attach mocks for assertions in tests
    tc._mocks = {
        "agent_loop": agent_loop,
        "memory": memory,
        "metrics": metrics,
        "agent_router": agent_router,
        "config": config,
        "collaboration": collaboration,
        "rag_collections": rag_collections,
        "rag_pipeline": rag_pipeline,
    }
    return tc
