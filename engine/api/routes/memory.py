"""Memory store, search, ingest, and upload endpoints."""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from engine.api.schemas import MemoryEntryResponse, MemorySearchRequest
from engine.memory.document_parser import extract_text
from engine.memory.types import MemoryEntry, MemoryType

log = logging.getLogger(__name__)

router = APIRouter()


@router.post("/memory/search", response_model=list[MemoryEntryResponse])
async def memory_search(req: MemorySearchRequest):
    from engine.api import routes as _pkg

    if _pkg._memory is None:
        raise HTTPException(503, "Memory store not initialized")
    entries = await _pkg._memory.search(req.query, limit=req.limit)
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
    from engine.api import routes as _pkg

    if _pkg._memory is None:
        raise HTTPException(503, "Memory store not initialized")
    entry = await _pkg._memory.get(entry_id)
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
    from engine.api import routes as _pkg

    if _pkg._memory is None:
        raise HTTPException(503, "Memory store not initialized")
    deleted = await _pkg._memory.delete(entry_id)
    return {"deleted": deleted}


@router.post("/memory")
async def memory_create(body: dict):
    from engine.api import routes as _pkg

    if _pkg._memory is None:
        raise HTTPException(503, "Memory store not initialized")
    content = body.get("content", "")
    if not content:
        raise HTTPException(400, "content is required")
    entry = MemoryEntry(
        type=MemoryType(body.get("type", "context")),
        content=content,
        tags=body.get("tags", []),
        source=body.get("source", "api"),
    )
    await _pkg._memory.store(entry)
    return {"status": "ok", "id": entry.id}


@router.post("/memory/ingest")
async def memory_ingest(body: dict):
    from engine.api import routes as _pkg

    if _pkg._memory is None:
        raise HTTPException(503, "Memory store not initialized")
    text = body.get("text", "")
    if not text:
        raise HTTPException(400, "text is required")
    chunk_size = body.get("chunk_size", 500)
    source = body.get("source", "")
    ids = await _pkg._memory.ingest_document(text, chunk_size=int(chunk_size), source=source)
    return {"status": "ok", "chunks_created": len(ids), "ids": ids}


@router.post("/memory/upload")
async def memory_upload(file: UploadFile = File(...)):
    from engine.api import routes as _pkg

    if _pkg._memory is None:
        raise HTTPException(503, "Memory store not initialized")
    suffix = Path(file.filename or "file.txt").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        text = extract_text(tmp_path, mime_type=file.content_type or "")
        if not text.strip():
            raise HTTPException(400, "No text content extracted from file")
        ids = await _pkg._memory.ingest_document(text, source=file.filename or "upload")
        return {"status": "ok", "filename": file.filename, "chunks_created": len(ids)}
    finally:
        os.unlink(tmp_path)
