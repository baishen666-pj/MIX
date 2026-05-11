from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass
class SessionInfo:
    id: str
    channel: str
    user_id: str
    model: str
    created_at: str
    message_count: int


class SessionManager:
    def __init__(self) -> None:
        self._sessions: dict[str, dict] = {}

    def create(self, channel: str = "webchat", user_id: str = "default", model: str = "") -> str:
        session_id = str(uuid.uuid4())
        self._sessions[session_id] = {
            "id": session_id,
            "channel": channel,
            "user_id": user_id,
            "model": model,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "message_count": 0,
        }
        return session_id

    def get(self, session_id: str) -> dict | None:
        return self._sessions.get(session_id)

    def list_sessions(self) -> list[SessionInfo]:
        return [SessionInfo(**s) for s in self._sessions.values()]

    def delete(self, session_id: str) -> bool:
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False
