from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

log = logging.getLogger("mix.citations")


@dataclass
class Citation:
    document_id: str
    document_name: str
    collection_id: str
    collection_name: str
    chunk_index: int
    content: str
    relevance_score: float
    page_number: int | None = None
    section: str | None = None


@dataclass
class CitedResponse:
    answer: str
    citations: list[Citation]
    confidence: float


class CitationTracker:
    def __init__(self, collection_manager: Any) -> None:
        self._collections = collection_manager

    async def build_citations(
        self,
        chunks_with_scores: list[tuple[str, float, dict]],
    ) -> list[Citation]:
        citations = []
        for content, score, metadata in chunks_with_scores:
            doc_id = metadata.get("document_id", "")
            doc_name = metadata.get("filename", "unknown")
            coll_id = metadata.get("collection_id", "")
            coll_name = metadata.get("collection_name", "")
            citations.append(
                Citation(
                    document_id=doc_id,
                    document_name=doc_name,
                    collection_id=coll_id,
                    collection_name=coll_name,
                    chunk_index=metadata.get("chunk_index", 0),
                    content=content,
                    relevance_score=score,
                    page_number=metadata.get("page_number"),
                    section=metadata.get("section"),
                )
            )
        return citations

    def format_response_with_citations(self, response: CitedResponse) -> str:
        text = response.answer
        if not response.citations:
            return text

        text += "\n\n---\n**Sources:**\n"
        for i, citation in enumerate(response.citations, 1):
            text += f"\n[{i}] {citation.document_name}"
            if citation.section:
                text += f" — {citation.section}"
            text += f" (relevance: {citation.relevance_score:.2f})"
        return text
