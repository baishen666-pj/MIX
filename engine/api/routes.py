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
) -> None:
    global _agent_loop, _memory, _skill_registry, _skill_loader, _learning, _cron, _tools, _agent_router, _mcp, _api_key, _decomposer, _orchestrator, _metrics, _config
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
    if _config is None:
        raise HTTPException(503, "Config not initialized")
    from engine.config import MixConfig
    updated = MixConfig._from_dict(req)
    updated.save()
    global _config
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


# --- Agents ---

@router.get("/agents")
async def agents_list():
    from engine.agent.router import AgentRouter
    if _agent_router is None:
        return {"agents": [{"name": "main", "channels": [], "model": "default"}]}
    return {"agents": _agent_router.list_agents()}


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
