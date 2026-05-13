"""Comprehensive unit tests for engine/api/routes.py.

Covers all endpoint groups: Health, Config, Metrics, Tools, Agents,
RAG, Skills, Sessions, Memory, Plugins, Learning, Cron, Chat, Voice,
Model routing, MCP, and Collaboration.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from starlette.testclient import TestClient

from engine.api.routes import init_routes, router

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_client(**overrides):
    """Build a TestClient with fine-grained control over which deps are set."""
    app = FastAPI()
    app.include_router(router, prefix="/api")

    agent_loop = overrides.get("agent_loop", _default_agent_loop())
    memory = overrides.get("memory", _default_memory())
    metrics = overrides.get("metrics", _default_metrics())
    agent_router = overrides.get("agent_router", _default_agent_router())
    config = overrides.get("config", _default_config())
    collaboration = overrides.get("collaboration", _default_collaboration())
    rag_collections = overrides.get("rag_collections", _default_rag_collections())
    rag_pipeline = overrides.get("rag_pipeline", _default_rag_pipeline())
    skill_registry = overrides.get("skill_registry", None)
    learning = overrides.get("learning", None)
    cron = overrides.get("cron", None)

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
            skill_registry=skill_registry,
            learning=learning,
            cron=cron,
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
    tc._mocks = {
        "agent_loop": agent_loop,
        "memory": memory,
        "metrics": metrics,
        "agent_router": agent_router,
        "config": config,
        "collaboration": collaboration,
        "rag_collections": rag_collections,
        "rag_pipeline": rag_pipeline,
        "tools": mock_tools,
    }
    return tc


def _default_agent_loop():
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
    return loop


def _default_memory():
    return AsyncMock()


def _default_metrics():
    m = AsyncMock()
    m.get_metrics = AsyncMock(
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
            "llm": {"total_calls": 0, "by_provider": {}, "avg_latency_ms": 0.0, "total_tokens": 0, "recent_calls": 0},
            "sessions": {"active_count": 0},
            "memory": {"entry_count": 0},
            "timestamp": 1234567890.0,
        }
    )
    m.prometheus_format = AsyncMock(return_value="# mix metrics\nmix_uptime_seconds 100\n")
    return m


def _default_agent_router():
    ar = MagicMock()
    ar.list_agents = MagicMock(return_value=[])
    return ar


def _default_config():
    cfg = MagicMock()
    cfg._to_dict = MagicMock(return_value={"engine": {"host": "127.0.0.1"}})
    return cfg


def _default_collaboration():
    return MagicMock()


def _default_rag_collections():
    return AsyncMock()


def _default_rag_pipeline():
    return AsyncMock()


# ===================================================================
# 1. Health endpoint
# ===================================================================


class TestHealthEndpoint:
    """GET /api/health"""

    def test_returns_ok_status(self, client):
        # Act
        resp = client.get("/api/health")
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["version"] == "0.1.0"
        assert data["engine"] == "mix-python"

    def test_response_has_all_fields(self, client):
        # Act
        data = client.get("/api/health").json()
        # Assert
        assert {"status", "version", "engine"} == set(data.keys())


# ===================================================================
# 2. Config endpoints
# ===================================================================


class TestConfigGetEndpoint:
    """GET /api/config"""

    def test_returns_config_dict_when_initialized(self, client):
        # Act
        resp = client.get("/api/config")
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert "engine" in data

    def test_returns_error_when_not_initialized(self):
        # Arrange
        c = _build_client(config=None)
        # Act
        resp = c.get("/api/config")
        # Assert
        assert resp.status_code == 503
        assert "detail" in resp.json()


class TestConfigPutEndpoint:
    """PUT /api/config"""

    def test_updates_config_successfully(self, client):
        # Arrange
        payload = {"engine": {"host": "0.0.0.0", "port": 9999, "debug": True}}
        # MixConfig is lazily imported inside the handler, so patch the source module
        with patch("engine.config.MixConfig") as MockConfig:
            mock_cfg = MagicMock()
            MockConfig._from_dict.return_value = mock_cfg
            resp = client.put("/api/config", json=payload)
        # Assert
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_returns_503_when_config_not_initialized(self):
        # Arrange
        c = _build_client(config=None)
        # Act
        resp = c.put("/api/config", json={"engine": {}})
        # Assert
        assert resp.status_code == 503


# ===================================================================
# 3. Metrics endpoints
# ===================================================================


class TestMetricsEndpoint:
    """GET /api/metrics"""

    def test_returns_metrics_data(self, client):
        # Act
        resp = client.get("/api/metrics")
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert "uptime_seconds" in data
        assert "channels" in data

    def test_includes_channels_from_agent_router(self, client):
        # Arrange
        ar = client._mocks["agent_router"]
        ar.list_agents = MagicMock(
            return_value=[
                {"name": "a1", "channels": ["web", "slack"]},
                {"name": "a2", "channels": ["web"]},
            ]
        )
        # Act
        resp = client.get("/api/metrics")
        # Assert
        channels = resp.json()["channels"]
        assert set(channels) == {"web", "slack"}

    def test_returns_empty_channels_when_no_agent_router(self):
        # Arrange
        c = _build_client(agent_router=None)
        # Act
        resp = c.get("/api/metrics")
        # Assert
        assert resp.json()["channels"] == []

    def test_returns_error_when_metrics_not_initialized(self):
        # Arrange
        c = _build_client(metrics=None)
        # Act
        resp = c.get("/api/metrics")
        # Assert
        assert resp.status_code == 503
        assert "detail" in resp.json()


class TestMetricsPrometheusEndpoint:
    """GET /api/metrics/prometheus"""

    def test_returns_prometheus_text(self, client):
        # Act
        resp = client.get("/api/metrics/prometheus")
        # Assert
        assert resp.status_code == 200
        assert "mix_" in resp.text

    def test_content_type_is_prometheus(self, client):
        # Act
        resp = client.get("/api/metrics/prometheus")
        # Assert
        assert "text/plain" in resp.headers.get("content-type", "")

    def test_returns_error_text_when_not_initialized(self):
        # Arrange
        c = _build_client(metrics=None)
        # Act
        resp = c.get("/api/metrics/prometheus")
        # Assert
        assert "not initialized" in resp.text


# ===================================================================
# 4. Tools endpoints
# ===================================================================


class TestToolsListEndpoint:
    """GET /api/tools"""

    def test_returns_tools_list(self, client):
        # Act
        resp = client.get("/api/tools")
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert "tools" in data
        assert "definitions" in data

    def test_returns_empty_when_tools_not_initialized(self):
        # Arrange - init_routes creates a ToolRegistry by default,
        # so we patch ToolRegistry to return None-like behavior
        app = FastAPI()
        app.include_router(router, prefix="/api")
        # Reset _tools to None manually
        import engine.api.routes as routes_mod

        old_tools = routes_mod._tools
        routes_mod._tools = None
        try:
            tc = TestClient(app)
            resp = tc.get("/api/tools")
            assert resp.status_code == 200
            assert resp.json()["tools"] == []
        finally:
            routes_mod._tools = old_tools


class TestToolExecuteEndpoint:
    """POST /api/tools/{tool_name}/execute"""

    def test_executes_tool(self, client):
        # Arrange
        mock_tools = MagicMock()
        mock_result = MagicMock()
        mock_result.to_dict.return_value = {"output": "hello", "success": True}
        mock_tools.execute = AsyncMock(return_value=mock_result)
        import engine.api.routes as routes_mod

        old = routes_mod._tools
        routes_mod._tools = mock_tools
        try:
            # Act
            resp = client.post("/api/tools/bash/execute", json={"command": "echo hi"})
        finally:
            routes_mod._tools = old
        # Assert
        assert resp.status_code == 200
        assert resp.json()["output"] == "hello"


class TestToolsHistoryEndpoint:
    """GET /api/tools/history"""

    def test_returns_empty_history_when_no_history_subsystem(self):
        # Arrange - build a fresh client where _tools has _history=None
        c = _build_client()
        # Act
        resp = c.get("/api/tools/history")
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["records"] == []


class TestToolsApprovalPendingEndpoint:
    """GET /api/tools/approval/pending"""

    def test_returns_empty_when_no_approval_subsystem(self, client):
        # Act
        resp = client.get("/api/tools/approval/pending")
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["requests"] == []


# ===================================================================
# 5. Agents endpoints
# ===================================================================


class TestAgentsListEndpoint:
    """GET /api/agents"""

    def test_returns_default_agent_when_no_router(self):
        # Arrange
        c = _build_client(agent_router=None)
        # Act
        resp = c.get("/api/agents")
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["agents"]) == 1
        assert data["agents"][0]["name"] == "main"

    def test_returns_agents_from_router(self, client):
        # Arrange
        ar = client._mocks["agent_router"]
        ar.list_agents = MagicMock(
            return_value=[
                {"name": "coder", "channels": ["web"], "model": "gpt-4"},
            ]
        )
        # Act
        resp = c.get("/api/agents") if False else client.get("/api/agents")
        # Assert
        assert resp.status_code == 200
        agents = resp.json()["agents"]
        assert len(agents) == 1
        assert agents[0]["name"] == "coder"


class TestAgentsCreateEndpoint:
    """POST /api/agents"""

    def test_returns_503_when_no_router(self):
        # Arrange
        c = _build_client(agent_router=None)
        # Act
        resp = c.post("/api/agents", json={"name": "test", "role": "general"})
        # Assert
        assert resp.status_code == 503

    def test_returns_400_on_registration_error(self, client):
        # Arrange
        ar = client._mocks["agent_router"]
        ar.register_agent = MagicMock(side_effect=ValueError("duplicate name"))
        # Act
        resp = (
            c.post("/api/agents", json={"name": "test"}) if False else client.post("/api/agents", json={"name": "test"})
        )
        # Assert
        assert resp.status_code == 400


class TestAgentsCollaborateEndpoint:
    """POST /api/agents/collaborate"""

    def test_returns_503_when_no_collaboration(self):
        # Arrange
        c = _build_client(collaboration=None)
        # Act
        resp = c.post("/api/agents/collaborate", json={"task": "do stuff", "pattern": "sequential"})
        # Assert
        assert resp.status_code == 503

    def test_returns_400_on_invalid_pattern(self):
        # Arrange
        collab = MagicMock()
        c = _build_client(collaboration=collab)
        # Act
        resp = c.post("/api/agents/collaborate", json={"task": "do stuff", "pattern": "invalid_pattern"})
        # Assert
        assert resp.status_code == 400

    def test_successful_collaboration(self):
        # Arrange
        plan = MagicMock()
        plan.id = "plan-123"
        plan.status = "completed"
        collab = MagicMock()
        collab.create_plan = MagicMock(return_value=plan)
        collab.execute_plan = AsyncMock(return_value={"result": "done"})
        c = _build_client(collaboration=collab)
        # Act
        resp = c.post(
            "/api/agents/collaborate", json={"task": "write code", "pattern": "sequential", "agents": ["coder"]}
        )
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["plan_id"] == "plan-123"
        assert data["result"] == {"result": "done"}


class TestCollaborationStatusEndpoint:
    """GET /api/agents/collaborate/{plan_id}"""

    def test_returns_503_when_no_collaboration(self):
        c = _build_client(collaboration=None)
        resp = c.get("/api/agents/collaborate/plan-1")
        assert resp.status_code == 503

    def test_returns_404_when_plan_not_found(self):
        collab = MagicMock()
        collab.get_plan_status = MagicMock(return_value=None)
        c = _build_client(collaboration=collab)
        resp = c.get("/api/agents/collaborate/plan-1")
        assert resp.status_code == 404

    def test_returns_plan_status(self):
        collab = MagicMock()
        collab.get_plan_status = MagicMock(return_value={"id": "plan-1", "status": "completed"})
        c = _build_client(collaboration=collab)
        resp = c.get("/api/agents/collaborate/plan-1")
        assert resp.status_code == 200
        assert resp.json()["id"] == "plan-1"


class TestAgentsGetEndpoint:
    """GET /api/agents/{name}"""

    def test_returns_503_when_no_router(self):
        c = _build_client(agent_router=None)
        resp = c.get("/api/agents/test-agent")
        assert resp.status_code == 503

    def test_returns_404_when_agent_not_found(self, client):
        ar = client._mocks["agent_router"]
        ar.get_agent = MagicMock(return_value=None)
        resp = client.get("/api/agents/nonexistent")
        assert resp.status_code == 404

    def test_returns_agent_details(self, client):
        # Arrange
        agent = MagicMock()
        agent.name = "coder"
        agent.role = "code"
        agent.channels = ["web"]
        agent.allowed_users = ["user1"]
        agent.config = MagicMock()
        agent.config.llm.model = "gpt-4"
        agent.system_prompt = "You are a coder agent" + "x" * 200
        ar = client._mocks["agent_router"]
        ar.get_agent = MagicMock(return_value=agent)
        # Act
        resp = client.get("/api/agents/coder")
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "coder"
        assert data["role"] == "code"


class TestAgentsUpdateEndpoint:
    """PUT /api/agents/{name}"""

    def test_returns_503_when_no_router(self):
        c = _build_client(agent_router=None)
        resp = c.put("/api/agents/test", json={"channels": ["web"]})
        assert resp.status_code == 503

    def test_returns_404_when_not_found(self, client):
        ar = client._mocks["agent_router"]
        ar.update_agent = MagicMock(return_value=False)
        resp = client.put("/api/agents/test", json={"channels": ["web"]})
        assert resp.status_code == 404

    def test_updates_agent_successfully(self, client):
        ar = client._mocks["agent_router"]
        ar.update_agent = MagicMock(return_value=True)
        resp = client.put("/api/agents/test", json={"channels": ["web"]})
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestAgentsDeleteEndpoint:
    """DELETE /api/agents/{name}"""

    def test_returns_503_when_no_router(self):
        c = _build_client(agent_router=None)
        resp = c.delete("/api/agents/test")
        assert resp.status_code == 503

    def test_returns_404_when_not_found(self, client):
        ar = client._mocks["agent_router"]
        ar.delete_agent = MagicMock(return_value=False)
        resp = client.delete("/api/agents/test")
        assert resp.status_code == 404

    def test_deletes_agent_successfully(self, client):
        ar = client._mocks["agent_router"]
        ar.delete_agent = MagicMock(return_value=True)
        resp = client.delete("/api/agents/coder")
        assert resp.status_code == 200
        assert resp.json()["deleted"] == "coder"


# ===================================================================
# 6. RAG endpoints
# ===================================================================


class TestRAGCreateCollection:
    """POST /api/rag/collections"""

    def test_returns_503_when_not_initialized(self):
        c = _build_client(rag_collections=None)
        resp = c.post("/api/rag/collections", json={"name": "test", "description": "desc"})
        assert resp.status_code == 503

    def test_creates_collection(self, client):
        # Arrange
        collection = MagicMock()
        collection.id = "coll-1"
        collection.name = "test-col"
        rag_mgr = client._mocks["rag_collections"]
        rag_mgr.create_collection = AsyncMock(return_value=collection)
        # Act
        resp = client.post("/api/rag/collections", json={"name": "test-col", "description": "A test"})
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["collection"]["name"] == "test-col"


class TestRAGListCollections:
    """GET /api/rag/collections"""

    def test_returns_empty_when_not_initialized(self):
        c = _build_client(rag_collections=None)
        resp = c.get("/api/rag/collections")
        assert resp.status_code == 200
        assert resp.json()["collections"] == []

    def test_returns_collections(self, client):
        # Arrange
        coll = MagicMock()
        coll.id = "c1"
        coll.name = "docs"
        coll.description = "Documentation"
        coll.document_count = 5
        coll.embedding_model = "all-MiniLM-L6-v2"
        rag_mgr = client._mocks["rag_collections"]
        rag_mgr.list_collections = AsyncMock(return_value=[coll])
        # Act
        resp = client.get("/api/rag/collections")
        # Assert
        assert resp.status_code == 200
        colls = resp.json()["collections"]
        assert len(colls) == 1
        assert colls[0]["name"] == "docs"
        assert colls[0]["document_count"] == 5


class TestRAGQuery:
    """POST /api/rag/query"""

    def test_returns_503_when_not_initialized(self):
        c = _build_client(rag_pipeline=None)
        resp = c.post("/api/rag/query", json={"query": "test"})
        assert resp.status_code == 503

    def test_performs_query(self, client):
        # Arrange
        response = MagicMock()
        response.answer = "The answer is 42"
        response.citations = [{"source": "doc1", "text": "42"}]
        response.retrieved_chunks = 5
        response.reranked_chunks = 3
        response.latency_ms = 123.45
        pipe = client._mocks["rag_pipeline"]
        pipe.query = AsyncMock(return_value=response)
        # Act
        resp = client.post(
            "/api/rag/query",
            json={
                "query": "what is the answer?",
                "collection_ids": ["c1"],
                "top_k": 10,
            },
        )
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["answer"] == "The answer is 42"
        assert len(data["citations"]) == 1
        assert data["retrieved_chunks"] == 5


class TestRAGGetCollection:
    """GET /api/rag/collections/{collection_id}"""

    def test_returns_503_when_not_initialized(self):
        c = _build_client(rag_collections=None)
        resp = c.get("/api/rag/collections/c1")
        assert resp.status_code == 503

    def test_returns_404_when_not_found(self, client):
        rag_mgr = client._mocks["rag_collections"]
        rag_mgr.get_collection = AsyncMock(return_value=None)
        resp = client.get("/api/rag/collections/nonexistent")
        assert resp.status_code == 404

    def test_returns_collection_details(self, client):
        coll = MagicMock()
        coll.id = "c1"
        coll.name = "docs"
        coll.description = "desc"
        coll.document_count = 3
        coll.embedding_model = "model"
        rag_mgr = client._mocks["rag_collections"]
        rag_mgr.get_collection = AsyncMock(return_value=coll)
        resp = client.get("/api/rag/collections/c1")
        assert resp.status_code == 200
        assert resp.json()["name"] == "docs"


class TestRAGDeleteCollection:
    """DELETE /api/rag/collections/{collection_id}"""

    def test_returns_503_when_not_initialized(self):
        c = _build_client(rag_collections=None)
        resp = c.delete("/api/rag/collections/c1")
        assert resp.status_code == 503

    def test_returns_404_when_not_found(self, client):
        rag_mgr = client._mocks["rag_collections"]
        rag_mgr.delete_collection = AsyncMock(return_value=False)
        resp = client.delete("/api/rag/collections/nonexistent")
        assert resp.status_code == 404

    def test_deletes_collection(self, client):
        rag_mgr = client._mocks["rag_collections"]
        rag_mgr.delete_collection = AsyncMock(return_value=True)
        resp = client.delete("/api/rag/collections/c1")
        assert resp.status_code == 200
        assert resp.json()["deleted"] == "c1"


class TestRAGListDocuments:
    """GET /api/rag/collections/{collection_id}/documents"""

    def test_returns_empty_when_not_initialized(self):
        c = _build_client(rag_collections=None)
        resp = c.get("/api/rag/collections/c1/documents")
        assert resp.status_code == 200
        assert resp.json()["documents"] == []

    def test_returns_documents(self, client):
        doc = MagicMock()
        doc.id = "d1"
        doc.filename = "test.pdf"
        doc.chunk_count = 5
        doc.size_bytes = 1024
        doc.created_at = "2025-01-01T00:00:00"
        rag_mgr = client._mocks["rag_collections"]
        rag_mgr.list_documents = AsyncMock(return_value=[doc])
        resp = client.get("/api/rag/collections/c1/documents")
        assert resp.status_code == 200
        docs = resp.json()["documents"]
        assert len(docs) == 1
        assert docs[0]["filename"] == "test.pdf"


# ===================================================================
# 7. Skills endpoints
# ===================================================================


class TestSkillsListEndpoint:
    """GET /api/skills"""

    def test_returns_empty_when_not_initialized(self, client):
        # skill_registry is None by default in our fixture
        resp = client.get("/api/skills")
        assert resp.status_code == 200
        assert resp.json()["skills"] == []

    def test_returns_skills_from_registry(self):
        # Arrange
        from engine.skills.registry import SkillRegistry

        registry = SkillRegistry()
        from engine.skills.registry import SkillManifest

        registry.register(
            SkillManifest(
                name="test-skill",
                version="1.0",
                description="A test",
                trigger=["/test"],
                handler="python",
            )
        )
        c = _build_client(skill_registry=registry)
        # Act
        resp = c.get("/api/skills")
        # Assert
        assert resp.status_code == 200
        skills = resp.json()["skills"]
        assert len(skills) == 1
        assert skills[0]["name"] == "test-skill"


# ===================================================================
# 8. Sessions endpoints
# ===================================================================


class TestSessionsListEndpoint:
    """GET /api/sessions"""

    def test_returns_empty_when_memory_not_initialized(self):
        c = _build_client(memory=None)
        resp = c.get("/api/sessions")
        assert resp.status_code == 200
        assert resp.json()["sessions"] == []

    def test_returns_sessions_from_memory(self, client):
        mem = client._mocks["memory"]
        mem.list_sessions = AsyncMock(
            return_value=[
                {"id": "s1", "messages": 5},
            ]
        )
        resp = client.get("/api/sessions")
        assert resp.status_code == 200
        sessions = resp.json()["sessions"]
        assert len(sessions) == 1


class TestSessionSearchEndpoint:
    """GET /api/sessions/search"""

    def test_returns_empty_when_no_memory(self):
        c = _build_client(memory=None)
        resp = c.get("/api/sessions/search?q=test")
        assert resp.status_code == 200
        assert resp.json()["sessions"] == []

    def test_returns_all_sessions_when_no_query(self, client):
        mem = client._mocks["memory"]
        mem.list_sessions = AsyncMock(return_value=[{"id": "s1"}])
        resp = client.get("/api/sessions/search")
        assert resp.status_code == 200
        assert len(resp.json()["sessions"]) == 1

    def test_searches_sessions_with_query(self, client):
        mem = client._mocks["memory"]
        mem.search_sessions = AsyncMock(return_value=[{"id": "s2"}])
        resp = client.get("/api/sessions/search?q=test&limit=5&offset=0")
        assert resp.status_code == 200
        mem.search_sessions.assert_awaited_once_with("test", limit=5, offset=0)


class TestSessionGetEndpoint:
    """GET /api/sessions/{session_id}"""

    def test_returns_503_when_no_memory(self):
        c = _build_client(memory=None)
        resp = c.get("/api/sessions/s1")
        assert resp.status_code == 503

    def test_returns_404_when_not_found(self, client):
        mem = client._mocks["memory"]
        mem.load_session = AsyncMock(return_value=None)
        resp = client.get("/api/sessions/nonexistent")
        assert resp.status_code == 404

    def test_returns_session_data(self, client):
        mem = client._mocks["memory"]
        mem.load_session = AsyncMock(return_value={"messages": 3})
        resp = client.get("/api/sessions/s1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "s1"
        assert data["data"] == {"messages": 3}


class TestSessionDeleteEndpoint:
    """DELETE /api/sessions/{session_id}"""

    def test_returns_503_when_no_memory(self):
        c = _build_client(memory=None)
        resp = c.delete("/api/sessions/s1")
        assert resp.status_code == 503

    def test_deletes_session(self, client):
        mem = client._mocks["memory"]
        mem.delete_session = AsyncMock(return_value=True)
        resp = client.delete("/api/sessions/s1")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True


class TestSessionExportEndpoint:
    """GET /api/sessions/{session_id}/export"""

    def test_returns_503_when_no_memory(self):
        c = _build_client(memory=None)
        resp = c.get("/api/sessions/s1/export")
        assert resp.status_code == 503

    def test_returns_404_when_not_found(self, client):
        mem = client._mocks["memory"]
        mem.export_session = AsyncMock(return_value=None)
        resp = client.get("/api/sessions/s1/export")
        assert resp.status_code == 404

    def test_exports_json(self, client):
        mem = client._mocks["memory"]
        mem.export_session = AsyncMock(return_value={"id": "s1", "messages": []})
        resp = client.get("/api/sessions/s1/export?format=json")
        assert resp.status_code == 200

    def test_exports_markdown_as_text(self, client):
        mem = client._mocks["memory"]
        mem.export_session = AsyncMock(return_value="# Session Notes\nTest")
        resp = client.get("/api/sessions/s1/export?format=markdown")
        assert resp.status_code == 200
        assert "Session Notes" in resp.text


# ===================================================================
# 9. Memory endpoints
# ===================================================================


class TestMemorySearchEndpoint:
    """POST /api/memory/search"""

    def test_returns_503_when_no_memory(self):
        c = _build_client(memory=None)
        resp = c.post("/api/memory/search", json={"query": "test"})
        assert resp.status_code == 503

    def test_searches_memory(self, client):

        from engine.memory.types import MemoryEntry, MemoryType

        entry = MemoryEntry(
            type=MemoryType.CONTEXT,
            content="hello",
            tags=["test"],
            source="api",
        )
        entry.id = "e1"
        mem = client._mocks["memory"]
        mem.search = AsyncMock(return_value=[entry])
        resp = client.post("/api/memory/search", json={"query": "hello", "limit": 5})
        assert resp.status_code == 200
        results = resp.json()
        assert len(results) == 1
        assert results[0]["content"] == "hello"


class TestMemoryGetEndpoint:
    """GET /api/memory/{entry_id}"""

    def test_returns_503_when_no_memory(self):
        c = _build_client(memory=None)
        resp = c.get("/api/memory/e1")
        assert resp.status_code == 503

    def test_returns_none_when_not_found(self, client):
        mem = client._mocks["memory"]
        mem.get = AsyncMock(return_value=None)
        resp = client.get("/api/memory/nonexistent")
        assert resp.status_code == 200
        assert resp.json() is None

    def test_returns_entry(self, client):
        from engine.memory.types import MemoryEntry, MemoryType

        entry = MemoryEntry(type=MemoryType.CONTEXT, content="data", tags=[], source="api")
        entry.id = "e1"
        mem = client._mocks["memory"]
        mem.get = AsyncMock(return_value=entry)
        resp = client.get("/api/memory/e1")
        assert resp.status_code == 200
        assert resp.json()["id"] == "e1"


class TestMemoryCreateEndpoint:
    """POST /api/memory"""

    def test_returns_error_when_content_empty(self, client):
        resp = client.post("/api/memory", json={"content": ""})
        assert resp.status_code == 400
        assert "detail" in resp.json()

    def test_creates_memory_entry(self, client):
        mem = client._mocks["memory"]
        mem.store = AsyncMock()
        resp = client.post("/api/memory", json={"content": "test content", "type": "context", "tags": ["t1"]})
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
        assert "id" in resp.json()


class TestMemoryDeleteEndpoint:
    """DELETE /api/memory/{entry_id}"""

    def test_deletes_entry(self, client):
        mem = client._mocks["memory"]
        mem.delete = AsyncMock(return_value=True)
        resp = client.delete("/api/memory/e1")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True


class TestMemoryIngestEndpoint:
    """POST /api/memory/ingest"""

    def test_returns_error_when_text_empty(self, client):
        resp = client.post("/api/memory/ingest", json={"text": ""})
        assert resp.status_code == 400
        assert "detail" in resp.json()

    def test_ingests_document(self, client):
        mem = client._mocks["memory"]
        mem.ingest_document = AsyncMock(return_value=["id1", "id2", "id3"])
        resp = client.post("/api/memory/ingest", json={"text": "Some long text", "chunk_size": 200, "source": "test"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["chunks_created"] == 3


# ===================================================================
# 10. Plugins endpoints
# ===================================================================


class TestPluginsReloadEndpoint:
    """POST /api/plugins/reload"""

    def test_returns_error_when_no_registry(self, client):
        resp = client.post("/api/plugins/reload")
        assert resp.status_code == 503
        assert "detail" in resp.json()


class TestPluginsInstallEndpoint:
    """POST /api/plugins/install"""

    def test_returns_503_when_no_registry(self, client):
        resp = client.post("/api/plugins/install", json={"source": "https://example.com"})
        assert resp.status_code == 503


class TestPluginsAvailableEndpoint:
    """GET /api/plugins/available"""

    def test_returns_empty_when_no_registry(self, client):
        resp = client.get("/api/plugins/available")
        assert resp.status_code == 200
        assert resp.json()["plugins"] == []


# ===================================================================
# 11. Learning endpoints
# ===================================================================


class TestLearningInsightsEndpoint:
    """GET /api/learning/insights"""

    def test_returns_empty_when_no_learning(self, client):
        resp = client.get("/api/learning/insights")
        assert resp.status_code == 200
        assert resp.json()["insights"] == []

    def test_returns_insights(self):
        learning = MagicMock()
        learning.get_pending_insights = MagicMock(return_value=[{"id": "i1"}])
        c = _build_client(learning=learning)
        resp = c.get("/api/learning/insights")
        assert resp.status_code == 200
        assert len(resp.json()["insights"]) == 1


class TestPromoteInsightEndpoint:
    """POST /api/learning/insights/{insight_id}/promote"""

    def test_returns_error_when_no_learning(self, client):
        resp = client.post("/api/learning/insights/i1/promote")
        assert resp.status_code == 503
        assert "detail" in resp.json()


class TestDismissInsightEndpoint:
    """DELETE /api/learning/insights/{insight_id}"""

    def test_returns_error_when_no_learning(self, client):
        resp = client.delete("/api/learning/insights/i1")
        assert resp.status_code == 503
        assert "detail" in resp.json()


# ===================================================================
# 12. Cron endpoints
# ===================================================================


class TestCronScheduleEndpoint:
    """POST /api/cron/schedule"""

    def test_returns_error_when_no_cron(self, client):
        resp = client.post("/api/cron/schedule", json={"name": "test", "cron": "*/5 * * * *", "message": "hello"})
        assert resp.status_code == 503
        assert "detail" in resp.json()

    def test_schedules_job(self):
        from engine.learning.nudge import CronJob, CronScheduler

        cron = CronScheduler()
        job = CronJob(name="test", cron="*/5 * * * *", message="hello")
        cron.add_job = MagicMock(return_value=job)
        c = _build_client(cron=cron)
        resp = c.post("/api/cron/schedule", json={"name": "test", "cron": "*/5 * * * *", "message": "hello"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestCronListEndpoint:
    """GET /api/cron/jobs"""

    def test_returns_empty_when_no_cron(self, client):
        resp = client.get("/api/cron/jobs")
        assert resp.status_code == 200
        assert resp.json()["jobs"] == []


class TestCronDeleteEndpoint:
    """DELETE /api/cron/jobs/{job_id}"""

    def test_returns_error_when_no_cron(self, client):
        resp = client.delete("/api/cron/jobs/j1")
        assert resp.status_code == 503
        assert "detail" in resp.json()


# ===================================================================
# 13. Chat endpoints
# ===================================================================


class TestChatEndpoint:
    """POST /api/chat"""

    def test_returns_503_when_no_agent_loop(self):
        c = _build_client(agent_loop=None)
        resp = c.post("/api/chat", json={"message": "hello"})
        assert resp.status_code == 503

    def test_chats_successfully(self, client):
        resp = client.post("/api/chat", json={"message": "hello", "session_id": "s1"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["content"] == "Hello back"
        assert data["session_id"] == "sess-1"


# ===================================================================
# 14. MCP endpoints
# ===================================================================


class TestMCPServersEndpoint:
    """GET /api/mcp/servers"""

    def test_returns_empty_when_no_mcp(self, client):
        resp = client.get("/api/mcp/servers")
        assert resp.status_code == 200
        assert resp.json()["servers"] == []


class TestMCPRegisterEndpoint:
    """POST /api/mcp/servers"""

    def test_returns_error_when_no_mcp(self, client):
        resp = client.post("/api/mcp/servers", json={"name": "test", "url": "http://localhost:8080"})
        assert resp.status_code == 503
        assert "detail" in resp.json()


# ===================================================================
# 15. Voice endpoints
# ===================================================================


class TestVoiceTTSEndpoint:
    """POST /api/voice/tts"""

    def test_returns_error_when_text_empty(self, client):
        resp = client.post("/api/voice/tts", json={"text": ""})
        assert resp.status_code == 400
        assert "detail" in resp.json()

    def test_returns_error_when_synthesis_fails(self, client):
        with patch("engine.voice.tts.synthesize", new_callable=AsyncMock, side_effect=RuntimeError("fail")):
            resp = client.post("/api/voice/tts", json={"text": "hello"})
            assert resp.status_code == 500
            assert "detail" in resp.json()

    def test_synthesizes_audio(self, client):
        with patch("engine.voice.tts.synthesize", new_callable=AsyncMock, return_value="/tmp/audio.mp3"):
            resp = client.post("/api/voice/tts", json={"text": "hello"})
            assert resp.status_code == 200
            assert resp.json()["status"] == "ok"
            assert resp.json()["path"] == "/tmp/audio.mp3"


class TestVoiceSTTEndpoint:
    """POST /api/voice/stt"""

    def test_transcribes_audio(self, client):
        with patch("engine.voice.stt.transcribe", new_callable=AsyncMock, return_value="hello world"):
            resp = client.post("/api/voice/stt", files={"file": ("audio.wav", b"fake-audio", "audio/wav")})
            assert resp.status_code == 200
            assert resp.json()["text"] == "hello world"


class TestVoiceSTTPathEndpoint:
    """POST /api/voice/stt/path"""

    def test_returns_error_when_path_empty(self, client):
        resp = client.post("/api/voice/stt/path", json={"path": ""})
        assert resp.status_code == 400
        assert "detail" in resp.json()


# ===================================================================
# 16. Model routing endpoints
# ===================================================================


class TestModelRouteEndpoint:
    """POST /api/model/route"""

    def test_routes_model(self, client):
        with (
            patch("engine.agent.model_router.route_model") as mock_route,
            patch("engine.agent.model_router.classify_complexity", return_value="fast"),
        ):
            mock_tier = MagicMock()
            mock_tier.provider = "openrouter"
            mock_tier.model = "gpt-4o-mini"
            mock_tier.context_window = 128000
            mock_tier.max_output_tokens = 4096
            mock_route.return_value = mock_tier
            resp = client.post("/api/model/route", json={"message": "hello"})
            assert resp.status_code == 200
            data = resp.json()
            assert data["provider"] == "openrouter"
            assert data["model"] == "gpt-4o-mini"


class TestModelTiersEndpoint:
    """GET /api/model/tiers"""

    def test_returns_tiers(self, client):
        with patch(
            "engine.agent.model_router.MODEL_TIERS",
            {
                "fast": MagicMock(provider="p", model="m", context_window=1, max_output_tokens=1),
            },
        ):
            resp = client.get("/api/model/tiers")
            assert resp.status_code == 200
            assert "tiers" in resp.json()


# ===================================================================
# 17. Collaborations list endpoint
# ===================================================================


class TestCollaborationsListEndpoint:
    """GET /api/agents/collaborations

    Note: Due to route ordering, /agents/{name} (registered before
    /agents/collaborations) catches this request. The handler is
    agents_get which checks _agent_router. This tests the actual
    runtime behavior.
    """

    def test_returns_503_when_no_agent_router(self):
        c = _build_client(agent_router=None)
        resp = c.get("/api/agents/collaborations")
        assert resp.status_code == 503


# ===================================================================
# 18. Agents roles endpoint
# ===================================================================


class TestAgentsRolesEndpoint:
    """GET /api/agents/roles"""

    def test_returns_roles(self, client):
        with patch("engine.agent.roles.list_roles") as mock_list:
            role = MagicMock()
            role.name = "general"
            role.system_prompt = "You are helpful" + "x" * 200
            role.allowed_tools = ["bash"]
            role.default_model_tier = "fast"
            role.max_iterations = 10
            mock_list.return_value = [role]
            resp = client.get("/api/agents/roles")
            assert resp.status_code == 200
            roles = resp.json()["roles"]
            assert len(roles) == 1
            assert roles[0]["name"] == "general"


# ===================================================================
# 19. Tools dynamic and chain endpoints
# ===================================================================


class TestToolsDynamicRegisterEndpoint:
    """POST /api/tools/dynamic"""

    def test_returns_503_when_no_dynamic(self, client):
        # init_routes creates ToolRegistry which has _dynamic=None
        resp = client.post(
            "/api/tools/dynamic",
            json={
                "name": "test",
                "description": "desc",
                "parameters": {},
                "handler_code": "return {}",
                "danger_level": "safe",
            },
        )
        assert resp.status_code == 503


class TestToolsHistoryStatsEndpoint:
    """GET /api/tools/history/stats"""

    def test_returns_default_when_no_history(self, client):
        resp = client.get("/api/tools/history/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["tools"] == {}


# ===================================================================
# 20. RAG documents delete
# ===================================================================


class TestRAGDeleteDocument:
    """DELETE /api/rag/documents/{document_id}"""

    def test_returns_503_when_not_initialized(self):
        c = _build_client(rag_collections=None)
        resp = c.delete("/api/rag/documents/d1")
        assert resp.status_code == 503

    def test_returns_404_when_not_found(self, client):
        rag_mgr = client._mocks["rag_collections"]
        rag_mgr.delete_document = AsyncMock(return_value=False)
        resp = client.delete("/api/rag/documents/nonexistent")
        assert resp.status_code == 404

    def test_deletes_document(self, client):
        rag_mgr = client._mocks["rag_collections"]
        rag_mgr.delete_document = AsyncMock(return_value=True)
        resp = client.delete("/api/rag/documents/d1")
        assert resp.status_code == 200
        assert resp.json()["deleted"] == "d1"


# ===================================================================
# 21. Decompose and orchestrate endpoints
# ===================================================================


class TestDecomposeEndpoint:
    """POST /api/agents/decompose"""

    def test_returns_503_when_no_decomposer(self, client):
        resp = client.post("/api/agents/decompose", json={"task": "build app"})
        assert resp.status_code == 503


class TestOrchestrateEndpoint:
    """POST /api/agents/orchestrate"""

    def test_returns_503_when_missing_deps(self, client):
        resp = client.post("/api/agents/orchestrate", json={"task": "build app"})
        assert resp.status_code == 503
