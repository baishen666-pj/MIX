from __future__ import annotations

import logging
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from engine.agent.loop import AgentLoop
from engine.api.routes import router, init_routes
from engine.config import MixConfig
from engine.memory.store import MemoryStore
from engine.skills.registry import SkillRegistry
from engine.learning.loop import LearningLoop
from engine.learning.nudge import CronScheduler

log = logging.getLogger("mix")


def create_app(config: MixConfig | None = None) -> FastAPI:
    config = config or MixConfig.load()
    app = FastAPI(title="MIX Engine", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    memory = MemoryStore(config.memory.db_path)
    agent_loop = AgentLoop(config, memory=memory)
    skill_registry = SkillRegistry(skills_dir=Path("skills"))
    skill_count = skill_registry.load_all()
    learning = LearningLoop(memory, skill_registry)
    cron = CronScheduler()

    init_routes(agent_loop, memory, skill_registry, learning, cron)
    app.include_router(router, prefix="/api")

    @app.on_event("startup")
    async def startup():
        config.memory.db_path.parent.mkdir(parents=True, exist_ok=True)
        await memory.connect()
        cron.start()
        if skill_count > 0:
            log.info("Loaded %d skill(s)", skill_count)
        log.info("Learning loop and cron scheduler started")

    @app.on_event("shutdown")
    async def shutdown():
        cron.stop()
        await memory.close()

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
