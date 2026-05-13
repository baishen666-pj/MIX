"""Comprehensive tests for engine.agent.loop -- AgentLoop core logic.

Covers: Message/Session dataclass behavior, token estimation, context
trimming, tool call execution, chat() non-streaming path, session management,
memory persistence, max iteration guardrail, edge cases.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from engine.agent.loop import (
    CHARS_PER_TOKEN,
    MAX_TOOL_ITERATIONS,
    AgentLoop,
    Message,
    Session,
    _now_iso,
)
from engine.config import EngineConfig, MemoryConfig, MixConfig, ProviderConfig
from engine.tools.types import ToolResult

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_config(**overrides) -> MixConfig:
    defaults = dict(
        engine=EngineConfig(),
        llm=ProviderConfig(provider="openai", model="gpt-4o", api_key="test"),
        memory=MemoryConfig(),
    )
    defaults.update(overrides)
    return MixConfig(**defaults)


class MockProvider:
    """Controllable mock LLM provider."""

    def __init__(self, responses: list[dict] | None = None) -> None:
        self._responses = list(responses or [])
        self._call_count = 0

    async def complete(self, **kwargs) -> dict:
        if self._call_count < len(self._responses):
            resp = self._responses[self._call_count]
            self._call_count += 1
            return resp
        return {"content": "fallback", "tool_calls": None}

    async def stream(self, **kwargs):
        if self._call_count < len(self._responses):
            resp = self._responses[self._call_count]
            self._call_count += 1
            yield {"delta": resp.get("content", ""), "done": True}
        else:
            yield {"delta": "fallback", "done": True}


# ---------------------------------------------------------------------------
# Message dataclass tests
# ---------------------------------------------------------------------------


class TestMessage:
    def test_to_api_dict_minimal(self) -> None:
        # Arrange
        msg = Message(role="user", content="hello")

        # Act
        d = msg.to_api_dict()

        # Assert
        assert d == {"role": "user", "content": "hello"}

    def test_to_api_dict_with_tool_calls(self) -> None:
        # Arrange
        tc = [{"id": "tc1", "function": {"name": "bash"}}]
        msg = Message(role="assistant", content=None, tool_calls=tc)

        # Act
        d = msg.to_api_dict()

        # Assert
        assert d["role"] == "assistant"
        assert d["tool_calls"] == tc
        assert "content" not in d

    def test_to_api_dict_with_tool_response(self) -> None:
        # Arrange
        msg = Message(role="tool", content="result", tool_call_id="tc1", name="bash")

        # Act
        d = msg.to_api_dict()

        # Assert
        assert d["role"] == "tool"
        assert d["content"] == "result"
        assert d["tool_call_id"] == "tc1"
        assert d["name"] == "bash"

    def test_to_api_dict_omits_none_fields(self) -> None:
        # Arrange
        msg = Message(role="user", content="hi")

        # Act
        d = msg.to_api_dict()

        # Assert
        assert "tool_calls" not in d
        assert "tool_call_id" not in d
        assert "name" not in d

    def test_none_content_not_included(self) -> None:
        # Arrange
        msg = Message(role="assistant", content=None)

        # Act
        d = msg.to_api_dict()

        # Assert
        assert "content" not in d


# ---------------------------------------------------------------------------
# Session dataclass tests
# ---------------------------------------------------------------------------


class TestSession:
    def test_add_creates_new_message(self) -> None:
        # Arrange
        session = Session(id="s1", model="gpt-4o", created_at="2025-01-01")

        # Act
        session.add("user", "hello")

        # Assert
        assert len(session.messages) == 1
        assert session.messages[0].role == "user"
        assert session.messages[0].content == "hello"

    def test_add_preserves_existing_messages(self) -> None:
        # Arrange
        session = Session(id="s1")
        session.add("user", "first")

        # Act
        session.add("user", "second")

        # Assert
        assert len(session.messages) == 2
        assert session.messages[0].content == "first"
        assert session.messages[1].content == "second"

    def test_add_does_not_mutate_original_list(self) -> None:
        # Arrange
        session = Session(id="s1")
        original = session.messages
        session.add("user", "msg")

        # Assert -- messages list was replaced, not mutated in-place
        assert original is not session.messages

    def test_add_with_kwargs(self) -> None:
        # Arrange
        session = Session(id="s1")

        # Act
        session.add("tool", "output", tool_call_id="tc1", name="bash")

        # Assert
        assert session.messages[0].tool_call_id == "tc1"
        assert session.messages[0].name == "bash"

    def test_default_messages_is_empty(self) -> None:
        session = Session(id="s1")
        assert session.messages == []

    def test_sessions_are_independent(self) -> None:
        s1 = Session(id="s1")
        s2 = Session(id="s2")
        s1.add("user", "hi")
        assert len(s2.messages) == 0


# ---------------------------------------------------------------------------
# Token estimation
# ---------------------------------------------------------------------------


class TestTokenEstimation:
    def test_estimate_tokens_basic(self) -> None:
        # Arrange
        messages = [{"content": "a" * 100}]

        # Act
        tokens = AgentLoop._estimate_tokens(messages)

        # Assert
        assert tokens == 100 // CHARS_PER_TOKEN

    def test_estimate_tokens_minimum_one(self) -> None:
        # Arrange
        messages = [{"content": ""}]

        # Act
        tokens = AgentLoop._estimate_tokens(messages)

        # Assert
        assert tokens >= 1

    def test_estimate_tokens_includes_tool_calls(self) -> None:
        # Arrange
        messages = [
            {
                "content": "hello",
                "tool_calls": [{"function": {"arguments": '{"a": 1}'}}],
            }
        ]

        # Act
        tokens = AgentLoop._estimate_tokens(messages)

        # Assert
        assert tokens >= 1

    def test_estimate_tokens_skips_non_string_content(self) -> None:
        # Arrange
        messages = [{"content": None}]

        # Act
        tokens = AgentLoop._estimate_tokens(messages)

        # Assert
        assert tokens >= 1  # returns max(1, 0)


# ---------------------------------------------------------------------------
# Context trimming
# ---------------------------------------------------------------------------


class TestTrimToBudget:
    def test_messages_within_budget_unchanged(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        messages = [{"role": "user", "content": "short"}]

        # Act
        trimmed = loop._trim_to_budget(messages, budget=1000)

        # Assert
        assert trimmed == messages

    def test_messages_trimmed_to_fit_budget(self) -> None:
        # Arrange -- 6 messages each 400 chars (100 tokens each) = ~600 total
        config = make_config()
        loop = AgentLoop(config)
        messages = [
            {"role": "system", "content": "s"},
            {"role": "user", "content": "a" * 400},
            {"role": "assistant", "content": "b" * 400},
            {"role": "user", "content": "c" * 400},
            {"role": "assistant", "content": "d" * 400},
            {"role": "user", "content": "e" * 400},
        ]

        # Act -- budget of 250 tokens can fit ~2.5 messages
        trimmed = loop._trim_to_budget(messages, budget=250)

        # Assert -- at least one message was removed
        assert len(trimmed) < len(messages)
        # System messages should be preserved
        sys_msgs = [m for m in trimmed if m["role"] == "system"]
        assert len(sys_msgs) >= 1

    def test_trim_preserves_system_messages(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        messages = [
            {"role": "system", "content": "important"},
            {"role": "user", "content": "x" * 500},
        ]

        # Act
        trimmed = loop._trim_to_budget(messages, budget=100)

        # Assert
        sys_msgs = [m for m in trimmed if m["role"] == "system"]
        assert any("important" in m["content"] for m in sys_msgs)

    def test_trim_returns_last_three_if_nothing_fits(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        messages = [
            {"role": "user", "content": "a" * 5000},
            {"role": "assistant", "content": "b" * 5000},
            {"role": "user", "content": "c" * 5000},
            {"role": "assistant", "content": "d" * 5000},
        ]

        # Act -- impossibly small budget
        trimmed = loop._trim_to_budget(messages, budget=1)

        # Assert
        assert len(trimmed) == 3


# ---------------------------------------------------------------------------
# Token budget
# ---------------------------------------------------------------------------


class TestTokenBudget:
    def test_initial_budget_is_full_context_minus_output(self) -> None:
        # Arrange
        config = make_config()
        config.llm.context_window = 10000
        config.llm.max_output_tokens = 2000
        loop = AgentLoop(config)

        # Act
        remaining = loop._token_budget_remaining()

        # Assert
        assert remaining == 8000

    def test_budget_decreases_with_usage(self) -> None:
        # Arrange
        config = make_config()
        config.llm.context_window = 10000
        config.llm.max_output_tokens = 2000
        loop = AgentLoop(config)
        loop._total_tokens_used = 3000

        # Act
        remaining = loop._token_budget_remaining()

        # Assert
        assert remaining == 5000

    def test_budget_minimum_zero(self) -> None:
        # Arrange
        config = make_config()
        config.llm.context_window = 100
        config.llm.max_output_tokens = 50
        loop = AgentLoop(config)
        loop._total_tokens_used = 100000

        # Act
        remaining = loop._token_budget_remaining()

        # Assert
        assert remaining == 0


# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------


class TestSessionManagement:
    @pytest.mark.asyncio
    async def test_get_or_create_session_new(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)

        # Act
        session = await loop.get_or_create_session()

        # Assert
        assert session.id
        assert session in loop._sessions.values()

    @pytest.mark.asyncio
    async def test_get_or_create_session_with_id(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)

        # Act
        session = await loop.get_or_create_session("my-session")

        # Assert
        assert session.id == "my-session"
        assert loop._sessions["my-session"] is session

    @pytest.mark.asyncio
    async def test_get_or_create_session_reuses_existing(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        first = await loop.get_or_create_session("abc")

        # Act
        second = await loop.get_or_create_session("abc")

        # Assert
        assert first is second

    @pytest.mark.asyncio
    async def test_session_model_matches_config(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)

        # Act
        session = await loop.get_or_create_session()

        # Assert
        assert session.model == config.llm.model

    @pytest.mark.asyncio
    async def test_session_created_at_is_iso_format(self) -> None:
        config = make_config()
        loop = AgentLoop(config)
        session = await loop.get_or_create_session()
        assert session.created_at
        assert "T" in session.created_at


# ---------------------------------------------------------------------------
# Tool execution
# ---------------------------------------------------------------------------


class TestToolExecution:
    @pytest.mark.asyncio
    async def test_execute_tool_calls_success(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        loop.tools.register_tool("bash", AsyncMock(return_value=ToolResult(output="ok")))

        tool_calls = [
            {"id": "tc1", "function": {"name": "bash", "arguments": '{"command": "echo"}'}},
        ]

        # Act
        results = await loop._execute_tool_calls(tool_calls)

        # Assert
        assert len(results) == 1
        assert results[0].role == "tool"
        assert results[0].content == "ok"
        assert results[0].tool_call_id == "tc1"
        assert results[0].name == "bash"

    @pytest.mark.asyncio
    async def test_execute_tool_calls_error_response(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        loop.tools.register_tool("bash", AsyncMock(return_value=ToolResult(output="", error="denied", success=False)))

        tool_calls = [
            {"id": "tc1", "function": {"name": "bash", "arguments": '{"command": "rm -rf"}'}},
        ]

        # Act
        results = await loop._execute_tool_calls(tool_calls)

        # Assert
        assert len(results) == 1
        assert "Error:" in results[0].content

    @pytest.mark.asyncio
    async def test_execute_tool_calls_invalid_json_arguments(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        loop.tools.register_tool("bash", AsyncMock(return_value=ToolResult(output="ok")))

        tool_calls = [
            {"id": "tc1", "function": {"name": "bash", "arguments": "not valid json"}},
        ]

        # Act
        results = await loop._execute_tool_calls(tool_calls)

        # Assert -- should not crash, arguments parsed as empty dict
        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_execute_multiple_tool_calls(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        loop.tools.register_tool("bash", AsyncMock(return_value=ToolResult(output="ok")))
        loop.tools.register_tool("calculator", AsyncMock(return_value=ToolResult(output="42")))

        tool_calls = [
            {"id": "tc1", "function": {"name": "bash", "arguments": '{"command": "echo"}'}},
            {"id": "tc2", "function": {"name": "calculator", "arguments": '{"expression": "6*7"}'}},
        ]

        # Act
        results = await loop._execute_tool_calls(tool_calls)

        # Assert
        assert len(results) == 2
        assert results[0].name == "bash"
        assert results[1].name == "calculator"

    @pytest.mark.asyncio
    async def test_execute_tool_calls_empty_list(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)

        # Act
        results = await loop._execute_tool_calls([])

        # Assert
        assert results == []


# ---------------------------------------------------------------------------
# chat() non-streaming path
# ---------------------------------------------------------------------------


class TestChatNonStreaming:
    @pytest.mark.asyncio
    async def test_simple_response(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        loop.provider = MockProvider([{"content": "Hello!", "tool_calls": None}])

        # Act
        result = await loop.chat("hi")

        # Assert
        assert result["content"] == "Hello!"
        assert result["tool_calls"] is None
        assert result["session_id"]

    @pytest.mark.asyncio
    async def test_response_includes_session_id(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        loop.provider = MockProvider([{"content": "hi", "tool_calls": None}])

        # Act
        result = await loop.chat("msg", session_id="my-session")

        # Assert
        assert result["session_id"] == "my-session"

    @pytest.mark.asyncio
    async def test_response_includes_unique_id(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        loop.provider = MockProvider([{"content": "hi", "tool_calls": None}])

        # Act
        r1 = await loop.chat("a")
        r2 = await loop.chat("b")

        # Assert
        assert r1["id"] != r2["id"]

    @pytest.mark.asyncio
    async def test_response_with_tool_calls(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        loop.provider = MockProvider(
            [
                {
                    "content": "",
                    "tool_calls": [
                        {
                            "id": "tc1",
                            "type": "function",
                            "function": {"name": "bash", "arguments": '{"command": "echo"}'},
                        }
                    ],
                },
                {"content": "Done!", "tool_calls": None},
            ]
        )
        loop.tools.register_tool("bash", AsyncMock(return_value=ToolResult(output="ok")))

        # Act
        result = await loop.chat("run bash")

        # Assert
        assert result["content"] == "Done!"
        assert result["tool_events"] is not None
        assert len(result["tool_events"]) == 2  # tool_call + tool_result

    @pytest.mark.asyncio
    async def test_max_tool_iterations_guardrail(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        infinite_calls = [
            {
                "content": "",
                "tool_calls": [
                    {
                        "id": f"tc{i}",
                        "type": "function",
                        "function": {"name": "bash", "arguments": '{"command": "echo"}'},
                    }
                ],
            }
            for i in range(MAX_TOOL_ITERATIONS + 5)
        ]
        loop.provider = MockProvider(infinite_calls)
        loop.tools.register_tool("bash", AsyncMock(return_value=ToolResult(output="ok")))

        # Act
        result = await loop.chat("infinite tools")

        # Assert
        assert "maximum" in result["content"].lower() or "Reached maximum" in result["content"]
        assert result["metadata"].get("stopped") is True

    @pytest.mark.asyncio
    async def test_usage_tokens_tracked(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        loop.provider = MockProvider(
            [
                {"content": "hi", "tool_calls": None, "usage": {"total_tokens": 100}},
            ]
        )

        # Act
        result = await loop.chat("hello")

        # Assert
        assert result["metadata"]["tokens_used"] >= 100

    @pytest.mark.asyncio
    async def test_session_messages_stored(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        loop.provider = MockProvider([{"content": "reply", "tool_calls": None}])

        # Act
        await loop.chat("msg1", session_id="s1")

        # Assert
        session = await loop.get_or_create_session("s1")
        roles = [m.role for m in session.messages]
        assert "user" in roles
        assert "assistant" in roles


# ---------------------------------------------------------------------------
# Memory persistence
# ---------------------------------------------------------------------------


class TestMemoryPersistence:
    @pytest.mark.asyncio
    async def test_persist_memory_stores_entry(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        mock_memory = AsyncMock()
        loop.memory = mock_memory
        session = Session(id="s1")

        # Act
        await loop._persist_memory(session, "user", "hello world")

        # Assert
        mock_memory.store.assert_called_once()
        entry = mock_memory.store.call_args[0][0]
        assert entry.content == "hello world"
        assert entry.source == "agent_loop"
        assert entry.session_id == "s1"

    @pytest.mark.asyncio
    async def test_persist_memory_skips_empty_content(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        mock_memory = AsyncMock()
        loop.memory = mock_memory
        session = Session(id="s1")

        # Act
        await loop._persist_memory(session, "user", "")

        # Assert
        mock_memory.store.assert_not_called()

    @pytest.mark.asyncio
    async def test_persist_memory_skips_when_no_memory(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        loop.memory = None
        session = Session(id="s1")

        # Act -- should not raise
        await loop._persist_memory(session, "user", "hello")

    @pytest.mark.asyncio
    async def test_persist_memory_skips_none_content(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        mock_memory = AsyncMock()
        loop.memory = mock_memory
        session = Session(id="s1")

        # Act
        await loop._persist_memory(session, "user", None)

        # Assert
        mock_memory.store.assert_not_called()


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------


class TestToolDefinitions:
    def test_get_tool_definitions_delegates_to_registry(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)

        # Act
        defs = loop._get_tool_definitions()

        # Assert
        assert isinstance(defs, list)
        assert len(defs) > 0
        assert any(d["function"]["name"] == "bash" for d in defs)


# ---------------------------------------------------------------------------
# _now_iso helper
# ---------------------------------------------------------------------------


class TestNowIso:
    def test_returns_iso_string(self) -> None:
        result = _now_iso()
        assert isinstance(result, str)
        assert "T" in result

    def test_includes_timezone(self) -> None:
        result = _now_iso()
        assert "+" in result or "Z" in result or "00:00" in result


# ---------------------------------------------------------------------------
# Summarize messages
# ---------------------------------------------------------------------------


class TestSummarizeMessages:
    @pytest.mark.asyncio
    async def test_summarize_returns_empty_for_short_messages(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        loop.provider = MockProvider([])

        # Act
        summary = await loop._summarize_messages([{"role": "user", "content": "hi"}])

        # Assert
        assert summary == ""

    @pytest.mark.asyncio
    async def test_summarize_returns_empty_for_empty_list(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)

        # Act
        summary = await loop._summarize_messages([])

        # Assert
        assert summary == ""

    @pytest.mark.asyncio
    async def test_summarize_calls_provider(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        loop.provider = MockProvider([{"content": "Summary of chat", "tool_calls": None}])

        # Act
        messages = [
            {"role": "user", "content": "long message " * 50},
            {"role": "assistant", "content": "reply " * 50},
        ]
        summary = await loop._summarize_messages(messages)

        # Assert
        assert summary == "Summary of chat"

    @pytest.mark.asyncio
    async def test_summarize_handles_provider_error(self) -> None:
        # Arrange
        config = make_config()
        loop = AgentLoop(config)
        loop.provider = AsyncMock()
        loop.provider.complete = AsyncMock(side_effect=RuntimeError("fail"))

        # Act
        messages = [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "there"},
        ]
        summary = await loop._summarize_messages(messages)

        # Assert
        assert summary == ""

    @pytest.mark.asyncio
    async def test_summarize_omits_system_messages(self) -> None:
        # Arrange
        config = make_config()
        received_messages = []

        class CapturingProvider:
            async def complete(self, **kwargs):
                received_messages.extend(kwargs.get("messages", []))
                return {"content": "summary", "tool_calls": None}

        loop = AgentLoop(config)
        loop.provider = CapturingProvider()

        # Act
        messages = [
            {"role": "system", "content": "secret"},
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "there"},
        ]
        await loop._summarize_messages(messages)

        # Assert -- the conversation text sent to LLM should not contain system role content
        conv_msg = received_messages[-1]
        assert "secret" not in conv_msg.get("content", "")
