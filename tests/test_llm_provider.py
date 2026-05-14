"""Tests for engine.llm — create_provider factory, base class, and default URLs."""

from __future__ import annotations

import pytest

from engine.config import ProviderConfig
from engine.llm import (
    AnthropicProvider,
    LLMProvider,
    OpenAICompatibleProvider,
    _default_base_url,
    create_provider,
)


def _cfg(provider: str, **overrides) -> ProviderConfig:
    defaults = {"provider": provider, "model": "test-model", "api_key": "k"}
    defaults.update(overrides)
    return ProviderConfig(**defaults)


class TestCreateProvider:
    def test_openai_returns_openai_compatible(self):
        p = create_provider(_cfg("openai"))
        assert isinstance(p, OpenAICompatibleProvider)

    def test_openrouter_returns_openai_compatible(self):
        p = create_provider(_cfg("openrouter"))
        assert isinstance(p, OpenAICompatibleProvider)

    def test_anthropic_returns_anthropic(self):
        p = create_provider(_cfg("anthropic"))
        assert isinstance(p, AnthropicProvider)

    def test_nvidia_returns_openai_compatible(self):
        p = create_provider(_cfg("nvidia"))
        assert isinstance(p, OpenAICompatibleProvider)

    def test_local_returns_openai_compatible(self):
        p = create_provider(_cfg("local"))
        assert isinstance(p, OpenAICompatibleProvider)

    def test_unknown_falls_back_to_openai_compatible(self):
        p = create_provider(_cfg("unknown_provider"))
        assert isinstance(p, OpenAICompatibleProvider)

    def test_returns_llm_provider_subclass(self):
        p = create_provider(_cfg("openai"))
        assert isinstance(p, LLMProvider)

    def test_config_preserved(self):
        cfg = _cfg("openai", model="gpt-4")
        p = create_provider(cfg)
        assert p.config is cfg
        assert p.config.model == "gpt-4"


class TestBaseClass:
    @pytest.mark.asyncio
    async def test_complete_raises_not_implemented(self):
        provider = LLMProvider(_cfg("test"))
        with pytest.raises(NotImplementedError):
            await provider.complete([])

    @pytest.mark.asyncio
    async def test_stream_raises_not_implemented(self):
        provider = LLMProvider(_cfg("test"))
        with pytest.raises(NotImplementedError):
            async for _ in provider.stream([]):
                pass


class TestDefaultBaseUrl:
    def test_openrouter(self):
        assert _default_base_url("openrouter") == "https://openrouter.ai/api/v1"

    def test_nvidia(self):
        assert _default_base_url("nvidia") == "https://integrate.api.nvidia.com/v1"

    def test_local(self):
        assert _default_base_url("local") == "http://localhost:11434/v1"

    def test_openai_returns_none(self):
        assert _default_base_url("openai") is None

    def test_unknown_returns_none(self):
        assert _default_base_url("nonexistent") is None
