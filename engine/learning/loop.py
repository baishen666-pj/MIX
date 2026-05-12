from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from engine.memory.store import MemoryStore
from engine.memory.types import MemoryEntry, MemoryType
from engine.skills.registry import SkillRegistry, SkillManifest


@dataclass
class LearningInsight:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    pattern: str = ""
    suggested_skill_name: str = ""
    suggested_trigger: list[str] = field(default_factory=list)
    suggested_code: str = ""
    confidence: float = 0.0
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class LearningLoop:
    def __init__(self, memory: MemoryStore, skills: SkillRegistry) -> None:
        self.memory = memory
        self.skills = skills
        self._interaction_count = 0
        self._pending_insights: list[LearningInsight] = []
        self.nudge_interval = 10  # nudge every N interactions

    async def record_interaction(self, role: str, content: str, session_id: str | None = None) -> None:
        self._interaction_count += 1

        entry = MemoryEntry(
            type=MemoryType.CONTEXT,
            content=f"[{role}] {content}",
            source="learning_loop",
            session_id=session_id or "",
        )
        await self.memory.store(entry)

        if self._interaction_count % self.nudge_interval == 0:
            await self._nudge()

    async def _nudge(self) -> None:
        recent = await self.memory.get_recent(limit=5)
        if len(recent) < 3:
            return

        patterns = self._detect_patterns(recent)
        for pattern in patterns:
            insight = LearningInsight(
                pattern=pattern["description"],
                suggested_skill_name=pattern["skill_name"],
                suggested_trigger=pattern["triggers"],
                suggested_code=pattern.get("code", ""),
                confidence=pattern["confidence"],
            )
            self._pending_insights = [*self._pending_insights, insight]

    def _detect_patterns(self, entries: list[MemoryEntry]) -> list[dict]:
        patterns: list[dict] = []
        user_messages = [e for e in entries if "[user]" in e.content]

        command_freq: dict[str, int] = {}
        for msg in user_messages:
            content = msg.content.replace("[user] ", "").strip()
            words = content.lower().split()
            if words:
                key = words[0]
                command_freq[key] = command_freq.get(key, 0) + 1

        for cmd, count in command_freq.items():
            if count >= 2:
                patterns.append({
                    "description": f"User frequently uses '{cmd}' command ({count} times)",
                    "skill_name": f"auto-{cmd}",
                    "triggers": [f"/{cmd}"],
                    "confidence": min(count / 10.0, 0.9),
                })

        return patterns

    def get_pending_insights(self) -> list[dict]:
        return [
            {
                "id": i.id,
                "pattern": i.pattern,
                "suggested_skill_name": i.suggested_skill_name,
                "suggested_trigger": i.suggested_trigger,
                "confidence": i.confidence,
                "created_at": i.created_at,
            }
            for i in self._pending_insights
        ]

    def dismiss_insight(self, insight_id: str) -> bool:
        before = len(self._pending_insights)
        self._pending_insights = [i for i in self._pending_insights if i.id != insight_id]
        return len(self._pending_insights) < before

    async def promote_insight(self, insight_id: str) -> SkillManifest | None:
        insight = next((i for i in self._pending_insights if i.id == insight_id), None)
        if insight is None:
            return None

        if not insight.suggested_code:
            return None

        manifest = SkillManifest(
            name=insight.suggested_skill_name,
            version="0.1.0",
            description=f"Auto-generated skill: {insight.pattern}",
            trigger=insight.suggested_trigger,
            handler="python",
            handler_code=insight.suggested_code,
            auto_evolve=True,
        )

        self.skills.skills[manifest.name] = manifest
        self._pending_insights = [i for i in self._pending_insights if i.id != insight_id]
        return manifest
