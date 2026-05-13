"""Tests for engine.agent.router — AgentRouter resolve logic."""

from __future__ import annotations

from engine.agent.router import AgentRouter
from engine.config import EngineConfig, MemoryConfig, MixConfig, ProviderConfig


def make_config(model: str = "gpt-4o") -> MixConfig:
    return MixConfig(
        engine=EngineConfig(),
        llm=ProviderConfig(provider="openai", model=model, api_key="test"),
        memory=MemoryConfig(),
    )


class TestAgentRouter:
    def test_default_agent_created(self) -> None:
        config = make_config()
        router = AgentRouter(config, memory=None)
        assert router.get_agent("main") is None  # default is not in _agents dict
        agents = router.list_agents()
        names = [a["name"] for a in agents]
        assert "main" in names

    def test_register_and_resolve_by_channel(self) -> None:
        config = make_config()
        router = AgentRouter(config, memory=None)

        router.register_agent(
            name="telegram_bot",
            channels=["telegram"],
            allowed_users=["user_1"],
        )

        resolved = router.resolve("telegram", "user_1")
        assert resolved.name == "telegram_bot"

    def test_resolve_falls_back_to_channelless_agent(self) -> None:
        config = make_config()
        router = AgentRouter(config, memory=None)

        router.register_agent(name="fallback_agent", channels=None)

        resolved = router.resolve("unknown_channel", "any_user")
        assert resolved.name == "fallback_agent"

    def test_resolve_default_when_no_match(self) -> None:
        config = make_config()
        router = AgentRouter(config, memory=None)

        resolved = router.resolve("anything", "anyone")
        assert resolved.config.llm.model == "gpt-4o"

    def test_channel_match_but_user_not_allowed_falls_back(self) -> None:
        config = make_config()
        router = AgentRouter(config, memory=None)

        router.register_agent(
            name="restricted",
            channels=["slack"],
            allowed_users=["alice"],
        )

        resolved = router.resolve("slack", "bob")
        # bob is not in allowed_users, should fall back
        assert resolved.name != "restricted"

    def test_list_agents_includes_registered(self) -> None:
        config = make_config()
        router = AgentRouter(config, memory=None)

        router.register_agent(name="alpha", channels=["irc"])
        router.register_agent(name="beta", channels=["discord"])

        agents = router.list_agents()
        names = {a["name"] for a in agents}
        assert "alpha" in names
        assert "beta" in names
        assert "main" in names

    def test_list_agents_reflects_channels(self) -> None:
        config = make_config()
        router = AgentRouter(config, memory=None)

        router.register_agent(
            name="multi_channel",
            channels=["web", "api"],
            allowed_users=["u1", "u2"],
        )

        agents = router.list_agents()
        multi = next(a for a in agents if a["name"] == "multi_channel")
        assert multi["channels"] == ["web", "api"]
        assert multi["allowed_users"] == ["u1", "u2"]

    def test_register_agent_with_custom_config(self) -> None:
        config = make_config()
        router = AgentRouter(config, memory=None)

        custom = make_config(model="gpt-3.5-turbo")
        agent = router.register_agent(name="cheap", config=custom)

        assert agent.config.llm.model == "gpt-3.5-turbo"

    def test_get_agent_returns_none_for_unknown(self) -> None:
        config = make_config()
        router = AgentRouter(config, memory=None)
        assert router.get_agent("nonexistent") is None

    def test_get_agent_returns_registered(self) -> None:
        config = make_config()
        router = AgentRouter(config, memory=None)

        router.register_agent(name="my_agent")
        assert router.get_agent("my_agent") is not None
        assert router.get_agent("my_agent").name == "my_agent"

    def test_resolve_prefers_channel_specific_over_channelless(self) -> None:
        config = make_config()
        router = AgentRouter(config, memory=None)

        router.register_agent(name="catchall", channels=None)
        router.register_agent(name="discord_spec", channels=["discord"])

        resolved = router.resolve("discord", "u")
        assert resolved.name == "discord_spec"

    def test_multiple_agents_same_channel_first_wins(self) -> None:
        config = make_config()
        router = AgentRouter(config, memory=None)

        router.register_agent(name="first", channels=["web"])
        router.register_agent(name="second", channels=["web"])

        resolved = router.resolve("web", "u")
        assert resolved.name == "first"
