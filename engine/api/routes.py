from __future__ import annotations

import json
from typing import Any, AsyncIterator

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from starlette.responses import StreamingResponse
from engine.api.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    MemorySearchRequest,
    MemoryEntryResponse,
    SkillExecuteRequest,
    CronScheduleRequest,
    DecomposeRequest,
    OrchestrateRequest,
    TTSRequest,
    STTResponse,
    ModelRouteRequest,
    ModelRouteResponse,
    AgentCreateRequest,
    AgentUpdateRequest,
    AgentResponse,
    CollaborateRequest,
    CollaborationStatusResponse,
    DynamicToolRegisterRequest,
    ToolChainCreateRequest,
    ApprovalActionRequest,
    CollectionCreateRequest,
    RAGQueryRequest,
)
from engine.agent.loop import AgentLoop
from engine.memory.store import MemoryStore
from engine.memory.types import MemoryEntry, MemoryType
from engine.memory.document_parser import extract_text
from engine.skills.registry import SkillRegistry
from engine.skills.loader import SkillLoader
from engine.learning.loop import LearningLoop
from engine.learning.nudge import CronScheduler, CronJob
from engine.tools.registry import ToolRegistry
from engine.monitoring.metrics import MetricsCollector

router = APIRouter()

_agent_loop: AgentLoop | None = None
_memory: MemoryStore | None = None
_skill_registry: SkillRegistry | None = None
_skill_loader: SkillLoader | None = None
_learning: LearningLoop | None = None
_cron: CronScheduler | None = None
_tools: ToolRegistry | None = None
_agent_router: Any = None
_mcp: Any = None
_api_key: str = ""
_decomposer: Any = None
_orchestrator: Any = None
_metrics: MetricsCollector | None = None
_config: Any = None
_collaboration: Any = None
_rag_collections: Any = None
_rag_pipeline: Any = None


def init_routes(
    agent_loop: AgentLoop,
    memory: MemoryStore | None = None,
    skill_registry: SkillRegistry | None = None,
    learning: LearningLoop | None = None,
    cron: CronScheduler | None = None,
    agent_router: Any = None,
    mcp: Any = None,
    api_key: str = "",
    decomposer: Any = None,
    orchestrator: Any = None,
    metrics: MetricsCollector | None = None,
    config: Any = None,
    collaboration: Any = None,
    rag_collections: Any = None,
    rag_pipeline: Any = None,
) -> None:
    global _agent_loop, _memory, _skill_registry, _skill_loader, _learning, _cron, _tools, _agent_router, _mcp, _api_key, _decomposer, _orchestrator, _metrics, _config, _collaboration, _rag_collections, _rag_pipeline
    _agent_loop = agent_loop
    _memory = memory
    _skill_registry = skill_registry
    _skill_loader = SkillLoader()
    _learning = learning
    _cron = cron
    _tools = ToolRegistry()
    _agent_router = agent_router
    _mcp = mcp
    _api_key = api_key
    _decomposer = decomposer
    _orchestrator = orchestrator
    _metrics = metrics
    _config = config
    _collaboration = collaboration
    _rag_collections = rag_collections
    _rag_pipeline = rag_pipeline


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        version="0.1.0",
        engine="mix-python",
    )


# --- Config ---

@router.get("/config")
async def config_get():
    if _config is None:
        return {"error": "Config not initialized"}
    return _config._to_dict()


@router.put("/config")
async def config_update(req: dict):
    global _config
    if _config is None:
        raise HTTPException(503, "Config not initialized")
    from engine.config import MixConfig
    updated = MixConfig._from_dict(req)
    updated.save()
    _config = updated
    return {"status": "ok"}


@router.get("/metrics")
async def metrics_endpoint():
    if _metrics is None:
        return {"error": "Metrics not initialized"}
    data = await _metrics.get_metrics()
    # Enrich with channels from agent router
    if _agent_router is not None:
        agents = _agent_router.list_agents()
        channels = list({ch for a in agents for ch in a.get("channels", [])})
        data["channels"] = channels
    else:
        data["channels"] = []
    return data


