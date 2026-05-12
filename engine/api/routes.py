from __future__ import annotations

import json
from typing import Any, AsyncIterator

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
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
)
from engine.agent.loop import AgentLoop
from engine.memory.store import MemoryStore
from engine.memory.types import MemoryType
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
) -> None:
    global _agent_loop, _memory, _skill_registry, _skill_loader, _learning, _cron, _tools, _agent_router, _mcp, _api_key, _decomposer, _orchestrator, _metrics
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


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        version="0.1.0",
        engine="mix-python",
    )


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
async def voice_tts(body: dict):
    text = body.get("text", "")
    if not text:
        return {"error": "text is required"}
    try:
        from engine.voice.tts import synthesize
        audio_path = await synthesize(
            text, voice=body.get("voice", "alloy"), api_key=_api_key
        )
        return {"status": "ok", "path": audio_path}
    except Exception as e:
        return {"error": str(e)}


@router.post("/voice/stt")
async def voice_stt(body: dict):
    audio_path = body.get("path", "")
    if not audio_path:
        return {"error": "path is required"}
    try:
        from engine.voice.stt import transcribe
        text = await transcribe(audio_path, api_key=_api_key)
        return {"status": "ok", "text": text}
    except Exception as e:
        return {"error": str(e)}
