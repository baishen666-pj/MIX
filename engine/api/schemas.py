from __future__ import annotations

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    channel: str | None = None
    metadata: dict | None = None


class ChatResponse(BaseModel):
    id: str
    session_id: str
    content: str
    tool_calls: list[dict] | None = None
    metadata: dict | None = None


class StreamChunk(BaseModel):
    id: str
    session_id: str
    delta: str
    done: bool
    tool_calls: list[dict] | None = None


class SkillExecuteRequest(BaseModel):
    skill_name: str
    args: dict | None = None
    session_id: str | None = None


class MemorySearchRequest(BaseModel):
    query: str
    limit: int = 10
    tags: list[str] | None = None


class MemoryEntryResponse(BaseModel):
    id: str
    type: str
    content: str
    tags: list[str]
    created_at: str


class CronScheduleRequest(BaseModel):
    name: str
    cron: str
    message: str
    channel: str | None = None


class HealthResponse(BaseModel):
    status: str
    version: str
    engine: str