@router.get("/metrics/prometheus")
async def metrics_prometheus():
    if _metrics is None:
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse("# Metrics not initialized\n")
    text = await _metrics.prometheus_format()
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(text, media_type="text/plain; version=0.0.4; charset=utf-8")


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if _agent_loop is None:
        raise HTTPException(503, "Agent loop not initialized")
    result = await _agent_loop.chat(req.message, session_id=req.session_id)
    if _learning:
        await _learning.record_interaction("user", req.message, session_id=req.session_id)
        await _learning.record_interaction("assistant", result["content"], session_id=req.session_id)
    return ChatResponse(**result)


@router.websocket("/ws/stream")
async def stream_chat(ws: WebSocket):
    await ws.accept()
    if _agent_loop is None:
        await ws.close(code=1011, reason="Agent loop not initialized")
        return

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
            if _learning:
                await _learning.record_interaction("user", message, session_id=session_id)
    except WebSocketDisconnect:
        pass


@router.get("/chat/stream")
async def stream_chat_sse(message: str = Query(...), session_id: str | None = Query(None)):
    if _agent_loop is None:
        raise HTTPException(503, "Agent loop not initialized")

    async def event_generator():
        async for chunk in _agent_loop.chat_stream(message, session_id=session_id):
            yield f"data: {json.dumps(chunk)}\n\n"
            if chunk.get("done"):
                break
        yield "data: [DONE]\n\n"

    if _learning:
        await _learning.record_interaction("user", message, session_id=session_id)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# --- Memory ---

@router.post("/memory/search", response_model=list[MemoryEntryResponse])
async def memory_search(req: MemorySearchRequest):
    if _memory is None:
        raise HTTPException(503, "Memory store not initialized")
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
    if _memory is None:
        raise HTTPException(503, "Memory store not initialized")
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
    if _memory is None:
        raise HTTPException(503, "Memory store not initialized")
    deleted = await _memory.delete(entry_id)
    return {"deleted": deleted}


@router.post("/memory")
async def memory_create(body: dict):
    if _memory is None:
        raise HTTPException(503, "Memory store not initialized")
    content = body.get("content", "")
    if not content:
        return {"error": "content is required"}
    entry = MemoryEntry(
        type=MemoryType(body.get("type", "context")),
        content=content,
        tags=body.get("tags", []),
        source=body.get("source", "api"),
    )
    await _memory.store(entry)
    return {"status": "ok", "id": entry.id}


@router.post("/memory/ingest")
async def memory_ingest(body: dict):
    if _memory is None:
        raise HTTPException(503, "Memory store not initialized")
    text = body.get("text", "")
    if not text:
        return {"error": "text is required"}
    chunk_size = body.get("chunk_size", 500)
    source = body.get("source", "")
    ids = await _memory.ingest_document(text, chunk_size=int(chunk_size), source=source)
    return {"status": "ok", "chunks_created": len(ids), "ids": ids}


@router.post("/memory/upload")
async def memory_upload(file: UploadFile = File(...)):
    if _memory is None:
        raise HTTPException(503, "Memory store not initialized")
    import tempfile
    import os
    suffix = Path(file.filename or "file.txt").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        text = extract_text(tmp_path, mime_type=file.content_type or "")
        if not text.strip():
            return {"error": "No text content extracted from file"}
        ids = await _memory.ingest_document(text, source=file.filename or "upload")
        return {"status": "ok", "filename": file.filename, "chunks_created": len(ids)}
    finally:
        os.unlink(tmp_path)


# --- Sessions ---

@router.get("/sessions")
async def sessions_list():
    if _memory is None:
        return {"sessions": []}
    return {"sessions": await _memory.list_sessions()}


@router.delete("/sessions/{session_id}")
async def session_delete(session_id: str):
    if _memory is None:
        raise HTTPException(503, "Memory store not initialized")
    deleted = await _memory.delete_session(session_id)
    return {"deleted": deleted}


@router.get("/sessions/search")
async def sessions_search(q: str = "", limit: int = 20, offset: int = 0):
    if _memory is None:
        return {"sessions": []}
    if not q:
        return {"sessions": await _memory.list_sessions()}
    return {"sessions": await _memory.search_sessions(q, limit=limit, offset=offset)}


