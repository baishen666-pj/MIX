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
    def __init__(self, config: ProviderConfig) -> None:
        super().__init__(config)
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            from openai import AsyncOpenAI
            base_url = self.config.base_url or _default_base_url(self.config.provider)
            self._client = AsyncOpenAI(api_key=self.config.api_key, base_url=base_url)
        return self._client

    async def complete(self, messages: list[dict], tools: list[dict] | None = None, **kwargs) -> dict:
        create_kwargs: dict = {"model": self.config.model, "messages": messages, **kwargs}
        if tools:
            create_kwargs["tools"] = tools

        response = await self._get_client().chat.completions.create(**create_kwargs)
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

        create_kwargs: dict = {"model": self.config.model, "messages": messages, "stream": True, **kwargs}
        if tools:
            create_kwargs["tools"] = tools

        stream = await self._get_client().chat.completions.create(**create_kwargs)

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
    def __init__(self, config: ProviderConfig) -> None:
        super().__init__(config)
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            from anthropic import AsyncAnthropic
            self._client = AsyncAnthropic(api_key=self.config.api_key)
        return self._client

    async def complete(self, messages: list[dict], tools: list[dict] | None = None, **kwargs) -> dict:
        client = self._get_client()
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
        if tools:
            create_kwargs["tools"] = [
                {
                    "name": t["function"]["name"],
                    "description": t["function"].get("description", ""),
                    "input_schema": json.loads(t["function"].get("parameters", "{}")),
                }
                for t in tools
            ]

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
        client = self._get_client()
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
        if tools:
            create_kwargs["tools"] = [
                {
                    "name": t["function"]["name"],
                    "description": t["function"].get("description", ""),
                    "input_schema": json.loads(t["function"].get("parameters", "{}")),
                }
                for t in tools
            ]

        tool_calls_acc: dict[int, dict] = {}

        async with client.messages.stream(**create_kwargs) as stream:
            async for event in stream:
                if event.type == "content_block_delta":
                    if event.delta.type == "text_delta":
                        yield {"delta": event.delta.text, "done": False}
                    elif event.delta.type == "input_json_delta":
                        idx = event.index
                        if idx in tool_calls_acc:
                            tool_calls_acc[idx]["function"]["arguments"] += event.delta.partial_json
                elif event.type == "content_block_start":
                    if event.content_block.type == "tool_use":
                        tool_calls_acc[event.index] = {
                            "id": event.content_block.id,
                            "type": "function",
                            "function": {
                                "name": event.content_block.name,
                                "arguments": "",
                            },
                        }
                elif event.type == "message_stop":
                    if tool_calls_acc:
                        final_tool_calls = [tool_calls_acc[i] for i in sorted(tool_calls_acc)]
                        yield {"delta": "", "done": True, "tool_calls": final_tool_calls}
                    else:
                        yield {"delta": "", "done": True}
                    return


def _default_base_url(provider: str) -> str | None:
    urls = {
        "openrouter": "https://openrouter.ai/api/v1",
        "nvidia": "https://integrate.api.nvidia.com/v1",
        "local": "http://localhost:11434/v1",
    }
    return urls.get(provider)
