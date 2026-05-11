from __future__ import annotations

import json
import re
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

        return SkillManifest(
            name=name,
            version=version,
            description=description,
            trigger=triggers,
            handler=handler_type,
            handler_code=handler_code,
            skill_path=str(skill_dir),
        )

    def _extract_section(self, content: str, heading: str) -> str | None:
        pattern = rf"##\s+{heading}\s*\n(.*?)(?=\n##\s|\Z)"
        match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
        return match.group(1).strip() if match else None
