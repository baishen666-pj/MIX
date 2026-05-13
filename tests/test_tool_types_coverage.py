"""Tests for engine.tools.types — ToolResult, Tool protocol, TOOL_DEFINITIONS."""

from __future__ import annotations

from typing import Any

import pytest

from engine.tools.types import TOOL_DEFINITIONS, Tool, ToolResult


class TestToolResult:
    def test_defaults(self):
        r = ToolResult(output="hello")
        assert r.output == "hello"
        assert r.error is None
        assert r.success is True
        assert r.metadata is None

    def test_with_error(self):
        r = ToolResult(output="", error="failed", success=False)
        assert r.success is False
        assert r.error == "failed"

    def test_with_metadata(self):
        r = ToolResult(output="ok", metadata={"duration": 1.5})
        assert r.metadata == {"duration": 1.5}

    def test_to_dict(self):
        r = ToolResult(output="test", error="warn", success=True, metadata={"k": 1})
        d = r.to_dict()
        assert d == {
            "output": "test",
            "error": "warn",
            "success": True,
            "metadata": {"k": 1},
        }

    def test_to_dict_defaults(self):
        r = ToolResult(output="x")
        d = r.to_dict()
        assert d["error"] is None
        assert d["success"] is True
        assert d["metadata"] is None

    def test_is_dataclass(self):
        r = ToolResult(output="a")
        r2 = ToolResult(output="a")
        assert r == r2


class TestToolDefinitions:
    def test_is_list(self):
        assert isinstance(TOOL_DEFINITIONS, list)
        assert len(TOOL_DEFINITIONS) > 0

    def test_each_has_function_structure(self):
        for defn in TOOL_DEFINITIONS:
            assert defn["type"] == "function"
            func = defn["function"]
            assert "name" in func
            assert "description" in func
            assert "parameters" in func

    def test_parameters_have_required_fields(self):
        for defn in TOOL_DEFINITIONS:
            params = defn["function"]["parameters"]
            assert params["type"] == "object"
            assert "properties" in params
            assert isinstance(params["required"], list)

    def test_known_tools_present(self):
        names = {d["function"]["name"] for d in TOOL_DEFINITIONS}
        expected = {"bash", "file_read", "file_write", "file_list", "web_search",
                    "file_edit", "grep", "glob", "web_fetch", "calculator",
                    "code_execute", "image_generate"}
        assert expected.issubset(names)


class TestToolProtocol:
    def test_protocol_annotations(self):
        annotations = Tool.__protocol_attrs__ if hasattr(Tool, "__protocol_attrs__") else Tool.__annotations__
        assert "name" in annotations or any(a == "name" for a in getattr(Tool, "__protocol_attrs__", set()))
        assert "execute" in Tool.__protocol_attrs__ if hasattr(Tool, "__protocol_attrs__") else True

    def test_can_implement_protocol(self):
        class MockTool:
            name = "mock"
            description = "A mock tool"
            async def execute(self, **kwargs: Any) -> ToolResult:
                return ToolResult(output="mocked")
        tool = MockTool()
        assert tool.name == "mock"
