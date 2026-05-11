from __future__ import annotations

import json
from typing import AsyncIterator

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from engine.api.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    MemorySearchRequest,
    MemoryEntryResponse,
    SkillExecuteRequest,
)
from engine.agent.loop import AgentLoop
from engine.memory.store import MemoryStore
from engine.memory.types import MemoryType
from engine.skills.registry import SkillRegistry
from engine.skills.loader import SkillLoader

router = APIRouter()

_agent_loop: AgentLoop | None = None
_memory: MemoryStore | None = None
_skill_registry: SkillRegistry | None = None
_skill_loader: SkillLoader | None = None


def init_routes(
    agent_loop: AgentLoop,
    memory: MemoryStore | None = None,
    skill_registry: SkillRegistry | None = None,
) -> None:
    global _agent_loop, _memory, _skill_registry, _skill_loader
    _agent_loop = agent_loop
    _memory = memory
    _skill_registry = skill_registry
    _skill_loader = SkillLoader()


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        version="0.1.0",
        engine="mix-python",
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    assert _agent_loop is not None
    result = await _agent_loop.chat(req.message, session_id=req.session_id)
    return ChatResponse(**result)


@router.websocket("/ws/stream")
async def stream_chat(ws: WebSocket):
    await ws.accept()
    assert _agent_loop is not None

    try:
        while True:
            data = await ws.receive_text()
            req = json.loads(data)
            message = req.get("message", "")
            session_id = req.get("session_id")

            async for chunk in _agent_loop.chat_stream(message, session_id=session_id):
                await ws.send_text(json.dumps(chunk))
                if chunk.get("done"):
                    break
    except WebSocketDisconnect:
        pass


@router.post("/memory/search", response_model=list[MemoryEntryResponse])
async def memory_search(req: MemorySearchRequest):
    assert _memory is not None
    entries = await _memory.search(req.query, limit=req.limit)
    return [
        MemoryEntryResponse(
            id=e.id,
            type=e.type.value,
            content=e.content,
            tags=e.tags,
            created_at=e.created_at,
        )
        for e in entries
    ]


@router.get("/memory/{entry_id}", response_model=MemoryEntryResponse | None)
async def memory_get(entry_id: str):
    assert _memory is not None
    entry = await _memory.get(entry_id)
    if entry is None:
        return None
    return MemoryEntryResponse(
        id=entry.id,
        type=entry.type.value,
        content=entry.content,
        tags=entry.tags,
        created_at=entry.created_at,
    )


@router.delete("/memory/{entry_id}")
async def memory_delete(entry_id: str):
    assert _memory is not None
    deleted = await _memory.delete(entry_id)
    return {"deleted": deleted}


@router.post("/skills/execute")
async def skill_execute(req: SkillExecuteRequest):
    assert _skill_registry is not None
    assert _skill_loader is not None
    manifest = _skill_registry.get(req.skill_name)
    if manifest is None:
        return {"error": f"Skill '{req.skill_name}' not found"}
    result = await _skill_loader.execute(manifest, args=req.args)
    return {"status": "ok", "skill": req.skill_name, "result": result}


@router.get("/skills")
async def skills_list():
    if _skill_registry is None:
        return {"skills": []}
    return {"skills": _skill_registry.list_skills()}
