from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from engine.config import ProviderConfig
from engine.llm import OpenAICompatibleProvider


@pytest.fixture
def config():
    return ProviderConfig(provider="openrouter", model="test-model", api_key="sk-test", base_url="https://test.api/v1")


@pytest.mark.asyncio
async def test_complete_returns_content(config):
    provider = OpenAICompatibleProvider(config)
    mock_choice = MagicMock()
    mock_choice.message.content = "Hello!"
    mock_choice.message.tool_calls = None
    mock_choice.finish_reason = "stop"
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch.object(provider, "_get_client") as mock_client_get:
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_client_get.return_value = mock_client

        result = await provider.complete([{"role": "user", "content": "Hi"}])

    assert result["content"] == "Hello!"
    assert result["tool_calls"] is None


@pytest.mark.asyncio
async def test_complete_with_tool_calls(config):
    provider = OpenAICompatibleProvider(config)
    mock_tc = MagicMock()
    mock_tc.id = "tc-1"
    mock_tc.function.name = "get_weather"
    mock_tc.function.arguments = '{"city": "SF"}'
    mock_choice = MagicMock()
    mock_choice.message.content = ""
    mock_choice.message.tool_calls = [mock_tc]
    mock_choice.finish_reason = "tool_calls"
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch.object(provider, "_get_client") as mock_client_get:
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_client_get.return_value = mock_client

        result = await provider.complete([{"role": "user", "content": "weather"}])

    assert result["tool_calls"] is not None
    assert result["tool_calls"][0]["function"]["name"] == "get_weather"


@pytest.mark.asyncio
async def test_client_is_cached(config):
    provider = OpenAICompatibleProvider(config)
    client1 = provider._get_client()
    client2 = provider._get_client()
    assert client1 is client2
