"""Tests for engine.skills.plugin_context -- PluginContext hooks and events."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from engine.skills.plugin_context import VALID_HOOKS, VALID_PERMISSIONS, PluginContext


class TestPluginContextOn:
    def test_on_registers_callback(self) -> None:
        # Arrange
        ctx = PluginContext()
        callback = AsyncMock()

        # Act
        ctx.on("on_load", callback)

        # Assert
        assert ctx.has_hooks("on_load")

    def test_on_registers_multiple_callbacks_for_same_event(self) -> None:
        # Arrange
        ctx = PluginContext()
        cb1 = AsyncMock()
        cb2 = AsyncMock()

        # Act
        ctx.on("on_message", cb1)
        ctx.on("on_message", cb2)

        # Assert
        assert ctx.has_hooks("on_message")
        assert len(ctx._hooks["on_message"]) == 2


class TestPluginContextEmit:
    @pytest.mark.asyncio
    async def test_emit_calls_registered_callbacks(self) -> None:
        # Arrange
        ctx = PluginContext()
        cb = AsyncMock(return_value=42)
        ctx.on("on_load", cb)

        # Act
        results = await ctx.emit("on_load", "arg1", key="val")

        # Assert
        cb.assert_called_once_with("arg1", key="val")
        assert results == [42]

    @pytest.mark.asyncio
    async def test_emit_returns_empty_list_for_no_hooks(self) -> None:
        # Arrange
        ctx = PluginContext()

        # Act
        results = await ctx.emit("nonexistent_event")

        # Assert
        assert results == []

    @pytest.mark.asyncio
    async def test_emit_calls_multiple_callbacks_in_order(self) -> None:
        # Arrange
        ctx = PluginContext()
        order = []
        cb1 = AsyncMock(side_effect=lambda: order.append(1))
        cb2 = AsyncMock(side_effect=lambda: order.append(2))
        ctx.on("on_message", cb1)
        ctx.on("on_message", cb2)

        # Act
        await ctx.emit("on_message")

        # Assert
        assert order == [1, 2]

    @pytest.mark.asyncio
    async def test_emit_passes_args_and_kwargs(self) -> None:
        # Arrange
        ctx = PluginContext()
        cb = AsyncMock(return_value="ok")
        ctx.on("before_chat", cb)

        # Act
        await ctx.emit("before_chat", "msg", session="s1")

        # Assert
        cb.assert_called_once_with("msg", session="s1")


class TestPluginContextHasHooks:
    def test_has_hooks_returns_false_for_unregistered_event(self) -> None:
        # Arrange
        ctx = PluginContext()

        # Act / Assert
        assert ctx.has_hooks("on_load") is False

    def test_has_hooks_returns_true_after_registration(self) -> None:
        # Arrange
        ctx = PluginContext()
        ctx.on("after_chat", AsyncMock())

        # Act / Assert
        assert ctx.has_hooks("after_chat") is True


class TestPluginContextClear:
    def test_clear_removes_all_hooks(self) -> None:
        # Arrange
        ctx = PluginContext()
        ctx.on("on_load", AsyncMock())
        ctx.on("on_message", AsyncMock())

        # Act
        ctx.clear()

        # Assert
        assert ctx.has_hooks("on_load") is False
        assert ctx.has_hooks("on_message") is False

    def test_clear_on_empty_context_is_safe(self) -> None:
        # Arrange
        ctx = PluginContext()

        # Act -- should not raise
        ctx.clear()

        # Assert
        assert ctx.has_hooks("on_load") is False


class TestPluginContextDefaults:
    def test_default_config_is_none(self) -> None:
        # Arrange / Act
        ctx = PluginContext()

        # Assert
        assert ctx.config is None
        assert ctx.memory is None
        assert ctx.tools is None
        assert ctx.skill_registry is None

    def test_custom_config_passed_through(self) -> None:
        # Arrange
        config = {"debug": True}
        memory = {"store": "sqlite"}
        registry = object()

        # Act
        ctx = PluginContext(config=config, memory=memory, skill_registry=registry)

        # Assert
        assert ctx.config == config
        assert ctx.memory == memory
        assert ctx.skill_registry is registry


class TestValidConstants:
    def test_valid_hooks_contains_expected_events(self) -> None:
        # Assert
        assert "on_load" in VALID_HOOKS
        assert "on_unload" in VALID_HOOKS
        assert "on_message" in VALID_HOOKS
        assert "before_chat" in VALID_HOOKS
        assert "after_chat" in VALID_HOOKS

    def test_valid_permissions_contains_expected_values(self) -> None:
        # Assert
        assert "read" in VALID_PERMISSIONS
        assert "write" in VALID_PERMISSIONS
        assert "execute" in VALID_PERMISSIONS

    def test_valid_hooks_is_frozen_set(self) -> None:
        # Assert
        assert isinstance(VALID_HOOKS, set)
        assert isinstance(VALID_PERMISSIONS, set)
