from pathlib import Path

import pytest

from engine.skills.plugin_context import PluginContext
from engine.skills.registry import SkillManifest, SkillRegistry


def test_skill_manifest_hooks_and_permissions():
    manifest = SkillManifest(
        name="test-skill",
        version="1.0.0",
        description="Test",
        trigger=["/test"],
        handler="python",
        hooks=["on_load", "before_chat"],
        permissions=["read", "execute"],
    )
    assert manifest.hooks == ["on_load", "before_chat"]
    assert manifest.permissions == ["read", "execute"]


def test_registry_register_and_unregister():
    registry = SkillRegistry(skills_dir=Path("/tmp/nonexistent"))
    manifest = SkillManifest(
        name="dynamic-skill",
        version="0.1.0",
        description="Dynamic",
        trigger=["/dynamic"],
        handler="python",
    )
    registry.register(manifest)
    assert registry.get("dynamic-skill") is not None

    removed = registry.unregister("dynamic-skill")
    assert removed is True
    assert registry.get("dynamic-skill") is None


def test_unregister_nonexistent():
    registry = SkillRegistry(skills_dir=Path("/tmp/nonexistent"))
    assert registry.unregister("nothing") is False


@pytest.mark.asyncio
async def test_plugin_context_hooks():
    ctx = PluginContext()
    called = []

    async def on_load_cb():
        called.append("on_load")

    async def before_chat_cb(msg):
        called.append(f"before_chat:{msg}")

    ctx.on("on_load", on_load_cb)
    ctx.on("before_chat", before_chat_cb)

    assert ctx.has_hooks("on_load")
    assert not ctx.has_hooks("after_chat")

    await ctx.emit("on_load")
    await ctx.emit("before_chat", "hello")

    assert called == ["on_load", "before_chat:hello"]


@pytest.mark.asyncio
async def test_plugin_context_clear():
    ctx = PluginContext()

    async def dummy():
        pass

    ctx.on("on_load", dummy)
    ctx.clear()
    assert not ctx.has_hooks("on_load")


def test_parse_skill_md_with_hooks(tmp_path: Path):
    skill_dir = tmp_path / "hook-skill"
    skill_dir.mkdir()
    skill_md = skill_dir / "SKILL.md"
    skill_md.write_text("""# Hook Skill

## name
hook-skill

## version
1.0.0

## description
A skill with hooks

## trigger
- /hook

## hooks
- on_load
- before_chat

## permissions
- read
- execute

## Handler

```python
async def run(args):
    return {"result": "ok"}
```
""")

    registry = SkillRegistry(skills_dir=tmp_path)
    count = registry.load_all()
    assert count == 1

    skill = registry.get("hook-skill")
    assert skill is not None
    assert "on_load" in skill.hooks
    assert "before_chat" in skill.hooks
    assert "read" in skill.permissions
    assert "execute" in skill.permissions