@router.get("/sessions/{session_id}/export")
async def session_export(session_id: str, format: str = "json"):
    if _memory is None:
        raise HTTPException(503, "Memory store not initialized")
    result = await _memory.export_session(session_id, format=format)
    if result is None:
        raise HTTPException(404, "Session not found")
    if format == "markdown":
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(result)
    return result


@router.get("/sessions/{session_id}")
async def session_get(session_id: str):
    if _memory is None:
        raise HTTPException(503, "Memory store not initialized")
    data = await _memory.load_session(session_id)
    if data is None:
        raise HTTPException(404, "Session not found")
    return {"id": session_id, "data": data}


# --- Plugins ---

@router.post("/plugins/reload")
async def plugins_reload():
    if _skill_registry is None:
        return {"error": "Skill registry not initialized"}
    count = _skill_registry.load_all()
    return {"status": "ok", "skills_loaded": count}


@router.post("/plugins/install")
async def plugins_install(req: dict):
    if _skill_registry is None:
        raise HTTPException(503, "Skill registry not initialized")
    source = req.get("source", "")
    version = req.get("version")
    if not source:
        raise HTTPException(400, "Missing 'source' field")
    manifest = _skill_registry.install(source, version=version)
    if manifest is None:
        raise HTTPException(400, f"Failed to install from '{source}'")
    return {"status": "ok", "skill": {"name": manifest.name, "version": manifest.version}}


@router.post("/plugins/uninstall")
async def plugins_uninstall(req: dict):
    if _skill_registry is None:
        raise HTTPException(503, "Skill registry not initialized")
    name = req.get("name", "")
    if not name:
        raise HTTPException(400, "Missing 'name' field")
    removed = _skill_registry.uninstall(name)
    if not removed:
        raise HTTPException(404, f"Skill '{name}' not found")
    return {"status": "ok", "removed": name}


@router.post("/plugins/update")
async def plugins_update(req: dict):
    if _skill_registry is None:
        raise HTTPException(503, "Skill registry not initialized")
    name = req.get("name", "")
    if not name:
        raise HTTPException(400, "Missing 'name' field")
    manifest = _skill_registry.update(name)
    if manifest is None:
        raise HTTPException(404, f"Skill '{name}' not found or has no source URL")
    return {"status": "ok", "skill": {"name": manifest.name, "version": manifest.version}}


@router.get("/plugins/available")
async def plugins_available(q: str = ""):
    if _skill_registry is None:
        return {"plugins": []}
    return {"plugins": _skill_registry.list_available(query=q)}


# --- Skills ---

@router.post("/skills/execute")
async def skill_execute(req: SkillExecuteRequest):
    if _skill_registry is None or _skill_loader is None:
        raise HTTPException(503, "Skills system not initialized")
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


# --- Learning ---

@router.get("/learning/insights")
async def learning_insights():
    if _learning is None:
        return {"insights": []}
    return {"insights": _learning.get_pending_insights()}


@router.post("/learning/insights/{insight_id}/promote")
async def promote_insight(insight_id: str):
    if _learning is None:
        return {"error": "Learning not initialized"}
    manifest = await _learning.promote_insight(insight_id)
    if manifest is None:
        return {"error": "Insight not found or no code to promote"}
    return {"status": "ok", "skill": manifest.name}


@router.delete("/learning/insights/{insight_id}")
async def dismiss_insight(insight_id: str):
    if _learning is None:
        return {"error": "Learning not initialized"}
    dismissed = _learning.dismiss_insight(insight_id)
    return {"dismissed": dismissed}


# --- Cron ---

@router.post("/cron/schedule")
async def cron_schedule(req: CronScheduleRequest):
    if _cron is None:
        return {"error": "Cron scheduler not initialized"}
    job = _cron.add_job(name=req.name, cron=req.cron, message=req.message, channel=req.channel)
    return {"status": "ok", "job": {"id": job.id, "name": job.name, "cron": job.cron}}


