"""Tool listing, execution, dynamic registration, chains, approval, and history endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from engine.api.schemas import DynamicToolRegisterRequest, ToolChainCreateRequest

router = APIRouter()


@router.get("/tools")
async def tools_list():
    from engine.api import routes as _pkg

    if _pkg._tools is None:
        return {"tools": [], "definitions": []}
    return {"tools": _pkg._tools.list_tools(), "definitions": _pkg._tools.get_definitions()}


@router.post("/tools/{tool_name}/execute")
async def tool_execute(tool_name: str, body: dict | None = None):
    from engine.api import routes as _pkg

    if _pkg._tools is None:
        raise HTTPException(503, "Tool registry not initialized")
    result = await _pkg._tools.execute(tool_name, **(body or {}))
    return result.to_dict()


@router.post("/tools/dynamic")
async def tools_dynamic_register(req: DynamicToolRegisterRequest):
    from engine.api import routes as _pkg

    if _pkg._tools is None or _pkg._tools._dynamic is None:
        raise HTTPException(503, "Dynamic tool system not initialized")
    from engine.tools.dynamic import DynamicToolDef

    defn = DynamicToolDef(
        name=req.name,
        description=req.description,
        parameters=req.parameters,
        handler_code=req.handler_code,
        examples=req.examples or [],
        constraints=req.constraints or {},
        danger_level=req.danger_level,
    )
    await _pkg._tools._dynamic.register(defn)
    return {"status": "ok", "tool": req.name}


@router.delete("/tools/dynamic/{name}")
async def tools_dynamic_unregister(name: str):
    from engine.api import routes as _pkg

    if _pkg._tools is None or _pkg._tools._dynamic is None:
        raise HTTPException(503, "Dynamic tool system not initialized")
    removed = await _pkg._tools._dynamic.unregister(name)
    if not removed:
        raise HTTPException(404, f"Dynamic tool '{name}' not found")
    return {"status": "ok", "removed": name}


@router.post("/tools/chain")
async def tools_chain_execute(req: ToolChainCreateRequest):
    from engine.api import routes as _pkg

    if _pkg._tools is None:
        raise HTTPException(503, "Tool registry not initialized")
    from engine.tools.composition import ToolChain, ToolChainExecutor, ToolChainStep

    steps = [
        ToolChainStep(
            tool_name=s.get("tool_name", ""),
            input_mapping=s.get("input_mapping", {}),
            fixed_args=s.get("fixed_args", {}),
        )
        for s in req.steps
    ]
    chain = ToolChain(
        name=req.name,
        description=req.description,
        steps=steps,
        output_key=req.output_key,
    )
    executor = ToolChainExecutor(_pkg._tools)
    result = await executor.execute_chain(chain, initial_args={})
    return result.to_dict()


@router.get("/tools/approval/pending")
async def tools_approval_pending():
    from engine.api import routes as _pkg

    if _pkg._tools is None or _pkg._tools._approval is None:
        return {"requests": []}
    return {"requests": [r.to_dict() for r in _pkg._tools._approval.get_pending()]}


@router.post("/tools/approval/{request_id}/approve")
async def tools_approval_approve(request_id: str):
    from engine.api import routes as _pkg

    if _pkg._tools is None or _pkg._tools._approval is None:
        raise HTTPException(503, "Approval system not initialized")
    approved = await _pkg._tools._approval.approve(request_id)
    if not approved:
        raise HTTPException(404, f"Request '{request_id}' not found or already resolved")
    return {"status": "ok"}


@router.post("/tools/approval/{request_id}/reject")
async def tools_approval_reject(request_id: str, body: dict | None = None):
    from engine.api import routes as _pkg

    if _pkg._tools is None or _pkg._tools._approval is None:
        raise HTTPException(503, "Approval system not initialized")
    reason = (body or {}).get("reason", "")
    rejected = await _pkg._tools._approval.reject(request_id, reason=reason)
    if not rejected:
        raise HTTPException(404, f"Request '{request_id}' not found or already resolved")
    return {"status": "ok"}


@router.get("/tools/history")
async def tools_history(
    tool_name: str | None = None,
    session_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    from engine.api import routes as _pkg

    if _pkg._tools is None or _pkg._tools._history is None:
        return {"records": []}
    records = await _pkg._tools._history.query(
        tool_name=tool_name,
        session_id=session_id,
        limit=limit,
        offset=offset,
    )
    return {"records": [r.to_dict() for r in records]}


@router.get("/tools/history/stats")
async def tools_history_stats():
    from engine.api import routes as _pkg

    if _pkg._tools is None or _pkg._tools._history is None:
        return {"total": 0, "tools": {}, "avg_time_ms": 0}
    return await _pkg._tools._history.get_stats()
