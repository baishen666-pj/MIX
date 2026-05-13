from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from typing import AsyncIterator

from engine.llm import LLMProvider, create_provider
from engine.config import MixConfig
from engine.memory.store import MemoryStore
from engine.memory.types import MemoryEntry, MemoryType
from engine.tools.registry import ToolRegistry

MAX_TOOL_ITERATIONS = 10
MAX_SESSION_MESSAGES = 50
CHARS_PER_TOKEN = 4  # rough estimate for token counting without tiktoken


@dataclass
class Message:
    role: str
    content: str | None = None
    tool_call_id: str | None = None
    tool_calls: list[dict] | None = None
    name: str | None = None

    def to_api_dict(self) -> dict:
        d: dict = {"role": self.role}
        if self.content is not None:
            d["content"] = self.content
        if self.tool_calls is not None:
            d["tool_calls"] = self.tool_calls
        if self.tool_call_id is not None:
            d["tool_call_id"] = self.tool_call_id
        if self.name is not None:
            d["name"] = self.name
        return d


@dataclass
class Session:
    id: str
    messages: list[Message] = field(default_factory=list)
    model: str = ""
    created_at: str = ""

    def add(self, role: str, content: str | None = None, **kwargs) -> None:
        self.messages = [*self.messages, Message(role=role, content=content, **kwargs)]


