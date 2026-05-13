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


class DecomposeRequest(BaseModel):
    task: str
    max_subtasks: int = 5


class OrchestrateRequest(BaseModel):
    task: str


class HealthResponse(BaseModel):
    status: str
    version: str
    engine: str


class TTSRequest(BaseModel):
    text: str
    voice: str = "alloy"
    model: str = "tts-1"
    stream: bool = False


class STTResponse(BaseModel):
    text: str


class ModelRouteRequest(BaseModel):
    message: str
    tier: str | None = None


class ModelRouteResponse(BaseModel):
    tier: str
    provider: str
    model: str
    context_window: int
    max_output_tokens: int


# --- Multi-Agent Collaboration ---

class AgentCreateRequest(BaseModel):
    name: str
    role: str = "general"
    channels: list[str] | None = None
    allowed_users: list[str] | None = None
    model_tier: str | None = None
    system_prompt_override: str | None = None


class AgentUpdateRequest(BaseModel):
    channels: list[str] | None = None
    allowed_users: list[str] | None = None
    system_prompt: str | None = None
    role: str | None = None


class AgentResponse(BaseModel):
    name: str
    role: str
    channels: list[str]
    allowed_users: list[str]
    model: str
    system_prompt: str
    status: str = "active"


class CollaborateRequest(BaseModel):
    task: str
    pattern: str = "sequential"
    max_rounds: int = 3
    agents: list[str] | None = None


class CollaborationStatusResponse(BaseModel):
    id: str
    pattern: str
    task: str
    status: str
    steps: list[dict]
    result: dict | None = None


# --- Tool Enhancement ---

class DynamicToolRegisterRequest(BaseModel):
    name: str
    description: str
    parameters: dict
    handler_code: str
    examples: list[dict] | None = None
    constraints: dict | None = None
    danger_level: str = "safe"


class ToolChainCreateRequest(BaseModel):
    name: str
    description: str
    steps: list[dict]
    output_key: str = ""


class ApprovalActionRequest(BaseModel):
    request_id: str
    action: str
    reason: str | None = None


# --- RAG ---

class CollectionCreateRequest(BaseModel):
    name: str
    description: str = ""
    embedding_model: str = "all-MiniLM-L6-v2"


class RAGQueryRequest(BaseModel):
    query: str
    collection_ids: list[str] | None = None
    top_k: int = 10
    rerank: bool = True
    rerank_top_k: int = 5
    include_citations: bool = True