@router.get("/cron/jobs")
async def cron_list():
    if _cron is None:
        return {"jobs": []}
    return {"jobs": _cron.list_jobs()}


@router.delete("/cron/jobs/{job_id}")
async def cron_delete(job_id: str):
    if _cron is None:
        return {"error": "Cron scheduler not initialized"}
    deleted = _cron.remove_job(job_id)
    return {"deleted": deleted}


# --- Tools ---

@router.get("/tools")
async def tools_list():
    if _tools is None:
        return {"tools": []}
    return {"tools": _tools.list_tools(), "definitions": _tools.get_definitions()}


@router.post("/tools/{tool_name}/execute")
async def tool_execute(tool_name: str, body: dict | None = None):
    if _tools is None:
        return {"error": "Tool registry not initialized"}
    result = await _tools.execute(tool_name, **(body or {}))
    return result.to_dict()


@router.post("/tools/dynamic")
async def tools_dynamic_register(req: DynamicToolRegisterRequest):
    if _tools is None or _tools._dynamic is None:
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
    await _tools._dynamic.register(defn)
    return {"status": "ok", "tool": req.name}


@router.delete("/tools/dynamic/{name}")
async def tools_dynamic_unregister(name: str):
    if _tools is None or _tools._dynamic is None:
        raise HTTPException(503, "Dynamic tool system not initialized")
    removed = await _tools._dynamic.unregister(name)
    if not removed:
        raise HTTPException(404, f"Dynamic tool '{name}' not found")
    return {"status": "ok", "removed": name}


@router.post("/tools/chain")
async def tools_chain_execute(req: ToolChainCreateRequest):
    if _tools is None:
        raise HTTPException(503, "Tool registry not initialized")
    from engine.tools.composition import ToolChain, ToolChainStep, ToolChainExecutor
    steps = []
    for s in req.steps:
        steps.append(ToolChainStep(
            tool_name=s.get("tool_name", ""),
            input_mapping=s.get("input_mapping", {}),
            fixed_args=s.get("fixed_args", {}),
        ))
    chain = ToolChain(
        name=req.name,
        description=req.description,
        steps=steps,
        output_key=req.output_key,
    )
    executor = ToolChainExecutor(_tools)
    result = await executor.execute_chain(chain, initial_args={})
    return result.to_dict()


@router.get("/tools/approval/pending")
async def tools_approval_pending():
    if _tools is None or _tools._approval is None:
        return {"requests": []}
    return {"requests": [r.to_dict() for r in _tools._approval.get_pending()]}


@router.post("/tools/approval/{request_id}/approve")
async def tools_approval_approve(request_id: str):
    if _tools is None or _tools._approval is None:
        raise HTTPException(503, "Approval system not initialized")
    approved = await _tools._approval.approve(request_id)
    if not approved:
        raise HTTPException(404, f"Request '{request_id}' not found or already resolved")
    return {"status": "ok"}


@router.post("/tools/approval/{request_id}/reject")
async def tools_approval_reject(request_id: str, body: dict | None = None):
    if _tools is None or _tools._approval is None:
        raise HTTPException(503, "Approval system not initialized")
    reason = (body or {}).get("reason", "")
    rejected = await _tools._approval.reject(request_id, reason=reason)
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
    if _tools is None or _tools._history is None:
        return {"records": []}
    records = await _tools._history.query(
        tool_name=tool_name,
        session_id=session_id,
        limit=limit,
        offset=offset,
    )
    return {"records": [r.to_dict() for r in records]}


@router.get("/tools/history/stats")
async def tools_history_stats():
    if _tools is None or _tools._history is None:
        return {"total": 0, "tools": {}, "avg_time_ms": 0}
    return await _tools._history.get_stats()


# --- Agents ---

@router.get("/agents")
async def agents_list():
    from engine.agent.router import AgentRouter
    if _agent_router is None:
        return {"agents": [{"name": "main", "channels": [], "model": "default"}]}
    return {"agents": _agent_router.list_agents()}


