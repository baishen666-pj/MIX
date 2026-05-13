from pathlib import Path

import pytest

from engine.skills.loader import SkillLoader
from engine.skills.registry import SkillManifest, SkillRegistry


@pytest.fixture
def skills_dir(tmp_path: Path) -> Path:
    skill_dir = tmp_path / "hello"
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text(
        "# Hello Skill\n\n## name\ngreeting\n\n## version\n1.0.0\n\n"
        "## description\nSays hello\n\n## Trigger\n\n- /hello\n- hi there\n\n"
        "## Handler\n\n```python\n"
        "async def run(args):\n"
        "    return {'msg': f\"Hello {args.get('name', 'world')}!\"}\n"
        "```\n"
    )
    return tmp_path


def test_load_skills(skills_dir: Path) -> None:
    registry = SkillRegistry(skills_dir=skills_dir)
    count = registry.load_all()
    assert count == 1

    skill = registry.get("greeting")
    assert skill is not None
    assert skill.version == "1.0.0"
    assert skill.description == "Says hello"
    assert len(skill.trigger) == 2


def test_match_skill(skills_dir: Path) -> None:
    registry = SkillRegistry(skills_dir=skills_dir)
    registry.load_all()

    matched = registry.match("/hello")
    assert matched is not None
    assert matched.name == "greeting"

    matched2 = registry.match("hi there")
    assert matched2 is not None

    no_match = registry.match("goodbye")
    assert no_match is None


def test_list_skills(skills_dir: Path) -> None:
    registry = SkillRegistry(skills_dir=skills_dir)
    registry.load_all()

    skills = registry.list_skills()
    assert len(skills) == 1
    assert skills[0]["name"] == "greeting"


def test_empty_dir(tmp_path: Path) -> None:
    registry = SkillRegistry(skills_dir=tmp_path)
    count = registry.load_all()
    assert count == 0
    assert registry.list_skills() == []


@pytest.mark.asyncio
async def test_execute_python_skill() -> None:
    manifest = SkillManifest(
        name="adder",
        version="0.1.0",
        description="adds numbers",
        trigger=["/add"],
        handler="python",
        handler_code="def run(args):\n    return {'sum': args.get('a', 0) + args.get('b', 0)}",
    )
    loader = SkillLoader()
    result = await loader.execute(manifest, args={"a": 3, "b": 5})
    assert result == {"sum": 8}


@pytest.mark.asyncio
async def test_execute_async_python_skill() -> None:
    manifest = SkillManifest(
        name="async_adder",
        version="0.1.0",
        description="adds numbers async",
        trigger=["/asyncadd"],
        handler="python",
        handler_code="async def run(args):\n    return {'sum': args.get('a', 0) + args.get('b', 0)}",
    )
    loader = SkillLoader()
    result = await loader.execute(manifest, args={"a": 10, "b": 20})
    assert result == {"sum": 30}


@pytest.mark.asyncio
async def test_execute_no_handler() -> None:
    manifest = SkillManifest(
        name="empty",
        version="0.1.0",
        description="no code",
        trigger=["/empty"],
        handler="python",
        handler_code="",
    )
    loader = SkillLoader()
    result = await loader.execute(manifest)
    assert "error" in result


@pytest.mark.asyncio
async def test_execute_shell_skill() -> None:
    manifest = SkillManifest(
        name="echo",
        version="0.1.0",
        description="echo",
        trigger=["/echo"],
        handler="shell",
        handler_code="echo hello from shell",
    )
    loader = SkillLoader()
    result = await loader.execute(manifest)
    assert "hello from shell" in result["output"]
