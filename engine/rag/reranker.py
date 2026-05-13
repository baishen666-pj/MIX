from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

import logging

log = logging.getLogger("mix.reranker")


@dataclass
class RerankResult:
    index: int
    content: str
    relevance_score: float
    original_rank: int


class Reranker(Protocol):
    async def rerank(self, query: str, documents: list[str], top_k: int = 5) -> list[RerankResult]: ...


class SimpleReranker:
    """Keyword-based reranking using term frequency overlap."""

    async def rerank(self, query: str, documents: list[str], top_k: int = 5) -> list[RerankResult]:
        query_terms = set(query.lower().split())
        scored: list[tuple[int, str, float]] = []
        for i, doc in enumerate(documents):
            doc_terms = set(doc.lower().split())
            overlap = len(query_terms & doc_terms)
            score = overlap / max(len(query_terms), 1)
            scored.append((i, doc, score))

        scored.sort(key=lambda x: x[2], reverse=True)
        return [
            RerankResult(index=s[0], content=s[1], relevance_score=s[2], original_rank=s[0])
            for s in scored[:top_k]
        ]


class LLMReranker:
    """Uses LLM to score document relevance."""

    def __init__(self, provider: Any) -> None:
        self._provider = provider

    async def rerank(self, query: str, documents: list[str], top_k: int = 5) -> list[RerankResult]:
        if not documents:
            return []

        numbered = "\n".join(f"[{i}] {doc[:200]}" for i, doc in enumerate(documents))
        prompt = (
            f"Rate each document's relevance to the query on a scale of 0-10.\n"
            f"Query: {query}\n\n{numbered}\n\n"
            f"Respond with ONLY a JSON array of scores, e.g. [8, 3, 7]"
        )
        try:
            import json
            result = await self._provider.complete(
                messages=[{"role": "user", "content": prompt}],
            )
            content = result.get("content", "[]")
            scores = json.loads(content)
            if not isinstance(scores, list):
                scores = [float(scores)] * len(documents)
        except Exception:
            log.debug("LLM reranking failed, falling back to simple reranker")
            fallback = SimpleReranker()
            return await fallback.rerank(query, documents, top_k)

        scored = list(enumerate(zip(documents, scores)))
        scored.sort(key=lambda x: float(x[1][1]) if len(x[1]) > 1 else 0, reverse=True)
        return [
            RerankResult(
                index=s[0],
                content=s[1][0],
                relevance_score=float(s[1][1]) / 10.0 if len(s[1]) > 1 else 0,
                original_rank=s[0],
            )
            for s in scored[:top_k]
        ]