@router.post("/agents")
async def agents_create(req: AgentCreateRequest):
    if _agent_router is None:
        raise HTTPException(503, "Agent router not initialized")
    try:
        agent = _agent_router.register_agent(
            name=req.name,
            channels=req.channels or [],
            allowed_users=req.allowed_users or [],
            role=req.role,
            system_prompt_override=req.system_prompt_override,
        )
        return AgentResponse(
            name=agent.name,
            role=agent.role,
            channels=agent.channels,
            allowed_users=agent.allowed_users,
            model=agent.config.llm.model,
            system_prompt=agent.system_prompt[:200],
        )
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/agents/roles")
async def agents_roles():
    from engine.agent.roles import list_roles
    roles = list_roles()
    return {
        "roles": [
            {
                "name": r.name,
                "system_prompt": r.system_prompt[:200],
                "allowed_tools": r.allowed_tools,
                "default_model_tier": r.default_model_tier,
                "max_iterations": r.max_iterations,
            }
            for r in roles
        ]
    }


@router.get("/agents/{name}")
async def agents_get(name: str):
    if _agent_router is None:
        raise HTTPException(503, "Agent router not initialized")
    agent = _agent_router.get_agent(name)
    if agent is None:
        raise HTTPException(404, f"Agent '{name}' not found")
    return AgentResponse(
        name=agent.name,
        role=agent.role,
        channels=agent.channels,
        allowed_users=agent.allowed_users,
        model=agent.config.llm.model,
        system_prompt=agent.system_prompt[:200],
    )


@router.put("/agents/{name}")
async def agents_update(name: str, req: AgentUpdateRequest):
    if _agent_router is None:
        raise HTTPException(503, "Agent router not initialized")
    updates = {}
    if req.channels is not None:
        updates["channels"] = req.channels
    if req.allowed_users is not None:
        updates["allowed_users"] = req.allowed_users
    if req.system_prompt is not None:
        updates["system_prompt"] = req.system_prompt
    if req.role is not None:
        updates["role"] = req.role
    updated = _agent_router.update_agent(name, **updates)
    if not updated:
        raise HTTPException(404, f"Agent '{name}' not found")
    return {"status": "ok"}


@router.delete("/agents/{name}")
async def agents_delete(name: str):
    if _agent_router is None:
        raise HTTPException(503, "Agent router not initialized")
    deleted = _agent_router.delete_agent(name)
    if not deleted:
        raise HTTPException(404, f"Agent '{name}' not found")
    return {"status": "ok", "deleted": name}


@router.post("/agents/collaborate")
async def agents_collaborate(req: CollaborateRequest):
    if _collaboration is None:
        raise HTTPException(503, "Collaboration engine not initialized")
    from engine.agent.collaboration import CollaborationPattern
    try:
        pattern = CollaborationPattern(req.pattern)
    except ValueError:
        raise HTTPException(400, f"Invalid pattern: {req.pattern}. Use: sequential, parallel, debate, round_robin")
    plan = _collaboration.create_plan(
        pattern=pattern,
        task=req.task,
        agent_roles=req.agents,
        max_rounds=req.max_rounds,
    )
    result = await _collaboration.execute_plan(plan)
    return {"plan_id": plan.id, "status": plan.status, "result": result}


@router.get("/agents/collaborate/{plan_id}")
async def collaboration_status(plan_id: str):
    if _collaboration is None:
        raise HTTPException(503, "Collaboration engine not initialized")
    status = _collaboration.get_plan_status(plan_id)
    if status is None:
        raise HTTPException(404, f"Plan '{plan_id}' not found")
    return status


@router.get("/agents/collaborations")
async def collaborations_list():
    if _collaboration is None:
        return {"plans": []}
    return {"plans": _collaboration.get_active_plans()}


# --- Agent Communication ---

@router.post("/agents/decompose")
async def agents_decompose(req: DecomposeRequest):
    if _decomposer is None:
        raise HTTPException(503, "Task decomposer not initialized")
    subtasks = await _decomposer.decompose(req.task, max_subtasks=req.max_subtasks)
    return {"subtasks": [s.to_dict() for s in subtasks]}


