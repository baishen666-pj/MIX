"""RAG collection, document, and query endpoints."""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from engine.api.schemas import CollectionCreateRequest, RAGQueryRequest

log = logging.getLogger(__name__)

router = APIRouter()


@router.post("/rag/collections")
async def rag_create_collection(req: CollectionCreateRequest):
    from engine.api import routes as _pkg

    if _pkg._rag_collections is None:
        raise HTTPException(503, "RAG pipeline not initialized")
    coll = await _pkg._rag_collections.create_collection(
        name=req.name,
        description=req.description,
        embedding_model=req.embedding_model,
    )
    return {"status": "ok", "collection": {"id": coll.id, "name": coll.name}}


@router.get("/rag/collections")
async def rag_list_collections():
    from engine.api import routes as _pkg

    if _pkg._rag_collections is None:
        return {"collections": []}
    colls = await _pkg._rag_collections.list_collections()
    return {
        "collections": [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "document_count": c.document_count,
                "embedding_model": c.embedding_model,
            }
            for c in colls
        ]
    }


@router.get("/rag/collections/{collection_id}")
async def rag_get_collection(collection_id: str):
    from engine.api import routes as _pkg

    if _pkg._rag_collections is None:
        raise HTTPException(503, "Collection manager not initialized")
    coll = await _pkg._rag_collections.get_collection(collection_id)
    if coll is None:
        raise HTTPException(404, "Collection not found")
    return {
        "id": coll.id,
        "name": coll.name,
        "description": coll.description,
        "document_count": coll.document_count,
        "embedding_model": coll.embedding_model,
    }


@router.delete("/rag/collections/{collection_id}")
async def rag_delete_collection(collection_id: str):
    from engine.api import routes as _pkg

    if _pkg._rag_collections is None:
        raise HTTPException(503, "Collection manager not initialized")
    deleted = await _pkg._rag_collections.delete_collection(collection_id)
    if not deleted:
        raise HTTPException(404, "Collection not found")
    return {"status": "ok", "deleted": collection_id}


@router.post("/rag/collections/{collection_id}/documents")
async def rag_upload_document(collection_id: str, file: UploadFile = File(...)):
    from engine.api import routes as _pkg

    if _pkg._rag_pipeline is None:
        raise HTTPException(503, "RAG pipeline not initialized")
    from engine.memory.document_parser import extract_text

    suffix = Path(file.filename or "file.txt").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content_bytes = await file.read()
        tmp.write(content_bytes)
        tmp_path = tmp.name
    try:
        text = extract_text(tmp_path, mime_type=file.content_type or "")
        if not text.strip():
            raise HTTPException(400, "No text content extracted")
        result = await _pkg._rag_pipeline.ingest(
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
    from engine.api import routes as _pkg

    if _pkg._rag_collections is None:
        return {"documents": []}
    docs = await _pkg._rag_collections.list_documents(collection_id)
    return {
        "documents": [
            {
                "id": d.id,
                "filename": d.filename,
                "chunk_count": d.chunk_count,
                "size_bytes": d.size_bytes,
                "created_at": d.created_at,
            }
            for d in docs
        ]
    }


@router.delete("/rag/documents/{document_id}")
async def rag_delete_document(document_id: str):
    from engine.api import routes as _pkg

    if _pkg._rag_collections is None:
        raise HTTPException(503, "Collection manager not initialized")
    deleted = await _pkg._rag_collections.delete_document(document_id)
    if not deleted:
        raise HTTPException(404, "Document not found")
    return {"status": "ok", "deleted": document_id}


@router.post("/rag/query")
async def rag_query(req: RAGQueryRequest):
    from engine.api import routes as _pkg

    if _pkg._rag_pipeline is None:
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
    result = await _pkg._rag_pipeline.query(query)
    return {
        "answer": result.answer,
        "citations": result.citations,
        "retrieved_chunks": result.retrieved_chunks,
        "reranked_chunks": result.reranked_chunks,
        "latency_ms": round(result.latency_ms, 2),
    }
