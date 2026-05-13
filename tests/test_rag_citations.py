"""Comprehensive tests for engine.rag.citations module.

Covers CitationTracker.build_citations and format_response_with_citations
with edge cases: empty input, missing metadata, page_number, sections,
no-citations response, and multiple citations.
"""

from __future__ import annotations

import pytest

from engine.rag.citations import Citation, CitationTracker, CitedResponse

# ---------------------------------------------------------------------------
# Citation dataclass
# ---------------------------------------------------------------------------


class TestCitation:
    """Tests for the Citation dataclass."""

    def test_required_fields(self):
        citation = Citation(
            document_id="d1",
            document_name="test.txt",
            collection_id="c1",
            collection_name="docs",
            chunk_index=0,
            content="some content",
            relevance_score=0.85,
        )

        assert citation.document_id == "d1"
        assert citation.document_name == "test.txt"
        assert citation.collection_id == "c1"
        assert citation.collection_name == "docs"
        assert citation.chunk_index == 0
        assert citation.content == "some content"
        assert citation.relevance_score == 0.85

    def test_optional_fields_default_to_none(self):
        citation = Citation(
            document_id="d1",
            document_name="test.txt",
            collection_id="c1",
            collection_name="docs",
            chunk_index=0,
            content="content",
            relevance_score=0.5,
        )

        assert citation.page_number is None
        assert citation.section is None

    def test_optional_fields_can_be_set(self):
        citation = Citation(
            document_id="d1",
            document_name="report.pdf",
            collection_id="c1",
            collection_name="docs",
            chunk_index=3,
            content="page content",
            relevance_score=0.92,
            page_number=42,
            section="Appendix A",
        )

        assert citation.page_number == 42
        assert citation.section == "Appendix A"


# ---------------------------------------------------------------------------
# CitedResponse dataclass
# ---------------------------------------------------------------------------


class TestCitedResponse:
    """Tests for the CitedResponse dataclass."""

    def test_fields(self):
        response = CitedResponse(
            answer="The sky is blue.",
            citations=[],
            confidence=0.9,
        )

        assert response.answer == "The sky is blue."
        assert response.citations == []
        assert response.confidence == 0.9


# ---------------------------------------------------------------------------
# CitationTracker.build_citations
# ---------------------------------------------------------------------------


class TestBuildCitations:
    """Tests for CitationTracker.build_citations."""

    @pytest.mark.asyncio
    async def test_empty_input_returns_empty_list(self):
        tracker = CitationTracker(None)
        citations = await tracker.build_citations([])

        assert citations == []

    @pytest.mark.asyncio
    async def test_single_chunk_with_full_metadata(self):
        tracker = CitationTracker(None)
        chunks_with_scores = [
            (
                "The answer is 42",
                0.95,
                {
                    "document_id": "doc1",
                    "filename": "guide.pdf",
                    "collection_id": "coll1",
                    "collection_name": "knowledge",
                    "chunk_index": 5,
                    "page_number": 12,
                    "section": "Chapter 3",
                },
            ),
        ]

        citations = await tracker.build_citations(chunks_with_scores)

        assert len(citations) == 1
        c = citations[0]
        assert c.document_id == "doc1"
        assert c.document_name == "guide.pdf"
        assert c.collection_id == "coll1"
        assert c.collection_name == "knowledge"
        assert c.chunk_index == 5
        assert c.relevance_score == 0.95
        assert c.page_number == 12
        assert c.section == "Chapter 3"

    @pytest.mark.asyncio
    async def test_multiple_chunks_order_preserved(self):
        tracker = CitationTracker(None)
        chunks_with_scores = [
            ("content A", 0.9, {"document_id": "d1", "filename": "a.txt", "collection_id": "c1"}),
            ("content B", 0.7, {"document_id": "d2", "filename": "b.txt", "collection_id": "c1"}),
            ("content C", 0.5, {"document_id": "d3", "filename": "c.txt", "collection_id": "c2"}),
        ]

        citations = await tracker.build_citations(chunks_with_scores)

        assert len(citations) == 3
        assert citations[0].document_name == "a.txt"
        assert citations[0].relevance_score == 0.9
        assert citations[1].document_name == "b.txt"
        assert citations[1].relevance_score == 0.7
        assert citations[2].document_name == "c.txt"
        assert citations[2].relevance_score == 0.5

    @pytest.mark.asyncio
    async def test_missing_metadata_uses_defaults(self):
        tracker = CitationTracker(None)
        chunks_with_scores = [
            ("some content", 0.6, {}),
        ]

        citations = await tracker.build_citations(chunks_with_scores)

        assert len(citations) == 1
        c = citations[0]
        assert c.document_id == ""
        assert c.document_name == "unknown"
        assert c.collection_id == ""
        assert c.collection_name == ""
        assert c.chunk_index == 0
        assert c.page_number is None
        assert c.section is None

    @pytest.mark.asyncio
    async def test_partial_metadata(self):
        tracker = CitationTracker(None)
        chunks_with_scores = [
            ("content", 0.8, {"document_id": "d1", "filename": "file.txt"}),
        ]

        citations = await tracker.build_citations(chunks_with_scores)

        c = citations[0]
        assert c.document_id == "d1"
        assert c.document_name == "file.txt"
        assert c.collection_id == ""
        assert c.page_number is None

    @pytest.mark.asyncio
    async def test_relevance_score_zero(self):
        tracker = CitationTracker(None)
        chunks_with_scores = [
            ("irrelevant content", 0.0, {"document_id": "d1", "filename": "f.txt", "collection_id": "c1"}),
        ]

        citations = await tracker.build_citations(chunks_with_scores)

        assert citations[0].relevance_score == 0.0

    @pytest.mark.asyncio
    async def test_relevance_score_one(self):
        tracker = CitationTracker(None)
        chunks_with_scores = [
            ("perfect match", 1.0, {"document_id": "d1", "filename": "f.txt", "collection_id": "c1"}),
        ]

        citations = await tracker.build_citations(chunks_with_scores)

        assert citations[0].relevance_score == 1.0