@router.post("/agents/orchestrate")
async def agents_orchestrate(req: OrchestrateRequest):
    if _decomposer is None or _orchestrator is None or _agent_loop is None:
        raise HTTPException(503, "Orchestration pipeline not initialized")
    subtasks = await _decomposer.decompose(req.task)
    result = await _orchestrator.execute_plan(subtasks, _agent_loop)
    return result


# --- Model Routing ---

@router.post("/model/route", response_model=ModelRouteResponse)
async def model_route(req: ModelRouteRequest):
    from engine.agent.model_router import route_model, classify_complexity
    tier = route_model(req.message, override_tier=req.tier)
    tier_name = req.tier or classify_complexity(req.message)
    return ModelRouteResponse(
        tier=tier_name,
        provider=tier.provider,
        model=tier.model,
        context_window=tier.context_window,
        max_output_tokens=tier.max_output_tokens,
    )


@router.get("/model/tiers")
async def model_tiers():
    from engine.agent.model_router import MODEL_TIERS
    return {
        "tiers": {
            name: {
                "provider": t.provider,
                "model": t.model,
                "context_window": t.context_window,
                "max_output_tokens": t.max_output_tokens,
            }
            for name, t in MODEL_TIERS.items()
        }
    }


# --- MCP ---

@router.get("/mcp/servers")
async def mcp_servers():
    if _mcp is None:
        return {"servers": []}
    return {"servers": _mcp.list_servers(), "tools": _mcp.list_tools()}


@router.post("/mcp/servers")
async def mcp_register(body: dict):
    if _mcp is None:
        return {"error": "MCP not initialized"}
    from engine.mcp.client import MCPServerConfig
    config = MCPServerConfig(
        name=body.get("name", ""),
        url=body.get("url", ""),
        api_key=body.get("api_key", ""),
    )
    _mcp.register_server(config)
    tools = await _mcp.discover_tools(config.name)
    return {"status": "ok", "server": config.name, "tools_discovered": len(tools)}


# --- RAG ---

@router.post("/rag/collections")
async def rag_create_collection(req: CollectionCreateRequest):
    if _collaboration is None:
        raise HTTPException(503, "RAG pipeline not initialized")
    from engine.api import routes as _self
    collections_mgr = getattr(_self, '_rag_collections', None)
    if collections_mgr is None:
        raise HTTPException(503, "Collection manager not initialized")
    coll = await collections_mgr.create_collection(
        name=req.name,
        description=req.description,
        embedding_model=req.embedding_model,
    )
    return {"status": "ok", "collection": {"id": coll.id, "name": coll.name}}


@router.get("/rag/collections")
async def rag_list_collections():
    from engine.api import routes as _self
    collections_mgr = getattr(_self, '_rag_collections', None)
    if collections_mgr is None:
        return {"collections": []}
    colls = await collections_mgr.list_collections()
    return {"collections": [
        {"id": c.id, "name": c.name, "description": c.description,
         "document_count": c.document_count, "embedding_model": c.embedding_model}
        for c in colls
    ]}


@router.get("/rag/collections/{collection_id}")
async def rag_get_collection(collection_id: str):
    from engine.api import routes as _self
    collections_mgr = getattr(_self, '_rag_collections', None)
    if collections_mgr is None:
        raise HTTPException(503, "Collection manager not initialized")
    coll = await collections_mgr.get_collection(collection_id)
    if coll is None:
        raise HTTPException(404, "Collection not found")
    return {"id": coll.id, "name": coll.name, "description": coll.description,
            "document_count": coll.document_count, "embedding_model": coll.embedding_model}


@router.delete("/rag/collections/{collection_id}")
async def rag_delete_collection(collection_id: str):
    from engine.api import routes as _self
    collections_mgr = getattr(_self, '_rag_collections', None)
    if collections_mgr is None:
        raise HTTPException(503, "Collection manager not initialized")
    deleted = await collections_mgr.delete_collection(collection_id)
    if not deleted:
        raise HTTPException(404, "Collection not found")
    return {"status": "ok", "deleted": collection_id}


