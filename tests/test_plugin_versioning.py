"""Tests for plugin install/uninstall/update versioning."""

from __future__ import annotations

from pathlib import Path

from engine.skills.registry import SkillManifest, SkillRegistry


def _make_skill(path: Path, name: str = "test-skill", version: str = "1.0.0") -> Path:
    skill_dir = path / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(
        f"## name\n{name}\n## version\n{version}\n## description\nA test skill\n"
        "## trigger\n- /test\n## handler\n```python\nprint('hello')\n```\n",
        encoding="utf-8",
    )
    return skill_dir


def test_install_from_local_path(tmp_path: Path) -> None:
    source = _make_skill(tmp_path / "sources", "my-plugin", "2.0.0")
    registry = SkillRegistry(skills_dir=tmp_path / "installed")

    manifest = registry.install(str(source))
    assert manifest is not None
    assert manifest.name == "my-plugin"
    assert manifest.version == "2.0.0"
    assert "my-plugin" in registry.skills


def test_install_with_pinned_version(tmp_path: Path) -> None:
    source = _make_skill(tmp_path / "sources", "pinned", "1.0.0")
    registry = SkillRegistry(skills_dir=tmp_path / "installed")

    manifest = registry.install(str(source), version="1.0.0")
    assert manifest is not None
    assert manifest.pinned_version == "1.0.0"


def test_install_nonexistent_source(tmp_path: Path) -> None:
    registry = SkillRegistry(skills_dir=tmp_path)
    result = registry.install("/nonexistent/path")
    assert result is None


def test_uninstall_removes_skill(tmp_path: Path) -> None:
    source = _make_skill(tmp_path / "sources", "removable", "1.0.0")
    registry = SkillRegistry(skills_dir=tmp_path / "installed")

    registry.install(str(source))
    assert "removable" in registry.skills

    removed = registry.uninstall("removable")
    assert removed is True
    assert "removable" not in registry.skills


def test_uninstall_nonexistent(tmp_path: Path) -> None:
    registry = SkillRegistry(skills_dir=tmp_path)
    assert registry.uninstall("nonexistent") is False


def test_update_refreshes_from_source(tmp_path: Path) -> None:
    source = _make_skill(tmp_path / "sources", "updatable", "1.0.0")
    registry = SkillRegistry(skills_dir=tmp_path / "installed")

    manifest = registry.install(str(source))
    assert manifest is not None
    assert manifest.version == "1.0.0"

    # Update source to new version
    (source / "SKILL.md").write_text(
        "## name\nupdatable\n## version\n2.0.0\n## description\nUpdated\n"
        "## trigger\n- /test\n## handler\n```python\npass\n```\n",
        encoding="utf-8",
    )

    updated = registry.update("updatable")
    assert updated is not None
    assert updated.version == "2.0.0"


def test_update_without_source_url(tmp_path: Path) -> None:
    registry = SkillRegistry(skills_dir=tmp_path)
    registry.register(SkillManifest(name="manual", version="1.0.0", description="", trigger=[], handler="python"))
    assert registry.update("manual") is None


def test_list_available_with_query(tmp_path: Path) -> None:
    source1 = _make_skill(tmp_path / "sources", "weather-tool", "1.0.0")
    source2 = _make_skill(tmp_path / "sources", "code-review", "1.0.0")
    registry = SkillRegistry(skills_dir=tmp_path / "installed")

    registry.install(str(source1))
    registry.install(str(source2))

    all_plugins = registry.list_available()
    assert len(all_plugins) == 2

    filtered = registry.list_available(query="weather")
    assert len(filtered) == 1
    assert filtered[0]["name"] == "weather-tool"


def test_slugify() -> None:
    assert SkillRegistry._slugify("https://github.com/user/my-plugin") == "my-plugin"
    assert SkillRegistry._slugify("https://github.com/user/my-plugin.git") == "my-plugin"
    assert SkillRegistry._slugify("/local/path/to/skill") == "skill"


def test_manifest_has_new_fields() -> None:
    manifest = SkillManifest(
        name="test",
        version="1.0.0",
        description="test",
        trigger=["/test"],
        handler="python",
        dependencies=["numpy"],
        source_url="https://github.com/example/plugin",
        pinned_version="1.0.0",
    )
    assert manifest.dependencies == ["numpy"]
    assert manifest.source_url == "https://github.com/example/plugin"
    assert manifest.pinned_version == "1.0.0"
