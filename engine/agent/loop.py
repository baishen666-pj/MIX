from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import AsyncIterator

from engine.llm import LLMProvider, create_provider
from engine.config import MixConfig


@dataclass
class Message:
    role: str  # "user" | "assistant" | "system" | "tool"
    content: str
    tool_call_id: str | None = None
    tool_calls: list[dict] | None = None


@dataclass
class Session:
    id: str
    messages: list[Message] = field(default_factory=list)
    model: str = ""
    created_at: str = ""

    def add(self, role: str, content: str, **kwargs) -> None:
        self.messages = [*self.messages, Message(role=role, content=content, **kwargs)]


class AgentLoop:
    def __init__(self, config: MixConfig) -> None:
        self.config = config
        self.provider: LLMProvider = create_provider(config.llm)
        self._sessions: dict[str, Session] = {}

    def get_or_create_session(self, session_id: str | None = None) -> Session:
        sid = session_id or str(uuid.uuid4())
        if sid not in self._sessions:
            self._sessions[sid] = Session(
                id=sid,
                model=self.config.llm.model,
                created_at=_now_iso(),
            )
        return self._sessions[sid]

    async def chat(self, user_message: str, session_id: str | None = None) -> dict:
        session = self.get_or_create_session(session_id)
        session.add("user", user_message)

        response = await self.provider.complete(
            messages=[{"role": m.role, "content": m.content} for m in session.messages],
        )

        session.add("assistant", response["content"], tool_calls=response.get("tool_calls"))

        return {
            "id": str(uuid.uuid4()),
            "session_id": session.id,
            "content": response["content"],
            "tool_calls": response.get("tool_calls"),
            "metadata": {},
        }

    async def chat_stream(self, user_message: str, session_id: str | None = None) -> AsyncIterator[dict]:
        session = self.get_or_create_session(session_id)
        session.add("user", user_message)

        msg_id = str(uuid.uuid4())
        full_content = ""

        async for chunk in self.provider.stream(
            messages=[{"role": m.role, "content": m.content} for m in session.messages],
        ):
            full_content += chunk.get("delta", "")
            yield {
                "id": msg_id,
                "session_id": session.id,
                "delta": chunk.get("delta", ""),
                "done": chunk.get("done", False),
                "tool_calls": chunk.get("tool_calls"),
            }

        session.add("assistant", full_content)


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
