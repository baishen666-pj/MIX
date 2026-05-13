"""Tests for engine/api/routes/learning.py -- insights, promote, and dismiss endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from engine.api.routes import init_routes, router


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_client(learning=None):
    """Build a TestClient with fine-grained control over the learning module."""
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
            learning=learning,
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


def _make_learning(**overrides):
    """Create a mock learning module."""
    learning = MagicMock()
    learning.get_pending_insights = MagicMock(return_value=overrides.get("insights", []))
    learning.promote_insight = AsyncMock(return_value=overrides.get("promote_result", None))
    learning.dismiss_insight = MagicMock(return_value=overrides.get("dismiss_result", True))
    return learning


# ===================================================================
# GET /api/learning/insights
# ===================================================================


class TestLearningInsights:
    """GET /api/learning/insights"""

    def test_returns_empty_list_when_no_learning_module(self):
        # Arrange
        c = _build_client(learning=None)
        # Act
        resp = c.get("/api/learning/insights")
        # Assert
        assert resp.status_code == 200
        assert resp.json()["insights"] == []

    def test_returns_insights_from_learning_module(self):
        # Arrange
        insights = [
            {"id": "ins-1", "type": "pattern", "description": "User prefers concise answers"},
            {"id": "ins-2", "type": "behavior", "description": "Frequent tool usage at night"},
        ]
        learning = _make_learning(insights=insights)
        c = _build_client(learning=learning)
        # Act
        resp = c.get("/api/learning/insights")
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["insights"]) == 2
        assert data["insights"][0]["id"] == "ins-1"
        assert data["insights"][1]["type"] == "behavior"

    def test_returns_empty_when_learning_module_has_no_insights(self):
        # Arrange
        learning = _make_learning(insights=[])
        c = _build_client(learning=learning)
        # Act
        resp = c.get("/api/learning/insights")
        # Assert
        assert resp.status_code == 200
        assert resp.json()["insights"] == []
        learning.get_pending_insights.assert_called_once()


# ===================================================================
# POST /api/learning/insights/{insight_id}/promote
# ===================================================================


class TestPromoteInsight:
    """POST /api/learning/insights/{insight_id}/promote"""

    def test_returns_503_when_no_learning_module(self):
        # Arrange
        c = _build_client(learning=None)
        # Act
        resp = c.post("/api/learning/insights/ins-1/promote")
        # Assert
        assert resp.status_code == 503
        assert "detail" in resp.json()

    def test_returns_404_when_insight_not_found(self):
        # Arrange -- promote_insight returns None
        learning = _make_learning(promote_result=None)
        c = _build_client(learning=learning)
        # Act
        resp = c.post("/api/learning/insights/nonexistent/promote")
        # Assert
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_promotes_insight_successfully(self):
        # Arrange
        manifest = MagicMock()
        manifest.name = "promoted-skill"
        learning = _make_learning(promote_result=manifest)
        c = _build_client(learning=learning)
        # Act
        resp = c.post("/api/learning/insights/ins-42/promote")
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["skill"] == "promoted-skill"
        learning.promote_insight.assert_awaited_once_with("ins-42")

    def test_returns_404_when_no_code_to_promote(self):
        # Arrange -- None signals "insight exists but no promotable code"
        learning = _make_learning(promote_result=None)
        c = _build_client(learning=learning)
        # Act
        resp = c.post("/api/learning/insights/ins-99/promote")
        # Assert
        assert resp.status_code == 404


# ===================================================================
# DELETE /api/learning/insights/{insight_id}
# ===================================================================


class TestDismissInsight:
    """DELETE /api/learning/insights/{insight_id}"""

    def test_returns_503_when_no_learning_module(self):
        # Arrange
        c = _build_client(learning=None)
        # Act
        resp = c.delete("/api/learning/insights/ins-1")
        # Assert
        assert resp.status_code == 503
        assert "detail" in resp.json()

    def test_dismisses_insight_successfully(self):
        # Arrange
        learning = _make_learning(dismiss_result=True)
        c = _build_client(learning=learning)
        # Act
        resp = c.delete("/api/learning/insights/ins-10")
        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert data["dismissed"] is True
        learning.dismiss_insight.assert_called_once_with("ins-10")

    def test_dismiss_returns_false_when_insight_not_found(self):
        # Arrange
        learning = _make_learning(dismiss_result=False)
        c = _build_client(learning=learning)
        # Act
        resp = c.delete("/api/learning/insights/nonexistent")
        # Assert
        assert resp.status_code == 200
        assert resp.json()["dismissed"] is False

    def test_dismiss_passes_insight_id_correctly(self):
        # Arrange
        learning = _make_learning()
        c = _build_client(learning=learning)
        # Act
        resp = c.delete("/api/learning/insights/some-complex-id-12345")
        # Assert
        assert resp.status_code == 200
        learning.dismiss_insight.assert_called_once_with("some-complex-id-12345")
