from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from engine.config import ProviderConfig
from engine.llm import AnthropicProvider


def make_config() -> ProviderConfig:
    return ProviderConfig(
        provider="anthropic",
        model="claude-sonnet-4-20250514",
        api_key="test-key",
    )


def make_text_delta(text: str) -> MagicMock:
    event = MagicMock()
    event.type = "content_block_delta"
    event.delta = MagicMock()
    event.delta.type = "text_delta"
    event.delta.text = text
    event.index = 0
    return event


def make_tool_start(index: int, tool_id: str, name: str) -> MagicMock:
    event = MagicMock()
    event.type = "content_block_start"
    event.index = index
    event.content_block = MagicMock()
    event.content_block.type = "tool_use"
    event.content_block.id = tool_id
    event.content_block.name = name
    return event


def make_tool_delta(index: int, partial_json: str) -> MagicMock:
    event = MagicMock()
    event.type = "content_block_delta"
    event.delta = MagicMock()
    event.delta.type = "input_json_delta"
    event.delta.partial_json = partial_json
    event.index = index
    return event


def make_message_stop() -> MagicMock:
    event = MagicMock()
    event.type = "message_stop"
    return event


class AsyncEventIterator:
    def __init__(self, events):
        self._events = list(events)
        self._index = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._index >= len(self._events):
            raise StopAsyncIteration
        event = self._events[self._index]
        self._index += 1
        return event


def make_mock_stream(events):
    stream = AsyncMock()
    stream.__aenter__ = AsyncMock(return_value=stream)
    stream.__aexit__ = AsyncMock(return_value=False)
    stream.__aiter__ = MagicMock(return_value=AsyncEventIterator(events))
    return stream


@pytest.mark.asyncio
async def test_anthropic_stream_text_only() -> None:
    provider = AnthropicProvider(make_config())

    events = [
        make_text_delta("Hello "),
        make_text_delta("world"),
        make_message_stop(),
    ]

    mock_stream = make_mock_stream(events)

    with patch("anthropic.AsyncAnthropic") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.messages.stream.return_value = mock_stream

        chunks = []
        async for chunk in provider.stream(messages=[{"role": "user", "content": "hi"}]):
            chunks.append(chunk)

    assert len(chunks) == 3
    assert chunks[0]["delta"] == "Hello "
    assert chunks[0]["done"] is False
    assert chunks[1]["delta"] == "world"
    assert chunks[2]["done"] is True
    assert chunks[2].get("tool_calls") is None


@pytest.mark.asyncio
async def test_anthropic_stream_with_tool_calls() -> None:
    provider = AnthropicProvider(make_config())

    events = [
        make_tool_start(0, "tool-1", "get_weather"),
        make_tool_delta(0, '{"city": "SF"}'),
        make_message_stop(),
    ]

    mock_stream = make_mock_stream(events)

    with patch("anthropic.AsyncAnthropic") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.messages.stream.return_value = mock_stream

        chunks = []
        async for chunk in provider.stream(
            messages=[{"role": "user", "content": "weather"}],
            tools=[{"function": {"name": "get_weather", "parameters": "{}"}}],
        ):
            chunks.append(chunk)

    assert chunks[-1]["done"] is True
    assert chunks[-1]["tool_calls"] is not None
    assert len(chunks[-1]["tool_calls"]) == 1
    tc = chunks[-1]["tool_calls"][0]
    assert tc["function"]["name"] == "get_weather"
    assert tc["function"]["arguments"] == '{"city": "SF"}'


@pytest.mark.asyncio
async def test_anthropic_stream_text_then_tool() -> None:
    provider = AnthropicProvider(make_config())

    events = [
        make_text_delta("Let me check"),
        make_tool_start(1, "tool-2", "search"),
        make_tool_delta(1, '{"q": "test"}'),
        make_message_stop(),
    ]

    mock_stream = make_mock_stream(events)

    with patch("anthropic.AsyncAnthropic") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.messages.stream.return_value = mock_stream

        chunks = []
        async for chunk in provider.stream(messages=[{"role": "user", "content": "search"}]):
            chunks.append(chunk)

    assert any(c["delta"] == "Let me check" for c in chunks)
    assert chunks[-1]["done"] is True
    assert chunks[-1]["tool_calls"] is not None


@pytest.mark.asyncio
async def test_anthropic_stream_multiple_tools() -> None:
    provider = AnthropicProvider(make_config())

    events = [
        make_tool_start(0, "t1", "tool_a"),
        make_tool_delta(0, '{"a": 1}'),
        make_tool_start(1, "t2", "tool_b"),
        make_tool_delta(1, '{"b": 2}'),
        make_message_stop(),
    ]

    mock_stream = make_mock_stream(events)

    with patch("anthropic.AsyncAnthropic") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.messages.stream.return_value = mock_stream

        chunks = []
        async for chunk in provider.stream(messages=[{"role": "user", "content": "go"}]):
            chunks.append(chunk)

    assert chunks[-1]["done"] is True
    assert len(chunks[-1]["tool_calls"]) == 2
    assert chunks[-1]["tool_calls"][0]["function"]["name"] == "tool_a"
    assert chunks[-1]["tool_calls"][1]["function"]["name"] == "tool_b"


@pytest.mark.asyncio
async def test_anthropic_stream_no_events() -> None:
    provider = AnthropicProvider(make_config())

    events = [make_message_stop()]
    mock_stream = make_mock_stream(events)

    with patch("anthropic.AsyncAnthropic") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.messages.stream.return_value = mock_stream

        chunks = []
        async for chunk in provider.stream(messages=[{"role": "user", "content": "hi"}]):
            chunks.append(chunk)

    assert chunks[-1]["done"] is True
    assert chunks[-1].get("tool_calls") is None
