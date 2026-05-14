"""Standalone mock MIX engine for performance testing.

No imports from engine/ — fully self-contained FastAPI app with predictable responses.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="MIX Mock Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Configurable defaults (overridable via CLI) --

CHAT_DELAY_MS: int = 50
STREAM_CHUNKS: int = 5
STREAM_CHUNK_DELAY_MS: int = 20

# -- Static fixtures --

MARKETPLACE_ENTRIES: list[dict[str, Any]] = [
    {
        "id": f"plugin-{i:03d}",
        "name": name,
        "description": f"A {cat} plugin for {name.lower()}",
        "version": "1.0.0",
        "author": "MIX Team",
        "category": cat,
        "tags": [cat, "automation"],
        "source_url": f"https://github.com/mix-skills/{f'plugin-{i:03d}'}",
        "license": "MIT",
        "handler": "python",
        "triggers": [f"/{name.lower().replace(' ', '-')}"],
        "installed": False,
    }
    for i, (name, cat) in enumerate(
        [
            ("Weather Fetcher", "utilities"),
            ("Web Scraper", "data"),
            ("Code Executor", "developer"),
            ("PDF Reader", "utilities"),
            ("Memory Search", "ai"),
            ("Task Scheduler", "automation"),
            ("Email Sender", "communication"),
            ("File Manager", "utilities"),
            ("Calculator", "developer"),
            ("Translation", "communication"),
            ("Image Generator", "ai"),
            ("Database Query", "data"),
            ("SSH Remote", "developer"),
            ("Calendar Sync", "productivity"),
            ("Note Taker", "productivity"),
            ("API Tester", "developer"),
            ("Log Analyzer", "data"),
            ("Notification Hub", "communication"),
            ("Backup Tool", "utilities"),
            ("Graph Builder", "data"),
            ("Text Summarizer", "ai"),
            ("Spell Checker", "utilities"),
            ("JSON Formatter", "developer"),
            ("Git Helper", "developer"),
            ("Regex Tester", "developer"),
            ("Markdown Converter", "utilities"),
            ("Color Picker", "utilities"),
            ("QR Generator", "utilities"),
            ("Hash Calculator", "utilities"),
            ("Diff Viewer", "developer"),
            ("Cron Manager", "automation"),
            ("Env Checker", "developer"),
            ("Port Scanner", "developer"),
            ("DNS Lookup", "utilities"),
            ("SSL Checker", "utilities"),
            ("HTTP Client", "developer"),
            ("WebSocket Tester", "developer"),
            ("Auth Manager", "utilities"),
            ("Cache Manager", "utilities"),
            ("Queue Monitor", "automation"),
            ("Health Checker", "utilities"),
            ("Metrics Collector", "data"),
            ("Alert Manager", "communication"),
            ("Config Validator", "utilities"),
            ("Schema Generator", "developer"),
            ("Migration Runner", "developer"),
            ("Seed Manager", "data"),
            ("Fixture Loader", "data"),
            ("Test Runner", "developer"),
        ],
        start=1,
    )
]

MEMORY_RESULTS: list[dict[str, Any]] = [
    {
        "id": f"mem-{i}",
        "type": "note",
        "content": f"Performance test memory entry {i}: This is a sample memory with enough text to be realistic for search.",
        "tags": ["test", "perf"],
        "created_at": "2026-05-14T12:00:00Z",
    }
    for i in range(5)
]

CATEGORIES = sorted({e["category"] for e in MARKETPLACE_ENTRIES})


# -- Schemas --


class ChatRequest(BaseModel):
    message: str
    session_id: str = "perf-test"


class MemorySearchRequest(BaseModel):
    query: str
    limit: int = 10


# -- Endpoints --


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0", "engine": "mix-python"}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if CHAT_DELAY_MS > 0:
        await asyncio.sleep(CHAT_DELAY_MS / 1000)
    return {
        "id": f"resp-{uuid.uuid4().hex[:8]}",
        "session_id": req.session_id,
        "content": "This is a mock LLM response for performance testing. It contains enough text to simulate a typical AI assistant reply of moderate length.",
        "tool_calls": None,
        "metadata": None,
    }


@app.get("/api/chat/stream")
async def chat_stream(message: str = "perf test", session_id: str = "perf-stream"):
    from starlette.responses import StreamingResponse

    async def generate():
        for i in range(STREAM_CHUNKS):
            chunk = {
                "id": f"chunk-{i}",
                "session_id": session_id,
                "delta": f"Mock streaming chunk {i + 1} of {STREAM_CHUNKS}. ",
                "done": False,
            }
            yield f"data: {__import__('json').dumps(chunk)}\n\n"
            if STREAM_CHUNK_DELAY_MS > 0:
                await asyncio.sleep(STREAM_CHUNK_DELAY_MS / 1000)
        done_chunk = {"id": "done", "session_id": session_id, "delta": "", "done": True}
        yield f"data: {__import__('json').dumps(done_chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/api/plugins/marketplace")
async def marketplace_list(q: str = "", category: str = "", tags: str = ""):
    entries = MARKETPLACE_ENTRIES
    if category:
        entries = [e for e in entries if e["category"] == category]
    if q:
        ql = q.lower()
        entries = [e for e in entries if ql in e["name"].lower() or ql in e["description"].lower()]
    return {"entries": entries, "categories": CATEGORIES}


@app.get("/api/plugins/marketplace/{entry_id}")
async def marketplace_detail(entry_id: str):
    for e in MARKETPLACE_ENTRIES:
        if e["id"] == entry_id:
            return {**e, "installed": False}
    return {"error": "Not found"}, 404


@app.post("/api/memory/search")
async def memory_search(req: MemorySearchRequest):
    return {"results": MEMORY_RESULTS[: req.limit], "total": len(MEMORY_RESULTS)}


@app.get("/api/metrics")
async def metrics():
    return {
        "uptime_seconds": 3600,
        "requests": {"total": 10000, "errors": 5},
        "llm": {"calls": 5000, "tokens_in": 50000, "tokens_out": 100000},
        "sessions": {"active": 10, "total": 500},
        "memory": {"entries": 1000, "searches": 2000},
    }


# -- CLI --


def main():
    import argparse

    parser = argparse.ArgumentParser(description="MIX Mock Engine for Performance Testing")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18700)
    parser.add_argument("--chat-delay-ms", type=int, default=50)
    parser.add_argument("--stream-chunks", type=int, default=5)
    parser.add_argument("--stream-chunk-delay-ms", type=int, default=20)
    args = parser.parse_args()

    global CHAT_DELAY_MS, STREAM_CHUNKS, STREAM_CHUNK_DELAY_MS
    CHAT_DELAY_MS = args.chat_delay_ms
    STREAM_CHUNKS = args.stream_chunks
    STREAM_CHUNK_DELAY_MS = args.stream_chunk_delay_ms

    print(f"Mock engine starting on {args.host}:{args.port}")
    print(f"  chat delay: {CHAT_DELAY_MS}ms, stream: {STREAM_CHUNKS} chunks × {STREAM_CHUNK_DELAY_MS}ms")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
