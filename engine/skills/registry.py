from __future__ import annotations

import json
import re
import shutil
import tempfile
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class SkillManifest:
    name: str
    version: str
    description: str
    trigger: list[str]
    handler: str  # "python" | "typescript" | "shell"
    parameters: list[dict] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    auto_evolve: bool = True
    skill_path: str = ""
    handler_code: str = ""
    hooks: list[str] = field(default_factory=list)
    permissions: list[str] = field(default_factory=list)
    custom_routes: list[dict] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    source_url: str = ""
    pinned_version: str = ""


class SkillRegistry:
    def __init__(self, skills_dir: Path | None = None) -> None:
        self.skills: dict[str, SkillManifest] = {}
        self._skills_dir = skills_dir or Path.home() / ".mix" / "skills"

    def load_all(self) -> int:
        if not self._skills_dir.exists():
            return 0
        count = 0
        for skill_dir in self._skills_dir.rglob("SKILL.md"):
            manifest = self._parse_skill_md(skill_dir)
            if manifest:
                self.skills[manifest.name] = manifest
                count += 1
        return count

    def match(self, text: str) -> SkillManifest | None:
        text_lower = text.lower().strip()
        for skill in self.skills.values():
            for pattern in skill.trigger:
                if text_lower.startswith(pattern.lower()):
                    return skill
        return None

    def get(self, name: str) -> SkillManifest | None:
        return self.skills.get(name)

    def register(self, manifest: SkillManifest) -> None:
        self.skills[manifest.name] = manifest

    def unregister(self, name: str) -> bool:
        if name in self.skills:
            del self.skills[name]
            return True
        return False

    def list_skills(self) -> list[dict]:
        return [
            {
                "name": s.name,
                "version": s.version,
                "description": s.description,
                "trigger": s.trigger,
                "handler": s.handler,
                "tags": s.tags,
            }
            for s in self.skills.values()
        ]

    def _parse_skill_md(self, path: Path) -> SkillManifest | None:
        content = path.read_text(encoding="utf-8")
        skill_dir = path.parent

        name = self._extract_section(content, "name") or skill_dir.name
        version = self._extract_section(content, "version") or "0.1.0"
        description = self._extract_section(content, "description") or ""
        triggers_raw = self._extract_section(content, "trigger") or ""
        triggers = [t.strip().lstrip("- ") for t in triggers_raw.split("\n") if t.strip().startswith("-")]
        handler_type = "python"
        handler_code = ""

        handler_match = re.search(r"```(\w+)\n(.*?)```", content, re.DOTALL)
        if handler_match:
            lang = handler_match.group(1).lower()
            handler_code = handler_match.group(2).strip()
            if lang in ("python", "py"):
                handler_type = "python"
            elif lang in ("typescript", "ts", "javascript", "js"):
                handler_type = "typescript"
            elif lang == "shell":
                handler_type = "shell"
            else:
                handler_type = lang

        hooks_raw = self._extract_section(content, "hooks") or ""
        hooks = [h.strip().lstrip("- ") for h in hooks_raw.split("\n") if h.strip().startswith("-")]

        perms_raw = self._extract_section(content, "permissions") or ""
        permissions = [p.strip().lstrip("- ") for p in perms_raw.split("\n") if p.strip().startswith("-")]

        return SkillManifest(
            name=name,
            version=version,
            description=description,
            trigger=triggers,
            handler=handler_type,
            handler_code=handler_code,
            skill_path=str(skill_dir),
            hooks=hooks,
            permissions=permissions,
        )

    def _extract_section(self, content: str, heading: str) -> str | None:
        pattern = rf"##\s+{heading}\s*\n(.*?)(?=\n##\s|\Z)"
        match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
        return match.group(1).strip() if match else None

    # --- Plugin install/uninstall/update ---

    def install(self, source: str, version: str | None = None) -> SkillManifest | None:
        """Install a skill from a local path or GitHub URL."""
        target_dir = self._skills_dir / self._slugify(source)

        if source.startswith("https://github.com/"):
            cloned = self._clone_github(source, target_dir)
            if not cloned:
                return None
        elif Path(source).exists():
            self._install_local(Path(source), target_dir)
        else:
            return None

        manifest = self._parse_skill_md(target_dir / "SKILL.md")
        if manifest:
            manifest.source_url = source
            manifest.pinned_version = version or manifest.version
            self.skills[manifest.name] = manifest
        return manifest

    def uninstall(self, name: str) -> bool:
        skill = self.skills.get(name)
        if skill is None:
            return False
        if skill.skill_path and Path(skill.skill_path).exists():
            shutil.rmtree(Path(skill.skill_path), ignore_errors=True)
        del self.skills[name]
        return True

    def update(self, name: str) -> SkillManifest | None:
        skill = self.skills.get(name)
        if skill is None or not skill.source_url:
            return None
        target_dir = Path(skill.skill_path) if skill.skill_path else self._skills_dir / self._slugify(skill.name)
        if skill.source_url.startswith("https://github.com/"):
            shutil.rmtree(target_dir, ignore_errors=True)
            if not self._clone_github(skill.source_url, target_dir):
                return None
        elif Path(skill.source_url).exists():
            self._install_local(Path(skill.source_url), target_dir)
        else:
            return None
        manifest = self._parse_skill_md(target_dir / "SKILL.md")
        if manifest:
            manifest.source_url = skill.source_url
            manifest.pinned_version = skill.pinned_version
            self.skills[manifest.name] = manifest
        return manifest

    def list_available(self, query: str = "") -> list[dict]:
        """List installed plugins with source info."""
        results = []
        for s in self.skills.values():
            info = {
                "name": s.name,
                "version": s.version,
                "description": s.description,
                "source_url": s.source_url,
                "pinned_version": s.pinned_version,
                "dependencies": s.dependencies,
            }
            if not query or query.lower() in s.name.lower() or query.lower() in s.description.lower():
                results.append(info)
        return results

    def _clone_github(self, url: str, target: Path) -> bool:
        import subprocess
        try:
            subprocess.run(
                ["git", "clone", "--depth", "1", url, str(target)],
                capture_output=True, timeout=60, check=True,
            )
            return True
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            return False

    def _install_local(self, source: Path, target: Path) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(source, target)

    @staticmethod
    def _slugify(source: str) -> str:
        name = Path(source).name
        return name.replace(".git", "")
