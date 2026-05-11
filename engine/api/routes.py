from __future__ import annotations

import json
from typing import AsyncIterator

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from engine.api.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
)
from engine.agent.loop import AgentLoop

router = APIRouter()

_agent_loop: AgentLoop | None = None


def init_routes(agent_loop: AgentLoop) -> None:
    global _agent_loop
    _agent_loop = agent_loop


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
