"""Comprehensive tests for engine.tools.dynamic module.

Covers: DynamicToolDef, DynamicToolRegistry
Edge cases: execute nonexistent, get_definition, list_names, empty registry, to_openai_definition.
Note: Handler compilation spawns subprocess, so execute tests mock the handler.
"""

from __future__ import annotations

import pytest

from engine.tools.dynamic import DynamicToolDef, DynamicToolRegistry

# --- DynamicToolDef ---


class TestDynamicToolDef:
    def test_defaults(self):
        defn = DynamicToolDef(
            name="test_tool",
            description="A test tool",
            parameters={"type": "object", "properties": {}},
            handler_code="print('ok')",
        )
        assert defn.examples == []
        assert defn.constraints == {}
        assert defn.danger_level == "safe"
        assert defn.created_at == ""
        assert defn.created_by == ""

    def test_custom_fields(self):
        defn = DynamicToolDef(
            name="my_tool",
            description="Custom tool",
            parameters={"type": "object", "properties": {"x": {"type": "integer"}}},
            handler_code="print(x)",
            danger_level="dangerous",
            created_at="2025-01-01",
            created_by="admin",
            examples=[{"input": 1, "output": "1"}],
            constraints={"max_input": 100},
        )
        assert defn.danger_level == "dangerous"
        assert defn.created_at == "2025-01-01"
        assert defn.created_by == "admin"
        assert len(defn.examples) == 1
        assert defn.constraints["max_input"] == 100

    def test_to_openai_definition(self):
        defn = DynamicToolDef(
            name="adder",
            description="Adds two numbers",
            parameters={
                "type": "object",
                "properties": {
                    "a": {"type": "number"},
                    "b": {"type": "number"},
                },
                "required": ["a", "b"],
            },
            handler_code="print(a + b)",
        )
        result = defn.to_openai_definition()
        assert result["type"] == "function"
        func = result["function"]
        assert func["name"] == "adder"
        assert func["description"] == "Adds two numbers"
        assert "a" in func["parameters"]["properties"]
        assert func["parameters"]["required"] == ["a", "b"]


# --- DynamicToolRegistry ---


@pytest.fixture
def registry() -> DynamicToolRegistry:
    return DynamicToolRegistry()


def _make_def(name: str = "echo_tool", handler: str = "print('ok')") -> DynamicToolDef:
    return DynamicToolDef(
        name=name,
        description=f"Test tool {name}",
        parameters={"type": "object", "properties": {"text": {"type": "string"}}},
        handler_code=handler,
        danger_level="safe",
    )


class TestRegister:
    @pytest.mark.asyncio
    async def test_register_single_tool(self, registry: DynamicToolRegistry):
        await registry.register(_make_def())
        assert registry.has_tool("echo_tool")

    @pytest.mark.asyncio
    async def test_register_multiple_tools(self, registry: DynamicToolRegistry):
        await registry.register(_make_def("tool_a"))
        await registry.register(_make_def("tool_b"))
        assert registry.has_tool("tool_a")
        assert registry.has_tool("tool_b")
        assert len(registry.list_dynamic_tools()) == 2

    @pytest.mark.asyncio
    async def test_register_overwrites_existing(self, registry: DynamicToolRegistry):
        await registry.register(_make_def("dup", handler="print('v1')"))
        await registry.register(_make_def("dup", handler="print('v2')"))
        assert len(registry.list_dynamic_tools()) == 1


class TestUnregister:
    @pytest.mark.asyncio
    async def test_unregister_existing(self, registry: DynamicToolRegistry):
        await registry.register(_make_def())
        removed = await registry.unregister("echo_tool")
        assert removed is True
        assert not registry.has_tool("echo_tool")

    @pytest.mark.asyncio
    async def test_unregister_nonexistent(self, registry: DynamicToolRegistry):
        removed = await registry.unregister("nonexistent")
        assert removed is False

    @pytest.mark.asyncio
    async def test_unregister_twice_fails(self, registry: DynamicToolRegistry):
        await registry.register(_make_def())
        assert await registry.unregister("echo_tool") is True
        assert await registry.unregister("echo_tool") is False


class TestListTools:
    @pytest.mark.asyncio
    async def test_list_empty_registry(self, registry: DynamicToolRegistry):
        assert registry.list_dynamic_tools() == []

    @pytest.mark.asyncio
    async def test_list_names(self, registry: DynamicToolRegistry):
        await registry.register(_make_def("alpha"))
        await registry.register(_make_def("beta"))
        names = registry.list_dynamic_tools_names()
        assert "alpha" in names
        assert "beta" in names


class TestGetDefinition:
    @pytest.mark.asyncio
    async def test_get_existing(self, registry: DynamicToolRegistry):
        defn = _make_def("getter_test")
        await registry.register(defn)
        fetched = registry.get_definition("getter_test")
        assert fetched is not None
        assert fetched.name == "getter_test"

    @pytest.mark.asyncio
    async def test_get_nonexistent(self, registry: DynamicToolRegistry):
        assert registry.get_definition("not_found") is None


class TestGetDefinitions:
    @pytest.mark.asyncio
    async def test_get_definitions_openai_format(self, registry: DynamicToolRegistry):
        await registry.register(_make_def("tool1"))
        await registry.register(_make_def("tool2"))
        defs = registry.get_definitions()
        assert len(defs) == 2
        names = [d["function"]["name"] for d in defs]
        assert "tool1" in names
        assert "tool2" in names

    @pytest.mark.asyncio
    async def test_get_definitions_empty(self, registry: DynamicToolRegistry):
        assert registry.get_definitions() == []


class TestExecute:
    @pytest.mark.asyncio
    async def test_execute_nonexistent_tool(self, registry: DynamicToolRegistry):
        result = await registry.execute("nonexistent")
        assert "error" in result
        assert "not found" in result["error"]

    @pytest.mark.asyncio
    async def test_execute_returns_handler_error(self, registry: DynamicToolRegistry):
        defn = DynamicToolDef(
            name="failing_tool",
            description="Always fails",
            parameters={"type": "object", "properties": {}},
            handler_code="raise RuntimeError('deliberate failure')",
        )
        await registry.register(defn)
        result = await registry.execute("failing_tool")
        assert result.get("success") is False
        assert "error" in result


class TestHasTool:
    def test_has_tool_empty(self, registry: DynamicToolRegistry):
        assert not registry.has_tool("anything")

    @pytest.mark.asyncio
    async def test_has_tool_after_register(self, registry: DynamicToolRegistry):
        await registry.register(_make_def("present"))
        assert registry.has_tool("present")
        assert not registry.has_tool("absent")