class AgentLoop:
    def __init__(
        self,
        config: MixConfig,
        memory: MemoryStore | None = None,
        tools: ToolRegistry | None = None,
    ) -> None:
        self.config = config
        self.provider: LLMProvider = create_provider(config.llm)
        self._sessions: dict[str, Session] = {}
        self.memory = memory
        self.tools = tools or ToolRegistry()
        self._total_tokens_used = 0

    @staticmethod
    def _estimate_tokens(messages: list[dict]) -> int:
        total_chars = sum(
            len(m.get("content", "")) + len(json.dumps(m.get("tool_calls", [])))
            for m in messages
            if isinstance(m.get("content"), str)
        )
        return max(1, total_chars // CHARS_PER_TOKEN)

    def _token_budget_remaining(self) -> int:
        budget = self.config.llm.context_window - self.config.llm.max_output_tokens
        return max(0, budget - self._total_tokens_used)

    async def _summarize_messages(self, messages: list[dict]) -> str:
        if not self.provider or len(messages) < 2:
            return ""
        summary_prompt = (
            "Summarize the following conversation concisely, preserving key facts, "
            "decisions, and context. Output only the summary, no preamble.\n\n"
        )
        conv_text = "\n".join(
            f"{m.get('role', '?')}: {m.get('content', '')}"
            for m in messages
            if m.get("role") != "system"
        )
        if not conv_text.strip():
            return ""
        try:
            response = await self.provider.complete(
                messages=[
                    {"role": "system", "content": summary_prompt},
                    {"role": "user", "content": conv_text[:8000]},
                ],
                tools=None,
            )
            return response.get("content", "")[:2000]
        except Exception:
            return ""

    def _trim_to_budget(self, messages: list[dict], budget: int) -> list[dict]:
        if self._estimate_tokens(messages) <= budget:
            return messages
        system_msgs = [m for m in messages if m.get("role") == "system"]
        other_msgs = [m for m in messages if m.get("role") != "system"]
        while other_msgs and self._estimate_tokens(system_msgs + other_msgs) > budget:
            other_msgs = other_msgs[1:]
        if not other_msgs:
            return messages[-3:]
        trimmed_count = len(messages) - len(system_msgs) - len(other_msgs)
        if trimmed_count > 0:
            system_msgs.insert(0, {"role": "system", "content": f"[{trimmed_count} earlier messages trimmed for token budget]"})
        return system_msgs + other_msgs

    async def _summarize_older_context(self, session: Session) -> None:
        if len(session.messages) <= MAX_SESSION_MESSAGES + 10:
            return
        older = session.messages[:len(session.messages) - MAX_SESSION_MESSAGES]
        older_dicts = [m.to_api_dict() for m in older]
        summary = await self._summarize_messages(older_dicts)
        if summary:
            summary_msg = Message(role="system", content=f"[Earlier conversation summary]\n{summary}")
            recent = session.messages[len(session.messages) - MAX_SESSION_MESSAGES:]
            session.messages = [summary_msg, *recent]

    async def _build_context(self, session: Session) -> list[dict]:
        await self._summarize_older_context(session)

        if len(session.messages) > MAX_SESSION_MESSAGES:
            trimmed = session.messages[-MAX_SESSION_MESSAGES:]
            summary_prefix = f"[Earlier {len(session.messages) - MAX_SESSION_MESSAGES} messages trimmed]"
            session.messages = [
                Message(role="system", content=summary_prefix),
                *trimmed,
            ]

        messages = [m.to_api_dict() for m in session.messages]

        if self.memory and session.messages:
            last_user_msg = ""
            for m in reversed(session.messages):
                if m.role == "user" and m.content:
                    last_user_msg = m.content
                    break

            if last_user_msg:
                relevant = await self.memory.search(last_user_msg, limit=5)
                if relevant:
                    context_lines = [f"- {e.content}" for e in relevant]
                    system_context = "Relevant memories:\n" + "\n".join(context_lines)
                    messages.insert(0, {"role": "system", "content": system_context})

        budget = self._token_budget_remaining()
        if budget > 0:
            messages = self._trim_to_budget(messages, budget)

        return messages

    async def _persist_memory(self, session: Session, role: str, content: str) -> None:
        if not self.memory or not content:
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

    def _get_tool_definitions(self) -> list[dict]:
        return self.tools.get_definitions()

    async def _execute_tool_calls(self, tool_calls: list[dict]) -> list[Message]:
        tool_results: list[Message] = []
        for call in tool_calls:
            func = call.get("function", {})
            name = func.get("name", "")
            try:
                arguments = json.loads(func.get("arguments", "{}"))
            except json.JSONDecodeError:
                arguments = {}

            result = await self.tools.execute(name, **arguments)
            tool_results.append(Message(
                role="tool",
                content=result.output if result.success else f"Error: {result.error}",
                tool_call_id=call.get("id"),
                name=name,
            ))
        return tool_results

    async def chat(self, user_message: str, session_id: str | None = None) -> dict:
        session = self.get_or_create_session(session_id)
        session.add("user", user_message)
        await self._persist_memory(session, "user", user_message)

        context_messages = await self._build_context(session)
        all_tool_events: list[dict] = []

        for _ in range(MAX_TOOL_ITERATIONS):
            response = await self.provider.complete(
                messages=context_messages,
                tools=self._get_tool_definitions(),
            )

            content = response.get("content") or ""
            tool_calls = response.get("tool_calls")
            usage = response.get("usage", {})
            self._total_tokens_used += usage.get("total_tokens", 0)

            session.add("assistant", content, tool_calls=tool_calls)
            context_messages.append({"role": "assistant", "content": content, "tool_calls": tool_calls})

            if not tool_calls:
                await self._persist_memory(session, "assistant", content)
                return {
                    "id": str(uuid.uuid4()),
                    "session_id": session.id,
                    "content": content,
                    "tool_calls": None,
                    "tool_events": all_tool_events or None,
                    "metadata": {"tokens_used": self._total_tokens_used},
                }

            for call in tool_calls:
                func = call.get("function", {})
                all_tool_events.append({
                    "type": "tool_call",
                    "id": call.get("id"),
                    "name": func.get("name"),
                    "arguments": func.get("arguments"),
                })

            tool_results = await self._execute_tool_calls(tool_calls)
            for tr in tool_results:
                session.messages = [*session.messages, tr]
                context_messages.append(tr.to_api_dict())
                all_tool_events.append({
                    "type": "tool_result",
                    "tool_call_id": tr.tool_call_id,
                    "name": tr.name,
                    "content": tr.content,
                })

        return {
            "id": str(uuid.uuid4()),
            "session_id": session.id,
            "content": "Reached maximum tool iterations.",
            "tool_calls": None,
            "tool_events": all_tool_events,
            "metadata": {"stopped": True},
        }

    async def chat_stream(self, user_message: str, session_id: str | None = None) -> AsyncIterator[dict]:
        session = self.get_or_create_session(session_id)
        session.add("user", user_message)
        await self._persist_memory(session, "user", user_message)

        context_messages = await self._build_context(session)
        msg_id = str(uuid.uuid4())
        full_content = ""

        for _ in range(MAX_TOOL_ITERATIONS):
            accumulated_tool_calls: list[dict] = []

            async for chunk in self.provider.stream(
                messages=context_messages,
                tools=self._get_tool_definitions(),
            ):
                delta = chunk.get("delta", "")
                tool_calls = chunk.get("tool_calls")
                done = chunk.get("done", False)

                full_content += delta
                yield {
                    "id": msg_id,
                    "session_id": session.id,
                    "delta": delta,
                    "done": False,
                    "tool_calls": tool_calls,
                }

                if done and tool_calls:
                    accumulated_tool_calls = tool_calls

            if not accumulated_tool_calls:
                break

            context_messages.append({
                "role": "assistant",
                "content": "",
                "tool_calls": accumulated_tool_calls,
            })

            for call in accumulated_tool_calls:
                yield {
                    "id": msg_id,
                    "session_id": session.id,
                    "delta": "",
                    "done": False,
                    "type": "tool_call",
                    "tool_call": call,
                }

            tool_results = await self._execute_tool_calls(accumulated_tool_calls)
            for tr in tool_results:
                session.messages = [*session.messages, tr]
                context_messages.append(tr.to_api_dict())
                yield {
                    "id": msg_id,
                    "session_id": session.id,
                    "delta": "",
                    "done": False,
                    "type": "tool_result",
                    "tool_call_id": tr.tool_call_id,
                    "name": tr.name,
                    "content": tr.content,
                }

        yield {"id": msg_id, "session_id": session.id, "delta": "", "done": True}
        session.add("assistant", full_content)
        await self._persist_memory(session, "assistant", full_content)


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
