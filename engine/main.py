from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from engine.agent.bus import AgentBus
from engine.agent.collaboration import CollaborationEngine
from engine.agent.decomposer import TaskDecomposer
from engine.agent.loop import AgentLoop
from engine.agent.orchestrator import TaskOrchestrator
from engine.agent.router import AgentRouter
from engine.api.routes import init_routes, router
from engine.config import MixConfig
from engine.learning.loop import LearningLoop
from engine.learning.nudge import CronScheduler
from engine.mcp.client import MCPClient
from engine.memory.store import MemoryStore
from engine.middleware.api_key_auth import ApiKeyMiddleware
from engine.middleware.rate_limit import RateLimiter, RateLimitMiddleware
from engine.middleware.request_logging import RequestLoggingMiddleware
from engine.monitoring.metrics import MetricsCollector
from engine.rag.chunking import Chunker, ChunkingStrategy
from engine.rag.citations import CitationTracker
from engine.rag.collections import CollectionManager
from engine.rag.pipeline import RAGPipeline
from engine.rag.reranker import SimpleReranker
from engine.skills.marketplace import MarketplaceIndex
from engine.skills.plugin_context import PluginContext
from engine.skills.registry import SkillRegistry
from engine.skills.watcher import SkillWatcher
from engine.tools.approval import ApprovalManager
from engine.tools.dynamic import DynamicToolRegistry
from engine.tools.history import ToolHistory
from engine.tools.registry import ToolRegistry

log = logging.getLogger("mix")


def create_app(config: MixConfig | None = None) -> FastAPI:
    config = config or MixConfig.load()

    memory = MemoryStore(config.memory.db_path)
    tools = ToolRegistry()
    dynamic_tools = DynamicToolRegistry()
    approval = ApprovalManager(auto_approve_safe=True)
    history = ToolHistory()
    tools.set_dynamic_registry(dynamic_tools)
    tools.set_approval_manager(approval)
    tools.set_history(history)
    agent_loop = AgentLoop(config, memory=memory, tools=tools)
    skill_registry = SkillRegistry(skills_dir=Path("skills"))
    skill_count = skill_registry.load_all()
    learning = LearningLoop(memory, skill_registry)
    cron = CronScheduler(persist_path=config.memory.db_path.parent / "cron_jobs.json")
    agent_router = AgentRouter(config, memory)
    mcp = MCPClient()
    bus = AgentBus()
    decomposer = TaskDecomposer(provider=agent_loop.provider)
    orchestrator = TaskOrchestrator()
    collaboration = CollaborationEngine(bus, agent_router, memory)
    metrics = MetricsCollector()
    skill_watcher = SkillWatcher(Path("skills"), skill_registry)
    PluginContext(config=config, memory=memory, tools=tools, skill_registry=skill_registry)
    marketplace = MarketplaceIndex()
    marketplace.load()

    rag_collections: CollectionManager | None = None
    rag_pipeline: RAGPipeline | None = None

    # Phase 1: register routes with core dependencies (config, agents, tools)
    init_routes(
        agent_loop,
        memory,
        skill_registry,
        learning,
        cron,
        agent_router,
        mcp,
        api_key=config.llm.api_key,
        decomposer=decomposer,
        orchestrator=orchestrator,
        metrics=metrics,
        config=config,
        collaboration=collaboration,
        marketplace=marketplace,
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        nonlocal rag_collections, rag_pipeline
        config.memory.db_path.parent.mkdir(parents=True, exist_ok=True)
        await memory.connect()
        rag_collections = CollectionManager(memory._db)
        await rag_collections.initialize()
        rag_pipeline = RAGPipeline(
            memory=memory,
            collections=rag_collections,
            chunker=Chunker(ChunkingStrategy.RECURSIVE),
            reranker=SimpleReranker(),
            citations=CitationTracker(rag_collections),
            provider=agent_loop.provider,
        )
        # Phase 2: re-register routes with async-initialized RAG components
        init_routes(
            agent_loop,
            memory,
            skill_registry,
            learning,
            cron,
            agent_router,
            mcp,
            api_key=config.llm.api_key,
            decomposer=decomposer,
            orchestrator=orchestrator,
            metrics=metrics,
            config=config,
            collaboration=collaboration,
            rag_collections=rag_collections,
            rag_pipeline=rag_pipeline,
            marketplace=marketplace,
        )
        cron.start()
        await skill_watcher.start()
        if skill_count > 0:
            log.info("Loaded %d skill(s)", skill_count)
        log.info("Tools: %s", ", ".join(tools.list_tools()))
        log.info("Agent router, MCP client, learning loop, and cron started")
        yield
        await skill_watcher.stop()
        cron.stop()
        await memory.flush()
        await memory.close()

    app = FastAPI(title="MIX Engine", version="0.1.0", lifespan=lifespan)

    if config.security.engine_api_key:
        app.add_middleware(ApiKeyMiddleware, api_key=config.security.engine_api_key)
        log.info("Engine API key authentication enabled")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.security.cors_origins,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.add_middleware(RequestLoggingMiddleware)

    if config.rate_limit.enabled:
        limiter = RateLimiter(
            requests_per_minute=config.rate_limit.requests_per_minute,
            requests_per_hour=config.rate_limit.requests_per_hour,
        )
        app.add_middleware(RateLimitMiddleware, limiter=limiter)
        log.info(
            "Rate limiting enabled: %d/min, %d/hour",
            config.rate_limit.requests_per_minute,
            config.rate_limit.requests_per_hour,
        )

    app.include_router(router, prefix="/api")

    return app


app = create_app()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
    config = MixConfig.load()
    application = create_app(config)
    uvicorn.run(
        application,
        host=config.engine.host,
        port=config.engine.port,
        log_level="debug" if config.engine.debug else "info",
    )


if __name__ == "__main__":
    main()