@router.post("/rag/collections/{collection_id}/documents")
async def rag_upload_document(collection_id: str, file: UploadFile = File(...)):
    from engine.api import routes as _self
    rag_pipeline = getattr(_self, '_rag_pipeline', None)
    if rag_pipeline is None:
        raise HTTPException(503, "RAG pipeline not initialized")
    import tempfile, os
    from engine.memory.document_parser import extract_text
    suffix = Path(file.filename or "file.txt").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content_bytes = await file.read()
        tmp.write(content_bytes)
        tmp_path = tmp.name
    try:
        text = extract_text(tmp_path, mime_type=file.content_type or "")
        if not text.strip():
            return {"error": "No text content extracted"}
        result = await rag_pipeline.ingest(
            collection_id=collection_id,
            content=text,
            filename=file.filename or "upload",
            mime_type=file.content_type or "",
        )
        return {"status": "ok", **result}
    finally:
        os.unlink(tmp_path)


@router.get("/rag/collections/{collection_id}/documents")
async def rag_list_documents(collection_id: str):
    from engine.api import routes as _self
    collections_mgr = getattr(_self, '_rag_collections', None)
    if collections_mgr is None:
        return {"documents": []}
    docs = await collections_mgr.list_documents(collection_id)
    return {"documents": [
        {"id": d.id, "filename": d.filename, "chunk_count": d.chunk_count,
         "size_bytes": d.size_bytes, "created_at": d.created_at}
        for d in docs
    ]}


@router.delete("/rag/documents/{document_id}")
async def rag_delete_document(document_id: str):
    from engine.api import routes as _self
    collections_mgr = getattr(_self, '_rag_collections', None)
    if collections_mgr is None:
        raise HTTPException(503, "Collection manager not initialized")
    deleted = await collections_mgr.delete_document(document_id)
    if not deleted:
        raise HTTPException(404, "Document not found")
    return {"status": "ok", "deleted": document_id}


@router.post("/rag/query")
async def rag_query(req: RAGQueryRequest):
    from engine.api import routes as _self
    rag_pipeline = getattr(_self, '_rag_pipeline', None)
    if rag_pipeline is None:
        raise HTTPException(503, "RAG pipeline not initialized")
    from engine.rag.pipeline import RAGQuery
    query = RAGQuery(
        query=req.query,
        collection_ids=req.collection_ids,
        top_k=req.top_k,
        rerank=req.rerank,
        rerank_top_k=req.rerank_top_k,
        include_citations=req.include_citations,
    )
    result = await rag_pipeline.query(query)
    return {
        "answer": result.answer,
        "citations": result.citations,
        "retrieved_chunks": result.retrieved_chunks,
        "reranked_chunks": result.reranked_chunks,
        "latency_ms": round(result.latency_ms, 2),
    }


# --- Voice ---

@router.post("/voice/tts")
async def voice_tts(req: TTSRequest):
    if not req.text:
        return {"error": "text is required"}
    try:
        if req.stream:
            from engine.voice.tts import synthesize_stream
            return StreamingResponse(
                synthesize_stream(req.text, voice=req.voice, model=req.model, api_key=_api_key),
                media_type="audio/mpeg",
                headers={"Content-Disposition": "inline; filename=tts.mp3"},
            )
        from engine.voice.tts import synthesize
        audio_path = await synthesize(
            req.text, voice=req.voice, model=req.model, api_key=_api_key
        )
        return {"status": "ok", "path": audio_path}
    except Exception as e:
        return {"error": str(e)}


@router.post("/voice/stt")
async def voice_stt(file: UploadFile = File(...)):
    try:
        from engine.voice.stt import transcribe
        audio_bytes = await file.read()
        text = await transcribe(audio_bytes=audio_bytes, api_key=_api_key)
        return STTResponse(text=text)
    except Exception as e:
        return {"error": str(e)}


@router.post("/voice/stt/path")
async def voice_stt_path(body: dict):
    audio_path = body.get("path", "")
    if not audio_path:
        return {"error": "path is required"}
    try:
        from engine.voice.stt import transcribe
        text = await transcribe(audio_path=audio_path, api_key=_api_key)
        return STTResponse(text=text)
    except Exception as e:
        return {"error": str(e)}
