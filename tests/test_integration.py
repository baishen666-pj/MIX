import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

from engine.tools.registry import ToolRegistry
from engine.tools.types import ToolResult
from engine.agent.router import AgentRouter, AgentInstance
from engine.sandbox.types import SandboxManager
from engine.sandbox.local import LocalBackend
from engine.mcp.client import MCPClient, MCPServerConfig, MCPTool
from engine.config import MixConfig, ProviderConfig
from engine.memory.store import MemoryStore


# --- Tool Registry with Sandbox ---

@pytest.mark.asyncio
async def test_registry_with_sandbox(tmp_path: Path) -> None:
    from engine.sandbox.local import LocalBackend
    registry = ToolRegistry()
    sandbox = LocalBackend()
    registry.set_sandbox(sandbox)

    result = await registry.execute("bash", command="echo sandboxed")
    assert result.success
    assert "sandboxed" in result.output


@pytest.mark.asyncio
async def test_registry_register_custom_tool() -> None:
    registry = ToolRegistry()

    async def custom_handler(**kwargs):
        return ToolResult(output=f"custom: {kwargs.get('name', 'unknown')}")

    registry.register_tool("custom", custom_handler)
    assert "custom" in registry.list_tools()

    result = await registry.execute("custom", name="test")
    assert result.success
    assert "custom: test" in result.output


@pytest.mark.asyncio
async def test_registry_mcp_tool() -> None:
    registry = ToolRegistry()

    async def mcp_handler(**kwargs):
        return ToolResult(output="mcp result")

    registry.register_mcp_tool("mcp_weather_get", mcp_handler)
    assert "mcp_weather_get" in registry.list_tools()

    result = await registry.execute("mcp_weather_get", city="Beijing")
    assert result.success
    assert "mcp result" in result.output

    defs = registry.get_definitions()
    mcp_defs = [d for d in defs if d["function"]["name"] == "mcp_weather_get"]
    assert len(mcp_defs) == 1


# --- Agent Router ---

@pytest.fixture
def config() -> MixConfig:
    return MixConfig(
        llm=ProviderConfig(provider="openai", model="gpt-4", api_key="test-key"),
    )


@pytest.fixture
async def router_memory(tmp_path: Path) -> MemoryStore:
    store = MemoryStore(tmp_path / "router.db")
    await store.connect()
    yield store
    await store.close()


@pytest.mark.asyncio
async def test_router_default_agent(config: MixConfig, router_memory: MemoryStore) -> None:
    router = AgentRouter(config, router_memory)
    agent = router.resolve("webchat", "user1")
    assert agent.name == "main"


@pytest.mark.asyncio
async def test_router_channel_routing(config: MixConfig, router_memory: MemoryStore) -> None:
    router = AgentRouter(config, router_memory)
    router.register_agent("telegram_bot", channels=["telegram"])
    router.register_agent("discord_bot", channels=["discord"])

    tg_agent = router.resolve("telegram", "user1")
    assert tg_agent.name == "telegram_bot"

    dc_agent = router.resolve("discord", "user1")
    assert dc_agent.name == "discord_bot"

    web_agent = router.resolve("webchat", "user1")
    assert web_agent.name == "main"


@pytest.mark.asyncio
async def test_router_user_filtering(config: MixConfig, router_memory: MemoryStore) -> None:
    router = AgentRouter(config, router_memory)
    router.register_agent("private_bot", channels=["telegram"], allowed_users=["vip_user"])

    # VIP user gets the private bot
    agent = router.resolve("telegram", "vip_user")
    assert agent.name == "private_bot"

    # Non-VIP falls through to default
    agent2 = router.resolve("telegram", "regular_user")
    assert agent2.name == "main"


@pytest.mark.asyncio
async def test_router_list_agents(config: MixConfig, router_memory: MemoryStore) -> None:
    router = AgentRouter(config, router_memory)
    router.register_agent("bot_a", channels=["slack"])
    router.register_agent("bot_b", channels=["discord"])

    agents = router.list_agents()
    names = [a["name"] for a in agents]
    assert "bot_a" in names
    assert "bot_b" in names
    assert "main" in names


# --- MCP Client ---

def test_mcp_register_server() -> None:
    client = MCPClient()
    config = MCPServerConfig(name="weather", url="http://localhost:3001")
    client.register_server(config)

    servers = client.list_servers()
    assert len(servers) == 1
    assert servers[0]["name"] == "weather"


def test_mcp_remove_server() -> None:
    client = MCPClient()
    client.register_server(MCPServerConfig(name="test", url="http://localhost:3001"))
    assert client.remove_server("test") is True
    assert client.remove_server("nonexistent") is False


def test_mcp_tool_definitions() -> None:
    client = MCPClient()
    client._tools["mcp_weather_get"] = MCPTool(
        name="mcp_weather_get",
        description="Get weather",
        server="weather",
    )
    defs = client.get_tool_definitions()
    assert len(defs) == 1
    assert defs[0]["function"]["name"] == "mcp_weather_get"
    assert "weather" in defs[0]["function"]["description"]


# --- Sandbox Manager ---

def test_sandbox_manager() -> None:
    manager = SandboxManager(default_backend="local")
    manager.register(LocalBackend())

    backend = manager.get()
    assert backend.name == "local"

    backend2 = manager.get("local")
    assert backend2.name == "local"


def test_sandbox_manager_unknown() -> None:
    manager = SandboxManager()
    with pytest.raises(ValueError, match="not found"):
        manager.get("nonexistent")


@pytest.mark.asyncio
async def test_local_sandbox_cwd(tmp_path: Path) -> None:
    backend = LocalBackend()
    result = await backend.execute("cd")
    assert result["exit_code"] == 0
    assert result["stdout"].strip() != ""
