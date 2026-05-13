"""Chat, WebSocket stream, and SSE stream endpoints."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from starlette.responses import StreamingResponse

from engine.api.schemas import ChatRequest, ChatResponse

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    from engine.api import routes as _pkg

    if _pkg._agent_loop is None:
        raise HTTPException(503, "Agent loop not initialized")
    result = await _pkg._agent_loop.chat(req.message, session_id=req.session_id)
    if _pkg._learning:
        await _pkg._learning.record_interaction("user", req.message, session_id=req.session_id)
        await _pkg._learning.record_interaction("assistant", result["content"], session_id=req.session_id)
    return ChatResponse(**result)


@router.websocket("/ws/stream")
async def stream_chat(ws: WebSocket):
    from engine.api import routes as _pkg

    await ws.accept()
    if _pkg._agent_loop is None:
        await ws.close(code=1011, reason="Agent loop not initialized")
        return

    try:
        while True:
            data = await ws.receive_text()
            req = json.loads(data)
            message = req.get("message", "")
            session_id = req.get("session_id")

            async for chunk in _pkg._agent_loop.chat_stream(message, session_id=session_id):
                await ws.send_text(json.dumps(chunk))
                if chunk.get("done"):
                    break
            if _pkg._learning:
                await _pkg._learning.record_interaction("user", message, session_id=session_id)
    except WebSocketDisconnect:
        pass


@router.get("/chat/stream")
async def stream_chat_sse(message: str = Query(...), session_id: str | None = Query(None)):
    from engine.api import routes as _pkg

    if _pkg._agent_loop is None:
        raise HTTPException(503, "Agent loop not initialized")

    async def event_generator():
        async for chunk in _pkg._agent_loop.chat_stream(message, session_id=session_id):
            yield f"data: {json.dumps(chunk)}\n\n"
            if chunk.get("done"):
                break
        yield "data: [DONE]\n\n"

    if _pkg._learning:
        await _pkg._learning.record_interaction("user", message, session_id=session_id)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
