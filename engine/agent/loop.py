from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import AsyncIterator

from engine.llm import LLMProvider, create_provider
from engine.config import MixConfig
from engine.memory.store import MemoryStore
from engine.memory.types import MemoryEntry, MemoryType


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
    def __init__(self, config: MixConfig, memory: MemoryStore | None = None) -> None:
        self.config = config
        self.provider: LLMProvider = create_provider(config.llm)
        self._sessions: dict[str, Session] = {}
        self.memory = memory

    async def _build_context(self, session: Session) -> list[dict]:
        messages = [{"role": m.role, "content": m.content} for m in session.messages]

        if self.memory and session.messages:
            last_user_msg = ""
            for m in reversed(session.messages):
                if m.role == "user":
                    last_user_msg = m.content
                    break

            if last_user_msg:
                relevant = await self.memory.search(last_user_msg, limit=5)
                if relevant:
                    context_lines = [f"- {e.content}" for e in relevant]
                    system_context = "Relevant memories:\n" + "\n".join(context_lines)
                    messages.insert(0, {"role": "system", "content": system_context})

        return messages

    async def _persist_memory(self, session: Session, role: str, content: str) -> None:
        if not self.memory:
            return
        entry = MemoryEntry(
            type=MemoryType.CONTEXT,
            content=content,
            source="agent_loop",
            session_id=session.id,
        )
        await self.memory.store(entry)

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
        await self._persist_memory(session, "user", user_message)

        context_messages = await self._build_context(session)
        response = await self.provider.complete(messages=context_messages)

        session.add("assistant", response["content"], tool_calls=response.get("tool_calls"))
        await self._persist_memory(session, "assistant", response["content"])

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
        await self._persist_memory(session, "user", user_message)

        context_messages = await self._build_context(session)
        msg_id = str(uuid.uuid4())
        full_content = ""

        async for chunk in self.provider.stream(messages=context_messages):
            full_content += chunk.get("delta", "")
            yield {
                "id": msg_id,
                "session_id": session.id,
                "delta": chunk.get("delta", ""),
                "done": chunk.get("done", False),
                "tool_calls": chunk.get("tool_calls"),
            }

        session.add("assistant", full_content)
        await self._persist_memory(session, "assistant", full_content)


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
