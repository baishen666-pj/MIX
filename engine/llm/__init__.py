from __future__ import annotations

import json
from engine.config import ProviderConfig


class LLMProvider:
    def __init__(self, config: ProviderConfig) -> None:
        self.config = config

    async def complete(self, messages: list[dict], tools: list[dict] | None = None, **kwargs) -> dict:
        raise NotImplementedError

    async def stream(self, messages: list[dict], tools: list[dict] | None = None, **kwargs):
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
    async def complete(self, messages: list[dict], tools: list[dict] | None = None, **kwargs) -> dict:
        from openai import AsyncOpenAI

        base_url = self.config.base_url or _default_base_url(self.config.provider)
        client = AsyncOpenAI(api_key=self.config.api_key, base_url=base_url)

        create_kwargs: dict = {"model": self.config.model, "messages": messages, **kwargs}
        if tools:
            create_kwargs["tools"] = tools

        response = await client.chat.completions.create(**create_kwargs)
        choice = response.choices[0]
        msg = choice.message

        tool_calls = None
        if msg.tool_calls:
            tool_calls = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in msg.tool_calls
            ]

        return {
            "content": msg.content or "",
            "tool_calls": tool_calls,
            "finish_reason": choice.finish_reason,
        }

    async def stream(self, messages: list[dict], tools: list[dict] | None = None, **kwargs):
        from openai import AsyncOpenAI

        base_url = self.config.base_url or _default_base_url(self.config.provider)
        client = AsyncOpenAI(api_key=self.config.api_key, base_url=base_url)

        create_kwargs: dict = {"model": self.config.model, "messages": messages, "stream": True, **kwargs}
        if tools:
            create_kwargs["tools"] = tools

        stream = await client.chat.completions.create(**create_kwargs)

        tool_calls_acc: dict[int, dict] = {}

        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            finish_reason = chunk.choices[0].finish_reason

            if delta and delta.content:
                yield {"delta": delta.content, "done": False}

            if delta and delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in tool_calls_acc:
                        tool_calls_acc[idx] = {
                            "id": tc.id or "",
                            "type": "function",
                            "function": {"name": tc.function.name or "", "arguments": ""},
                        }
                    if tc.function.name:
                        tool_calls_acc[idx]["function"]["name"] += tc.function.name
                    if tc.function.arguments:
                        tool_calls_acc[idx]["function"]["arguments"] += tc.function.arguments

            if finish_reason == "tool_calls":
                final_tool_calls = [tool_calls_acc[i] for i in sorted(tool_calls_acc)]
                yield {"delta": "", "done": True, "tool_calls": final_tool_calls}
                return

            if finish_reason == "stop":
                yield {"delta": "", "done": True}
                return

        yield {"delta": "", "done": True}


class AnthropicProvider(LLMProvider):
    async def complete(self, messages: list[dict], tools: list[dict] | None = None, **kwargs) -> dict:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=self.config.api_key)
        system_msg = ""
        chat_messages = []
        for m in messages:
            if m["role"] == "system":
                system_msg = m["content"]
            elif m["role"] == "tool":
                chat_messages.append({"role": "user", "content": f"Tool result ({m.get('name', '')}): {m['content']}"})
            else:
                chat_messages.append(m)

        create_kwargs: dict = {
            "model": self.config.model,
            "max_tokens": 4096,
            "messages": chat_messages,
            **kwargs,
        }
        if system_msg:
            create_kwargs["system"] = system_msg

        response = await client.messages.create(**create_kwargs)

        tool_calls = None
        text_content = ""
        for block in response.content:
            if block.type == "text":
                text_content += block.text
            elif block.type == "tool_use":
                if tool_calls is None:
                    tool_calls = []
                tool_calls.append({
                    "id": block.id,
                    "type": "function",
                    "function": {
                        "name": block.name,
                        "arguments": json.dumps(block.input),
                    },
                })

        return {"content": text_content, "tool_calls": tool_calls}

    async def stream(self, messages: list[dict], tools: list[dict] | None = None, **kwargs):
        import anthropic as anthropic_mod
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=self.config.api_key)
        system_msg = ""
        chat_messages = []
        for m in messages:
            if m["role"] == "system":
                system_msg = m["content"]
            elif m["role"] == "tool":
                chat_messages.append({"role": "user", "content": f"Tool result ({m.get('name', '')}): {m['content']}"})
            else:
                chat_messages.append(m)

        create_kwargs: dict = {
            "model": self.config.model,
            "max_tokens": 4096,
            "messages": chat_messages,
            **kwargs,
        }
        if system_msg:
            create_kwargs["system"] = system_msg

        async with client.messages.stream(**create_kwargs) as stream:
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