# ---------------------------------------------------------------------------
# CitationTracker.format_response_with_citations
# ---------------------------------------------------------------------------


class TestFormatResponseWithCitations:
    """Tests for CitationTracker.format_response_with_citations."""

    def test_no_citations_returns_answer_only(self):
        tracker = CitationTracker(None)
        response = CitedResponse(
            answer="Simple answer",
            citations=[],
            confidence=0.5,
        )

        result = tracker.format_response_with_citations(response)

        assert result == "Simple answer"
        assert "Sources" not in result

    def test_single_citation_with_section(self):
        tracker = CitationTracker(None)
        response = CitedResponse(
            answer="The answer is 42.",
            citations=[
                Citation(
                    document_id="d1",
                    document_name="guide.txt",
                    collection_id="c1",
                    collection_name="docs",
                    chunk_index=0,
                    content="42 is the answer",
                    relevance_score=0.95,
                    section="Chapter 1",
                ),
            ],
            confidence=0.9,
        )

        result = tracker.format_response_with_citations(response)

        assert "The answer is 42." in result
        assert "**Sources:**" in result
        assert "[1] guide.txt" in result
        assert "Chapter 1" in result
        assert "0.95" in result

    def test_multiple_citations_numbered(self):
        tracker = CitationTracker(None)
        response = CitedResponse(
            answer="Multiple sources confirm this.",
            citations=[
                Citation(
                    document_id="d1",
                    document_name="alpha.txt",
                    collection_id="c1",
                    collection_name="docs",
                    chunk_index=0,
                    content="source 1",
                    relevance_score=0.9,
                ),
                Citation(
                    document_id="d2",
                    document_name="beta.txt",
                    collection_id="c1",
                    collection_name="docs",
                    chunk_index=1,
                    content="source 2",
                    relevance_score=0.7,
                ),
            ],
            confidence=0.8,
        )

        result = tracker.format_response_with_citations(response)

        assert "[1] alpha.txt" in result
        assert "[2] beta.txt" in result
        assert "0.90" in result
        assert "0.70" in result

    def test_citation_without_section_omits_section(self):
        tracker = CitationTracker(None)
        response = CitedResponse(
            answer="Answer text.",
            citations=[
                Citation(
                    document_id="d1",
                    document_name="nospace.txt",
                    collection_id="c1",
                    collection_name="docs",
                    chunk_index=0,
                    content="content",
                    relevance_score=0.6,
                ),
            ],
            confidence=0.6,
        )

        result = tracker.format_response_with_citations(response)

        assert "[1] nospace.txt" in result
        assert "0.60" in result
        # The section separator " -- " should not appear for section=None
        assert " -- " not in result

    def test_citation_with_page_number_in_metadata(self):
        """Verify that page_number is stored in Citation but format only shows section."""
        tracker = CitationTracker(None)
        response = CitedResponse(
            answer="See page 5.",
            citations=[
                Citation(
                    document_id="d1",
                    document_name="report.pdf",
                    collection_id="c1",
                    collection_name="docs",
                    chunk_index=0,
                    content="page 5 content",
                    relevance_score=0.88,
                    page_number=5,
                    section="Introduction",
                ),
            ],
            confidence=0.88,
        )

        result = tracker.format_response_with_citations(response)

        assert "report.pdf" in result
        assert "Introduction" in result
        assert "0.88" in result
        # The Citation object stores page_number
        assert response.citations[0].page_number == 5

    def test_format_score_precision(self):
        """Scores are formatted to 2 decimal places."""
        tracker = CitationTracker(None)
        response = CitedResponse(
            answer="text",
            citations=[
                Citation(
                    document_id="d1",
                    document_name="f.txt",
                    collection_id="c1",
                    collection_name="docs",
                    chunk_index=0,
                    content="c",
                    relevance_score=0.123456,
                ),
            ],
            confidence=0.5,
        )

        result = tracker.format_response_with_citations(response)

        assert "0.12" in result
