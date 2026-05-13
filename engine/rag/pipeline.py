from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

from engine.memory.store import MemoryStore
from engine.rag.chunking import Chunker, ChunkingStrategy
from engine.rag.citations import CitationTracker
from engine.rag.collections import CollectionManager
from engine.rag.reranker import SimpleReranker

log = logging.getLogger("mix.rag_pipeline")


@dataclass
class RAGQuery:
    query: str
    collection_ids: list[str] | None = None
    top_k: int = 10
    rerank: bool = True
    rerank_top_k: int = 5
    include_citations: bool = True


@dataclass
class RAGResponse:
    answer: str
    citations: list[dict]
    retrieved_chunks: int
    reranked_chunks: int
    latency_ms: float


class RAGPipeline:
    def __init__(
        self,
        memory: MemoryStore,
        collections: CollectionManager,
        chunker: Chunker | None = None,
        reranker: Any = None,
        citations: CitationTracker | None = None,
        provider: Any = None,
    ) -> None:
        self._memory = memory
        self._collections = collections
        self._chunker = chunker or Chunker(ChunkingStrategy.RECURSIVE)
        self._reranker = reranker or SimpleReranker()
        self._citations = citations or CitationTracker(collections)
        self._provider = provider

    async def query(self, rag_query: RAGQuery) -> RAGResponse:
        start = time.monotonic()

        # Retrieve from memory
        memory_results = await self._memory.search(rag_query.query, limit=rag_query.top_k)

        chunks_with_scores: list[tuple[str, float, dict]] = []
        for entry in memory_results:
            meta = {}
            if hasattr(entry, "metadata") and isinstance(entry.metadata, dict):
                meta = entry.metadata
            chunks_with_scores.append((entry.content, 0.5, meta))

        retrieved_count = len(chunks_with_scores)

        # Rerank
        reranked_count = retrieved_count
        if rag_query.rerank and chunks_with_scores:
            docs = [c[0] for c in chunks_with_scores]
            reranked = await self._reranker.rerank(rag_query.query, docs, top_k=rag_query.rerank_top_k)
            reranked_chunks_with_scores = []
            for r in reranked:
                original = chunks_with_scores[r.index]
                reranked_chunks_with_scores.append((r.content, r.relevance_score, original[2]))
            chunks_with_scores = reranked_chunks_with_scores
            reranked_count = len(chunks_with_scores)

        # Build context
        context_parts = [f"[{i + 1}] {c[0]}" for i, c in enumerate(chunks_with_scores)]
        context_text = "\n\n".join(context_parts) if context_parts else "No relevant documents found."

        # Generate answer
        if self._provider:
            prompt = (
                f"Answer the question based on the following context.\n\n"
                f"Context:\n{context_text}\n\n"
                f"Question: {rag_query.query}\n\n"
                f"Answer (cite sources as [1], [2], etc.):"
            )
            result = await self._provider.complete(
                messages=[{"role": "user", "content": prompt}],
            )
            answer = result.get("content", "")
        else:
            answer = context_text

        # Build citations
        citation_dicts = []
        if rag_query.include_citations:
            citations = await self._citations.build_citations(chunks_with_scores)
            citation_dicts = [
                {
                    "document_id": c.document_id,
                    "document_name": c.document_name,
                    "collection_id": c.collection_id,
                    "chunk_index": c.chunk_index,
                    "content": c.content[:200],
                    "relevance_score": c.relevance_score,
                }
                for c in citations
            ]

        latency_ms = (time.monotonic() - start) * 1000

        return RAGResponse(
            answer=answer,
            citations=citation_dicts,
            retrieved_chunks=retrieved_count,
            reranked_chunks=reranked_count,
            latency_ms=latency_ms,
        )

    async def ingest(
        self,
        collection_id: str,
        content: str,
        filename: str,
        mime_type: str = "text/plain",
        metadata: dict | None = None,
        chunk_size: int = 500,
        overlap: int = 50,
    ) -> dict:
        chunks = self._chunker.chunk(content, metadata=metadata, chunk_size=chunk_size, overlap=overlap)
        doc = await self._collections.add_document(
            collection_id=collection_id,
            filename=filename,
            mime_type=mime_type,
            content=content,
            chunk_count=len(chunks),
            metadata=metadata,
        )
        from engine.memory.types import MemoryEntry, MemoryType

        for chunk in chunks:
            chunk_meta = dict(chunk.metadata)
            chunk_meta["document_id"] = doc.id
            chunk_meta["collection_id"] = collection_id
            chunk_meta["filename"] = filename
            chunk_meta["chunk_index"] = chunk.index
            entry = MemoryEntry(
                type=MemoryType.CONTEXT,
                content=chunk.content,
                tags=["rag", f"collection:{collection_id}"],
                source=filename,
            )
            if hasattr(entry, "metadata"):
                entry.metadata = chunk_meta
            await self._memory.store(entry)

        log.info("Ingested %s: %d chunks into collection %s", filename, len(chunks), collection_id)
        return {
            "document_id": doc.id,
            "chunks_created": len(chunks),
            "collection_id": collection_id,
        }
