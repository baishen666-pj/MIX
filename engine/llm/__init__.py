from __future__ import annotations

from engine.config import ProviderConfig


class LLMProvider:
    """Base class for LLM providers."""

    def __init__(self, config: ProviderConfig) -> None:
        self.config = config

    async def complete(self, messages: list[dict], **kwargs) -> dict:
        raise NotImplementedError

    async def stream(self, messages: list[dict], **kwargs):
        raise NotImplementedError
        yield  # pragma: no cover


def create_provider(config: ProviderConfig) -> LLMProvider:
    providers = {
        "openrouter": OpenAICompatibleProvider,
        "openai": OpenAICompatibleProvider,
        "anthropic": AnthropicProvider,
        "nvidia": OpenAICompatibleProvider,
        "local": OpenAICompatibleProvider,
    }
    cls = providers.get(config.provider, OpenAICompatibleProvider)
    return cls(config)


class OpenAICompatibleProvider(LLMProvider):
    async def complete(self, messages: list[dict], **kwargs) -> dict:
        from openai import AsyncOpenAI

        base_url = self.config.base_url or _default_base_url(self.config.provider)
        client = AsyncOpenAI(api_key=self.config.api_key, base_url=base_url)

        response = await client.chat.completions.create(
            model=self.config.model,
            messages=messages,
            **kwargs,
        )
        choice = response.choices[0]
        return {
            "content": choice.message.content or "",
            "tool_calls": None,
        }

    async def stream(self, messages: list[dict], **kwargs):
        from openai import AsyncOpenAI

        base_url = self.config.base_url or _default_base_url(self.config.provider)
        client = AsyncOpenAI(api_key=self.config.api_key, base_url=base_url)

        stream = await client.chat.completions.create(
            model=self.config.model,
            messages=messages,
            stream=True,
            **kwargs,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and delta.content:
                yield {"delta": delta.content, "done": False}
        yield {"delta": "", "done": True}


class AnthropicProvider(LLMProvider):
    async def complete(self, messages: list[dict], **kwargs) -> dict:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=self.config.api_key)
        system_msg = ""
        chat_messages = []
        for m in messages:
            if m["role"] == "system":
                system_msg = m["content"]
            else:
                chat_messages.append(m)

        response = await client.messages.create(
            model=self.config.model,
            max_tokens=4096,
            system=system_msg if system_msg else anthropic.NOT_GIVEN,
            messages=chat_messages,
        )
        return {
            "content": response.content[0].text if response.content else "",
            "tool_calls": None,
        }

    async def stream(self, messages: list[dict], **kwargs):
        import anthropic as anthropic_mod
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=self.config.api_key)
        system_msg = ""
        chat_messages = []
        for m in messages:
            if m["role"] == "system":
                system_msg = m["content"]
            else:
                chat_messages.append(m)

        async with client.messages.stream(
            model=self.config.model,
            max_tokens=4096,
            system=system_msg if system_msg else anthropic_mod.NOT_GIVEN,
            messages=chat_messages,
        ) as stream:
            async for text in stream.text_stream:
                yield {"delta": text, "done": False}
        yield {"delta": "", "done": True}


def _default_base_url(provider: str) -> str | None:
    urls = {
        "openrouter": "https://openrouter.ai/api/v1",
        "nvidia": "https://integrate.api.nvidia.com/v1",
        "local": "http://localhost:11434/v1",
    }
    return urls.get(provider)
