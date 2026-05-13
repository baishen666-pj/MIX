from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from engine.agent.loop import AgentLoop
from engine.agent.roles import get_role, AgentRole
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
    role: str = "general"
    system_prompt: str = ""


class AgentRouter:
    def __init__(self, default_config: MixConfig, memory: MemoryStore) -> None:
        self._default_config = default_config
        self._memory = memory
        self._agents: dict[str, AgentInstance] = {}
        self._default_agent = self._create_agent("main", default_config)

    def _create_agent(
        self,
        name: str,
        config: MixConfig,
        role_name: str = "general",
        system_prompt_override: str | None = None,
    ) -> AgentInstance:
        try:
            role = get_role(role_name)
        except KeyError:
            role = get_role("general")

        loop = AgentLoop(config, memory=self._memory)
        tools = ToolRegistry()

        if role.allowed_tools is not None:
            for tool_name in list(tools.list_tools()):
                if tool_name not in role.allowed_tools:
                    tools.unregister_tool(tool_name)

        prompt = system_prompt_override or role.system_prompt
        return AgentInstance(
            name=name,
            loop=loop,
            tools=tools,
            config=config,
            role=role_name,
            system_prompt=prompt,
        )

    def register_agent(
        self,
        name: str,
        config: MixConfig | None = None,
        channels: list[str] | None = None,
        allowed_users: list[str] | None = None,
        role: str = "general",
        system_prompt_override: str | None = None,
    ) -> AgentInstance:
        agent = self._create_agent(
            name,
            config or self._default_config,
            role_name=role,
            system_prompt_override=system_prompt_override,
        )
        agent.channels = channels or []
        agent.allowed_users = allowed_users or []
        self._agents[name] = agent
        return agent

    def update_agent(self, name: str, **kwargs: Any) -> bool:
        agent = self._agents.get(name)
        if agent is None:
            return False
        if "channels" in kwargs:
            agent.channels = kwargs["channels"]
        if "allowed_users" in kwargs:
            agent.allowed_users = kwargs["allowed_users"]
        if "system_prompt" in kwargs:
            agent.system_prompt = kwargs["system_prompt"]
        if "role" in kwargs:
            agent.role = kwargs["role"]
        return True

    def delete_agent(self, name: str) -> bool:
        if name in self._agents:
            del self._agents[name]
            return True
        return False

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
                "role": agent.role,
                "channels": agent.channels,
                "allowed_users": agent.allowed_users,
                "model": agent.config.llm.model,
                "system_prompt": agent.system_prompt[:200] if agent.system_prompt else "",
            })
        result.append({
            "name": "main",
            "role": self._default_agent.role,
            "channels": [],
            "allowed_users": [],
            "model": self._default_agent.config.llm.model,
            "system_prompt": self._default_agent.system_prompt[:200] if self._default_agent.system_prompt else "",
        })
        return result
