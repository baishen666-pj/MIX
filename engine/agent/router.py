from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from engine.agent.loop import AgentLoop, Session
from engine.config import MixConfig
from engine.memory.store import MemoryStore
from engine.tools.registry import ToolRegistry


@dataclass
class AgentRoute:
    channel: str
    user_id: str
    agent_name: str


@dataclass
class AgentInstance:
    name: str
    loop: AgentLoop
    tools: ToolRegistry
    config: MixConfig
    channels: list[str] = field(default_factory=list)
    allowed_users: list[str] = field(default_factory=list)


class AgentRouter:
    def __init__(self, default_config: MixConfig, memory: MemoryStore) -> None:
        self._default_config = default_config
        self._memory = memory
        self._agents: dict[str, AgentInstance] = {}
        self._default_agent = self._create_agent("main", default_config)

    def _create_agent(self, name: str, config: MixConfig) -> AgentInstance:
        loop = AgentLoop(config, memory=self._memory)
        tools = ToolRegistry()
        return AgentInstance(name=name, loop=loop, tools=tools, config=config)

    def register_agent(
        self,
        name: str,
        config: MixConfig | None = None,
        channels: list[str] | None = None,
        allowed_users: list[str] | None = None,
    ) -> AgentInstance:
        agent = self._create_agent(name, config or self._default_config)
        agent.channels = channels or []
        agent.allowed_users = allowed_users or []
        self._agents[name] = agent
        return agent

    def resolve(self, channel: str, user_id: str) -> AgentInstance:
        for agent in self._agents.values():
            if agent.channels and channel in agent.channels:
                if not agent.allowed_users or user_id in agent.allowed_users:
                    return agent

        if self._agents:
            first_match = None
            for agent in self._agents.values():
                if not agent.channels:
                    first_match = agent
                    break
            if first_match:
                return first_match

        return self._default_agent

    def get_agent(self, name: str) -> AgentInstance | None:
        return self._agents.get(name)

    def list_agents(self) -> list[dict[str, Any]]:
        result = []
        for name, agent in self._agents.items():
            result.append({
                "name": name,
                "channels": agent.channels,
                "allowed_users": agent.allowed_users,
                "model": agent.config.llm.model,
            })
        result.append({
            "name": "main",
            "channels": [],
            "allowed_users": [],
            "model": self._default_agent.config.llm.model,
        })
        return result
