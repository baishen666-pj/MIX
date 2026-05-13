from __future__ import annotations

import pytest

from engine.agent.roles import (
    PREDEFINED_ROLES,
    AgentRole,
    get_role,
    list_roles,
    register_role,
)


def test_predefined_roles_exist():
    assert "coordinator" in PREDEFINED_ROLES
    assert "researcher" in PREDEFINED_ROLES
    assert "coder" in PREDEFINED_ROLES
    assert "reviewer" in PREDEFINED_ROLES
    assert "general" in PREDEFINED_ROLES


def test_get_role():
    role = get_role("coordinator")
    assert role.name == "coordinator"
    assert "coordinator" in role.system_prompt.lower()
    assert role.default_model_tier == "heavy"


def test_get_role_unknown():
    with pytest.raises(KeyError, match="Unknown role"):
        get_role("nonexistent")


def test_list_roles():
    roles = list_roles()
    assert len(roles) >= 5
    names = {r.name for r in roles}
    assert "coordinator" in names
    assert "general" in names


def test_register_custom_role():
    custom = AgentRole(
        name="custom_test",
        system_prompt="Custom agent",
        allowed_tools=["bash"],
        default_model_tier="light",
        max_iterations=3,
    )
    register_role(custom)
    assert get_role("custom_test").system_prompt == "Custom agent"
    assert get_role("custom_test").allowed_tools == ["bash"]


def test_researcher_has_limited_tools():
    role = get_role("researcher")
    assert role.allowed_tools is not None
    assert "web_search" in role.allowed_tools
    assert "bash" not in role.allowed_tools


def test_coder_has_coding_tools():
    role = get_role("coder")
    assert role.allowed_tools is not None
    assert "bash" in role.allowed_tools
    assert "file_write" in role.allowed_tools


def test_general_has_all_tools():
    role = get_role("general")
    assert role.allowed_tools is None
