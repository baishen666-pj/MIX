"""Tests for engine.skills.loader -- SkillLoader edge cases.

Core SkillLoader tests exist in test_skills.py. This file covers
additional edge cases: unsupported handler types, exceptions during
execution, and the registry _parse_skill_md parsing edge cases.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from engine.skills.loader import SkillLoader
from engine.skills.registry import SkillManifest, SkillRegistry


class TestSkillLoaderUnsupportedHandler:
    @pytest.mark.asyncio
    async def test_unsupported_handler_returns_error(self) -> None:
        # Arrange
        manifest = SkillManifest(
            name="bad",
            version="0.1.0",
            description="unsupported",
            trigger=["/bad"],
            handler="ruby",
            handler_code="puts 'hi'",
        )
        loader = SkillLoader()

        # Act
        result = await loader.execute(manifest)

        # Assert
        assert "error" in result
        assert "Unsupported handler type" in result["error"]
        assert "ruby" in result["error"]


class TestSkillLoaderExceptionHandling:
    @pytest.mark.asyncio
    async def test_exception_during_execution_returns_error(self) -> None:
        # Arrange
        manifest = SkillManifest(
            name="boom",
            version="0.1.0",
            description="will crash",
            trigger=["/boom"],
            handler="python",
            handler_code="raise RuntimeError('kaboom')",
        )
        loader = SkillLoader()

        # Act
        result = await loader.execute(manifest)

        # Assert -- the subprocess should fail and return an error
        assert "error" in result


class TestSkillLoaderEmptyCode:
    @pytest.mark.asyncio
    async def test_empty_handler_code_returns_error(self) -> None:
        # Arrange
        manifest = SkillManifest(
            name="empty",
            version="0.1.0",
            description="no code",
            trigger=["/empty"],
            handler="python",
            handler_code="",
        )
        loader = SkillLoader()

        # Act
        result = await loader.execute(manifest)

        # Assert
        assert "error" in result
        assert "No handler code" in result["error"]


class TestSkillLoaderNoArgsDefault:
    @pytest.mark.asyncio
    async def test_execute_with_no_args_uses_empty_dict(self) -> None:
        # Arrange
        manifest = SkillManifest(
            name="noargs",
            version="0.1.0",
            description="no args",
            trigger=["/noargs"],
            handler="python",
            handler_code="def run(args):\n    return {'received': type(args).__name__}",
        )
        loader = SkillLoader()

        # Act
        result = await loader.execute(manifest)

        # Assert
        assert result.get("received") == "dict"


class TestSkillRegistryParseEdgeCases:
    def test_parse_skill_md_with_defaults(self, tmp_path: Path) -> None:
        # Arrange -- minimal SKILL.md with no explicit name/version/description
        skill_dir = tmp_path / "my_custom_skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("# Minimal\n\n## Trigger\n\n- /custom\n")

        # Act
        registry = SkillRegistry(skills_dir=tmp_path)
        count = registry.load_all()

        # Assert
        assert count == 1
        skill = registry.get("my_custom_skill")
        assert skill is not None
        assert skill.version == "0.1.0"  # default
        assert skill.description == ""  # default
        assert skill.trigger == ["/custom"]

    def test_parse_skill_md_with_shell_handler(self, tmp_path: Path) -> None:
        # Arrange
        skill_dir = tmp_path / "shell_skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            "# Shell Skill\n\n## name\nshelly\n\n## version\n2.0.0\n\n"
            "## description\nA shell skill\n\n## Trigger\n\n- /shelly\n\n"
            "## Handler\n\n```shell\necho hello\n```\n"
        )

        # Act
        registry = SkillRegistry(skills_dir=tmp_path)
        registry.load_all()

        # Assert
        skill = registry.get("shelly")
        assert skill is not None
        assert skill.handler == "shell"
        assert skill.handler_code == "echo hello"

    def test_parse_skill_md_no_skill_md_files(self, tmp_path: Path) -> None:
        # Arrange -- directory with no SKILL.md
        sub = tmp_path / "empty_sub"
        sub.mkdir()

        # Act
        registry = SkillRegistry(skills_dir=tmp_path)
        count = registry.load_all()

        # Assert
        assert count == 0

    def test_nonexistent_skills_dir(self, tmp_path: Path) -> None:
        # Arrange
        missing = tmp_path / "does_not_exist"

        # Act
        registry = SkillRegistry(skills_dir=missing)
        count = registry.load_all()

        # Assert
        assert count == 0
        assert registry.list_skills() == []

    def test_register_and_unregister(self) -> None:
        # Arrange
        registry = SkillRegistry()
        manifest = SkillManifest(
            name="temp",
            version="0.1.0",
            description="temp",
            trigger=["/temp"],
            handler="python",
        )

        # Act
        registry.register(manifest)
        assert registry.get("temp") is manifest

        removed = registry.unregister("temp")

        # Assert
        assert removed is True
        assert registry.get("temp") is None

    def test_unregister_nonexistent(self) -> None:
        # Arrange
        registry = SkillRegistry()

        # Act
        result = registry.unregister("ghost")

        # Assert
        assert result is False

    def test_match_is_case_insensitive(self, tmp_path: Path) -> None:
        # Arrange
        skill_dir = tmp_path / "ci_skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            "# CI\n\n## name\nci\n\n## version\n1.0\n\n## description\nci skill\n\n## Trigger\n\n- /HelloWorld\n"
        )
        registry = SkillRegistry(skills_dir=tmp_path)
        registry.load_all()

        # Act
        matched = registry.match("/helloworld")

        # Assert
        assert matched is not None
        assert matched.name == "ci"

    def test_match_returns_none_on_no_match(self) -> None:
        # Arrange
        registry = SkillRegistry()

        # Act
        result = registry.match("nothing matches this")

        # Assert
        assert result is None
