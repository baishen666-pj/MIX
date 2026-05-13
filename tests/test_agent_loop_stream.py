import pytest

from engine.agent.loop import MAX_TOOL_ITERATIONS, AgentLoop
from engine.config import EngineConfig, MemoryConfig, MixConfig, ProviderConfig
from engine.tools.registry import ToolResult


async def mock_bash(**kw):
    return ToolResult(output="ok")


def make_config() -> MixConfig:
    return MixConfig(
        engine=EngineConfig(),
        llm=ProviderConfig(provider="openai", model="gpt-4o", api_key="test"),
        memory=MemoryConfig(),
    )


class MockProvider:
    def __init__(self, responses: list[dict]) -> None:
        self._responses = list(responses)
        self._call_count = 0

    async def complete(self, **kwargs) -> dict:
        if self._call_count < len(self._responses):
            resp = self._responses[self._call_count]
            self._call_count += 1
            return resp
        return {"content": "done", "tool_calls": None}

    async def stream(self, **kwargs):
        if self._call_count < len(self._responses):
            resp = self._responses[self._call_count]
            self._call_count += 1
            for chunk in self._stream_response(resp):
                yield chunk
        else:
            yield {"delta": "done", "done": True}

    def _stream_response(self, resp: dict):
        content = resp.get("content", "")
        tool_calls = resp.get("tool_calls")
        if content:
            yield {"delta": content, "done": False}
        if tool_calls:
            yield {"delta": "", "done": True, "tool_calls": tool_calls}
        else:
            yield {"delta": "", "done": True}


@pytest.mark.asyncio
async def test_chat_stream_no_tool_calls() -> None:
    config = make_config()
    loop = AgentLoop(config)
    loop.provider = MockProvider([{"content": "Hello!", "tool_calls": None}])

    chunks = []
    async for chunk in loop.chat_stream("hi"):
        chunks.append(chunk)

    assert chunks[-1]["done"] is True
    assert any(c["delta"] == "Hello!" for c in chunks)


@pytest.mark.asyncio
async def test_chat_stream_single_tool_call() -> None:
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
                        "function": {"name": "bash", "arguments": '{"command": "echo hi"}'},
                    }
                ],
            },
            {"content": "Done!", "tool_calls": None},
        ]
    )
    loop.tools.register_tool("bash", mock_bash)

    chunks = []
    async for chunk in loop.chat_stream("run echo"):
        chunks.append(chunk)

    tool_call_chunks = [c for c in chunks if c.get("type") == "tool_call"]
    tool_result_chunks = [c for c in chunks if c.get("type") == "tool_result"]
    assert len(tool_call_chunks) == 1
    assert len(tool_result_chunks) == 1
    assert tool_result_chunks[0]["name"] == "bash"
    assert chunks[-1]["done"] is True


@pytest.mark.asyncio
async def test_chat_stream_multi_iteration() -> None:
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
                        "function": {"name": "bash", "arguments": '{"command": "echo 1"}'},
                    }
                ],
            },
            {
                "content": "",
                "tool_calls": [
                    {
                        "id": "tc2",
                        "type": "function",
                        "function": {"name": "bash", "arguments": '{"command": "echo 2"}'},
                    }
                ],
            },
            {"content": "All done!", "tool_calls": None},
        ]
    )
    loop.tools.register_tool("bash", mock_bash)

    chunks = []
    async for chunk in loop.chat_stream("run chain"):
        chunks.append(chunk)

    tool_call_chunks = [c for c in chunks if c.get("type") == "tool_call"]
    assert len(tool_call_chunks) == 2
    assert chunks[-1]["done"] is True


@pytest.mark.asyncio
async def test_chat_stream_respects_max_iterations() -> None:
    config = make_config()
    loop = AgentLoop(config)

    infinite_tool_calls = [
        {
            "content": "",
            "tool_calls": [
                {"id": f"tc{i}", "type": "function", "function": {"name": "bash", "arguments": '{"command": "echo"}'}}
            ],
        }
        for i in range(MAX_TOOL_ITERATIONS + 5)
    ]
    loop.provider = MockProvider(infinite_tool_calls)
    loop.tools.register_tool("bash", mock_bash)

    chunks = []
    async for chunk in loop.chat_stream("loop forever"):
        chunks.append(chunk)

    tool_call_chunks = [c for c in chunks if c.get("type") == "tool_call"]
    assert len(tool_call_chunks) == MAX_TOOL_ITERATIONS


@pytest.mark.asyncio
async def test_chat_stream_yields_deltas() -> None:
    config = make_config()
    loop = AgentLoop(config)
    loop.provider = MockProvider([{"content": "Hello world", "tool_calls": None}])

    chunks = []
    async for chunk in loop.chat_stream("hi"):
        chunks.append(chunk)

    text_deltas = [c["delta"] for c in chunks if c.get("delta")]
    assert "Hello world" in text_deltas


@pytest.mark.asyncio
async def test_chat_stream_session_persistence() -> None:
    config = make_config()
    loop = AgentLoop(config)
    loop.provider = MockProvider(
        [
            {"content": "First response", "tool_calls": None},
            {"content": "Second response", "tool_calls": None},
        ]
    )

    chunks1 = []
    async for chunk in loop.chat_stream("msg1", session_id="sess-1"):
        chunks1.append(chunk)

    chunks2 = []
    async for chunk in loop.chat_stream("msg2", session_id="sess-1"):
        chunks2.append(chunk)

    session = await loop.get_or_create_session("sess-1")
    assert len(session.messages) == 4


@pytest.mark.asyncio
async def test_chat_no_tool_calls() -> None:
    config = make_config()
    loop = AgentLoop(config)
    loop.provider = MockProvider([{"content": "Hi back!", "tool_calls": None}])

    result = await loop.chat("hello")
    assert result["content"] == "Hi back!"
    assert result["tool_calls"] is None


@pytest.mark.asyncio
async def test_chat_with_tool_calls() -> None:
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
                        "function": {"name": "bash", "arguments": '{"command": "echo ok"}'},
                    }
                ],
            },
            {"content": "Result: ok", "tool_calls": None},
        ]
    )
    loop.tools.register_tool("bash", mock_bash)

    result = await loop.chat("run echo")
    assert result["content"] == "Result: ok"
    assert result["tool_events"] is not None
    assert len(result["tool_events"]) == 2
