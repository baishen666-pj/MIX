from __future__ import annotations

from dataclasses import dataclass, field

PREDEFINED_ROLES: dict[str, AgentRole] = {}


@dataclass
class AgentRole:
    name: str
    system_prompt: str
    allowed_tools: list[str] | None = None
    default_model_tier: str = "standard"
    max_iterations: int = 10

    def __post_init__(self) -> None:
        if self.allowed_tools is not None:
            self.allowed_tools = list(self.allowed_tools)


def register_role(role: AgentRole) -> None:
    PREDEFINED_ROLES[role.name] = role


def get_role(name: str) -> AgentRole:
    if name not in PREDEFINED_ROLES:
        raise KeyError(f"Unknown role: {name}")
    return PREDEFINED_ROLES[name]


def list_roles() -> list[AgentRole]:
    return list(PREDEFINED_ROLES.values())


register_role(AgentRole(
    name="coordinator",
    system_prompt=(
        "You are a coordinator agent. Your job is to analyze tasks, "
        "break them into subtasks, and delegate to specialized agents. "
        "Synthesize results from other agents into coherent final answers."
    ),
    allowed_tools=None,
    default_model_tier="heavy",
    max_iterations=5,
))

register_role(AgentRole(
    name="researcher",
    system_prompt=(
        "You are a research agent. Your job is to search for information, "
        "analyze documents, and provide thorough, well-sourced answers. "
        "Use available tools to gather data and verify facts."
    ),
    allowed_tools=["web_search", "web_fetch", "file_read", "file_list", "grep", "glob"],
    default_model_tier="standard",
    max_iterations=10,
))

register_role(AgentRole(
    name="coder",
    system_prompt=(
        "You are a coding agent. Your job is to write, debug, and review code. "
        "Use file tools to read and write code, bash to test, and produce "
        "clean, well-structured implementations."
    ),
    allowed_tools=["bash", "file_read", "file_write", "file_edit", "file_edit_lines", "file_list", "grep", "glob"],
    default_model_tier="heavy",
    max_iterations=15,
))

register_role(AgentRole(
    name="reviewer",
    system_prompt=(
        "You are a review agent. Your job is to critically evaluate work, "
        "identify issues, suggest improvements, and ensure quality. "
        "Be thorough but constructive in your feedback."
    ),
    allowed_tools=["file_read", "file_list", "grep", "glob"],
    default_model_tier="standard",
    max_iterations=5,
))

register_role(AgentRole(
    name="general",
    system_prompt="You are a helpful AI assistant.",
    allowed_tools=None,
    default_model_tier="standard",
    max_iterations=10,
))
