"""Session list, get, search, delete, and export endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/sessions")
async def sessions_list():
    from engine.api import routes as _pkg

    if _pkg._memory is None:
        return {"sessions": []}
    return {"sessions": await _pkg._memory.list_sessions()}


@router.delete("/sessions/{session_id}")
async def session_delete(session_id: str):
    from engine.api import routes as _pkg

    if _pkg._memory is None:
        raise HTTPException(503, "Memory store not initialized")
    deleted = await _pkg._memory.delete_session(session_id)
    return {"deleted": deleted}


@router.get("/sessions/search")
async def sessions_search(q: str = "", limit: int = 20, offset: int = 0):
    from engine.api import routes as _pkg

    if _pkg._memory is None:
        return {"sessions": []}
    if not q:
        return {"sessions": await _pkg._memory.list_sessions()}
    return {"sessions": await _pkg._memory.search_sessions(q, limit=limit, offset=offset)}


@router.get("/sessions/{session_id}/export")
async def session_export(session_id: str, format: str = "json"):
    from engine.api import routes as _pkg

    if _pkg._memory is None:
        raise HTTPException(503, "Memory store not initialized")
    result = await _pkg._memory.export_session(session_id, format=format)
    if result is None:
        raise HTTPException(404, "Session not found")
    if format == "markdown":
        from fastapi.responses import PlainTextResponse

        return PlainTextResponse(result)
    return result


@router.get("/sessions/{session_id}")
async def session_get(session_id: str):
    from engine.api import routes as _pkg

    if _pkg._memory is None:
        raise HTTPException(503, "Memory store not initialized")
    data = await _pkg._memory.load_session(session_id)
    if data is None:
        raise HTTPException(404, "Session not found")
    return {"id": session_id, "data": data}
