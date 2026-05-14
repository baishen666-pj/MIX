"""Additional coverage tests for engine.skills.registry.

Targets uncovered lines:
- 97, 101: handler_type for typescript and unknown languages
- 133-135: _clone_github failure path
- 163-165: update from GitHub (clone failure path)
- 169: update from invalid source
- 194-205: _clone_github with subprocess errors
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from unittest.mock import patch

from engine.skills.registry import SkillManifest, SkillRegistry


def _make_skill_md(
    name: str = "test-skill",
    version: str = "1.0.0",
    description: str = "A test skill",
    triggers: str = "- /test",
    handler_lang: str = "python",
    handler_code: str = "def run(args): pass",
) -> str:
    return (
        f"# {name}\n\n"
        f"## name\n{name}\n\n"
        f"## version\n{version}\n\n"
        f"## description\n{description}\n\n"
        f"## trigger\n{triggers}\n\n"
        f"## Handler\n\n```{handler_lang}\n{handler_code}\n```\n"
    )


class TestHandlerTypeDetection:
    """Cover lines 97 and 101: typescript and unknown language detection."""

    def test_typescript_handler(self, tmp_path: Path) -> None:
        skill_dir = tmp_path / "ts-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            _make_skill_md(handler_lang="typescript", handler_code="export function run() {}"),
            encoding="utf-8",
        )
        registry = SkillRegistry(skills_dir=tmp_path)
        count = registry.load_all()
        assert count == 1
        skill = registry.get("test-skill")
        assert skill is not None
        assert skill.handler == "typescript"

    def test_javascript_handler(self, tmp_path: Path) -> None:
        skill_dir = tmp_path / "js-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            _make_skill_md(handler_lang="javascript", handler_code="function run() {}"),
            encoding="utf-8",
        )
        registry = SkillRegistry(skills_dir=tmp_path)
        registry.load_all()
        skill = registry.get("test-skill")
        assert skill is not None
        assert skill.handler == "typescript"

    def test_ts_handler(self, tmp_path: Path) -> None:
        skill_dir = tmp_path / "ts2-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            _make_skill_md(handler_lang="ts", handler_code="function run() {}"),
            encoding="utf-8",
        )
        registry = SkillRegistry(skills_dir=tmp_path)
        registry.load_all()
        skill = registry.get("test-skill")
        assert skill is not None
        assert skill.handler == "typescript"

    def test_js_handler(self, tmp_path: Path) -> None:
        skill_dir = tmp_path / "js2-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            _make_skill_md(handler_lang="js", handler_code="function run() {}"),
            encoding="utf-8",
        )
        registry = SkillRegistry(skills_dir=tmp_path)
        registry.load_all()
        skill = registry.get("test-skill")
        assert skill is not None
        assert skill.handler == "typescript"

    def test_shell_handler(self, tmp_path: Path) -> None:
        skill_dir = tmp_path / "shell-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            _make_skill_md(handler_lang="shell", handler_code="echo hello"),
            encoding="utf-8",
        )
        registry = SkillRegistry(skills_dir=tmp_path)
        registry.load_all()
        skill = registry.get("test-skill")
        assert skill is not None
        assert skill.handler == "shell"

    def test_unknown_handler_type(self, tmp_path: Path) -> None:
        """Cover line 101: unknown language defaults to the language string."""
        skill_dir = tmp_path / "ruby-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            _make_skill_md(handler_lang="ruby", handler_code="def run; end"),
            encoding="utf-8",
        )
        registry = SkillRegistry(skills_dir=tmp_path)
        registry.load_all()
        skill = registry.get("test-skill")
        assert skill is not None
        assert skill.handler == "ruby"


class TestInstallFromGitHub:
    """Cover lines 133-135 and 194-205: GitHub clone paths."""

    def test_install_github_clone_failure(self, tmp_path: Path) -> None:
        registry = SkillRegistry(skills_dir=tmp_path)
        with patch.object(registry, "_clone_github", return_value=False):
            result = registry.install("https://github.com/fake/repo")
        assert result is None

    def test_install_github_success(self, tmp_path: Path) -> None:
        registry = SkillRegistry(skills_dir=tmp_path)
        target = tmp_path / "repo"
        target.mkdir()
        (target / "SKILL.md").write_text(
            _make_skill_md(name="gh-skill"), encoding="utf-8"
        )

        with patch.object(registry, "_clone_github", return_value=True):
            # Patch _parse_skill_md to read from the cloned dir
            result = registry.install("https://github.com/fake/repo")
        assert result is not None
        assert result.name == "gh-skill"
        assert result.source_url == "https://github.com/fake/repo"

    def test_install_invalid_source(self, tmp_path: Path) -> None:
        registry = SkillRegistry(skills_dir=tmp_path)
        result = registry.install("/nonexistent/local/path")
        assert result is None

    def test_install_local_success(self, tmp_path: Path) -> None:
        local_skill = tmp_path / "local_source"
        local_skill.mkdir()
        (local_skill / "SKILL.md").write_text(
            _make_skill_md(name="local-skill"), encoding="utf-8"
        )

        skills_dir = tmp_path / "installed"
        skills_dir.mkdir()
        registry = SkillRegistry(skills_dir=skills_dir)

        result = registry.install(str(local_skill))
        assert result is not None
        assert result.name == "local-skill"


class TestCloneGitHubErrors:
    """Cover lines 194-205: _clone_github error paths.

    subprocess is imported locally inside _clone_github, so we patch
    subprocess.run at the stdlib level.
    """

    def test_clone_called_process_error(self, tmp_path: Path) -> None:
        registry = SkillRegistry(skills_dir=tmp_path)
        with patch("subprocess.run", side_effect=subprocess.CalledProcessError(1, "git")):
            assert registry._clone_github("https://github.com/x/y", tmp_path / "out") is False

    def test_clone_timeout_expired(self, tmp_path: Path) -> None:
        registry = SkillRegistry(skills_dir=tmp_path)
        with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="git", timeout=60)):
            assert registry._clone_github("https://github.com/x/y", tmp_path / "out") is False

    def test_clone_file_not_found(self, tmp_path: Path) -> None:
        """Git not installed on system."""
        registry = SkillRegistry(skills_dir=tmp_path)
        with patch("subprocess.run", side_effect=FileNotFoundError("no git")):
            assert registry._clone_github("https://github.com/x/y", tmp_path / "out") is False

    def test_clone_success(self, tmp_path: Path) -> None:
        registry = SkillRegistry(skills_dir=tmp_path)
        with patch("subprocess.run"):
            assert registry._clone_github("https://github.com/x/y", tmp_path / "out") is True


class TestUninstallSkill:
    """Cover uninstall with valid and missing skills."""

    def test_uninstall_existing_skill(self, tmp_path: Path) -> None:
        skill_dir = tmp_path / "removable"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(_make_skill_md(name="rem-skill"), encoding="utf-8")

        registry = SkillRegistry(skills_dir=tmp_path)
        registry.load_all()
        assert registry.get("rem-skill") is not None

        result = registry.uninstall("rem-skill")
        assert result is True
        assert registry.get("rem-skill") is None

    def test_uninstall_nonexistent_skill(self, tmp_path: Path) -> None:
        registry = SkillRegistry(skills_dir=tmp_path)
        result = registry.uninstall("no-such-skill")
        assert result is False


class TestUpdateSkill:
    """Cover lines 163-165 and 169: update from GitHub and invalid source."""

    def test_update_github_clone_failure(self, tmp_path: Path) -> None:
        registry = SkillRegistry(skills_dir=tmp_path)
        skill = SkillManifest(
            name="updatable",
            version="1.0.0",
            description="test",
            trigger=["/update"],
            handler="python",
            source_url="https://github.com/fake/repo",
            skill_path=str(tmp_path / "updatable"),
        )
        registry.register(skill)

        with patch.object(registry, "_clone_github", return_value=False):
            result = registry.update("updatable")
        assert result is None

    def test_update_invalid_source(self, tmp_path: Path) -> None:
        registry = SkillRegistry(skills_dir=tmp_path)
        skill = SkillManifest(
            name="bad-source",
            version="1.0.0",
            description="test",
            trigger=["/bad"],
            handler="python",
            source_url="/nonexistent/local/path",
            skill_path=str(tmp_path / "bad"),
        )
        registry.register(skill)

        result = registry.update("bad-source")
        assert result is None

    def test_update_nonexistent_skill(self, tmp_path: Path) -> None:
        registry = SkillRegistry(skills_dir=tmp_path)
        result = registry.update("ghost")
        assert result is None

    def test_update_skill_with_no_source_url(self, tmp_path: Path) -> None:
        registry = SkillRegistry(skills_dir=tmp_path)
        skill = SkillManifest(
            name="no-source",
            version="1.0.0",
            description="test",
            trigger=["/nosource"],
            handler="python",
            source_url="",
            skill_path=str(tmp_path / "no-source"),
        )
        registry.register(skill)
        result = registry.update("no-source")
        assert result is None

    def test_update_github_success(self, tmp_path: Path) -> None:
        skill_dir = tmp_path / "update-me"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            _make_skill_md(name="update-skill", version="2.0.0"), encoding="utf-8"
        )

        registry = SkillRegistry(skills_dir=tmp_path)
        skill = SkillManifest(
            name="update-skill",
            version="1.0.0",
            description="old",
            trigger=["/update"],
            handler="python",
            source_url="https://github.com/fake/repo",
            skill_path=str(skill_dir),
            pinned_version="1.0.0",
        )
        registry.register(skill)

        def _fake_clone(url: str, target: Path) -> bool:
            # Simulate clone by ensuring SKILL.md exists at target
            target.mkdir(parents=True, exist_ok=True)
            (target / "SKILL.md").write_text(
                _make_skill_md(name="update-skill", version="2.0.0"), encoding="utf-8"
            )
            return True

        with patch.object(registry, "_clone_github", side_effect=_fake_clone):
            result = registry.update("update-skill")
        assert result is not None
        assert result.version == "2.0.0"
        assert result.source_url == "https://github.com/fake/repo"

    def test_update_local_source_success(self, tmp_path: Path) -> None:
        local_source = tmp_path / "local_src"
        local_source.mkdir()
        (local_source / "SKILL.md").write_text(
            _make_skill_md(name="local-update", version="3.0.0"), encoding="utf-8"
        )

        target = tmp_path / "installed"
        target.mkdir()

        registry = SkillRegistry(skills_dir=tmp_path)
        skill = SkillManifest(
            name="local-update",
            version="1.0.0",
            description="old",
            trigger=["/localup"],
            handler="python",
            source_url=str(local_source),
            skill_path=str(target),
            pinned_version="1.0.0",
        )
        registry.register(skill)

        result = registry.update("local-update")
        assert result is not None
        assert result.version == "3.0.0"


class TestListAvailable:
    """Cover list_available with query filtering."""

    def test_list_available_with_query(self, tmp_path: Path) -> None:
        registry = SkillRegistry(skills_dir=tmp_path)
        registry.register(SkillManifest(
            name="search-skill", version="1.0.0", description="a searchable skill",
            trigger=["/search"], handler="python", source_url="https://example.com",
        ))
        registry.register(SkillManifest(
            name="other-skill", version="1.0.0", description="unrelated",
            trigger=["/other"], handler="python", source_url="",
        ))

        results = registry.list_available(query="search")
        assert len(results) == 1
        assert results[0]["name"] == "search-skill"

    def test_list_available_no_query(self, tmp_path: Path) -> None:
        registry = SkillRegistry(skills_dir=tmp_path)
        registry.register(SkillManifest(
            name="a", version="1.0.0", description="x",
            trigger=["/a"], handler="python",
        ))
        registry.register(SkillManifest(
            name="b", version="1.0.0", description="y",
            trigger=["/b"], handler="python",
        ))

        results = registry.list_available()
        assert len(results) == 2
