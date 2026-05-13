"""Comprehensive tests for engine.rag.reranker module.

Covers SimpleReranker scoring, tie-breaking, top_k boundary cases,
empty inputs, single-term queries, and score normalization.
"""

from __future__ import annotations

import pytest

from engine.rag.reranker import RerankResult, SimpleReranker

# ---------------------------------------------------------------------------
# RerankResult dataclass
# ---------------------------------------------------------------------------


class TestRerankResult:
    """Tests for the RerankResult dataclass."""

    def test_fields(self):
        result = RerankResult(
            index=2,
            content="doc text",
            relevance_score=0.75,
            original_rank=2,
        )
        assert result.index == 2
        assert result.content == "doc text"
        assert result.relevance_score == 0.75
        assert result.original_rank == 2


# ---------------------------------------------------------------------------
# SimpleReranker
# ---------------------------------------------------------------------------


class TestSimpleReranker:
    @pytest.mark.asyncio
    async def test_rerank_returns_results_sorted_by_score_desc(self):
        reranker = SimpleReranker()
        docs = [
            "Python is a programming language",
            "The cat sat on the mat",
            "Python web framework tutorial",
            "Java is also a programming language",
        ]

        results = await reranker.rerank("Python programming", docs, top_k=4)

        scores = [r.relevance_score for r in results]
        assert scores == sorted(scores, reverse=True)

    @pytest.mark.asyncio
    async def test_rerank_top_most_relevant_first(self):
        reranker = SimpleReranker()
        docs = [
            "Unrelated content about weather",
            "Python programming tutorial for beginners",
        ]

        results = await reranker.rerank("Python programming", docs, top_k=2)

        assert results[0].content == "Python programming tutorial for beginners"
        assert results[0].relevance_score > results[1].relevance_score

    @pytest.mark.asyncio
    async def test_rerank_top_k_limits_results(self):
        reranker = SimpleReranker()
        docs = [f"document {i}" for i in range(10)]

        results = await reranker.rerank("document", docs, top_k=3)

        assert len(results) == 3

    @pytest.mark.asyncio
    async def test_rerank_top_k_exceeds_documents(self):
        reranker = SimpleReranker()
        docs = ["only one doc"]

        results = await reranker.rerank("test", docs, top_k=10)

        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_rerank_empty_documents_returns_empty(self):
        reranker = SimpleReranker()

        results = await reranker.rerank("query", [], top_k=5)

        assert results == []

    @pytest.mark.asyncio
    async def test_rerank_empty_query_returns_zero_scores(self):
        reranker = SimpleReranker()
        docs = ["some document text", "another document"]

        results = await reranker.rerank("", docs, top_k=2)

        assert len(results) == 2
        for r in results:
            assert r.relevance_score == 0.0

    @pytest.mark.asyncio
    async def test_rerank_single_term_query(self):
        reranker = SimpleReranker()
        docs = [
            "The quick brown fox",
            "fox jumps over the lazy dog",
            "A completely unrelated text",
        ]

        results = await reranker.rerank("fox", docs, top_k=3)

        # Both docs mentioning "fox" should have score 1.0
        fox_docs = [r for r in results if "fox" in r.content.lower()]
        for r in fox_docs:
            assert r.relevance_score == 1.0
        unrelated = [r for r in results if "unrelated" in r.content.lower()]
        assert unrelated[0].relevance_score == 0.0

    @pytest.mark.asyncio
    async def test_rerank_case_insensitive(self):
        reranker = SimpleReranker()
        docs = ["PYTHON IS GREAT", "python is great", "Python Is Great"]

        results = await reranker.rerank("python great", docs, top_k=3)

        # All three should have the same score since matching is case-insensitive
        scores = [r.relevance_score for r in results]
        assert scores[0] == scores[1] == scores[2]

    @pytest.mark.asyncio
    async def test_rerank_preserves_original_rank(self):
        reranker = SimpleReranker()
        docs = ["third", "first match", "second match"]

        results = await reranker.rerank("match", docs, top_k=3)

        # original_rank should correspond to the original index
        result_by_content = {r.content: r for r in results}
        assert result_by_content["third"].original_rank == 0
        assert result_by_content["first match"].original_rank == 1
        assert result_by_content["second match"].original_rank == 2

    @pytest.mark.asyncio
    async def test_rerank_preserves_index_field(self):
        reranker = SimpleReranker()
        docs = ["doc zero", "doc one", "doc two"]

        results = await reranker.rerank("doc", docs, top_k=3)

        indices = {r.index for r in results}
        assert indices == {0, 1, 2}

    @pytest.mark.asyncio
    async def test_rerank_score_is_overlap_ratio(self):
        """Score = overlap_count / max(query_term_count, 1)."""
        reranker = SimpleReranker()
        docs = ["alpha beta"]

        # query has 2 terms, doc has 2 matching terms -> score = 2/2 = 1.0
        results = await reranker.rerank("alpha beta", docs, top_k=1)
        assert results[0].relevance_score == 1.0

        # query has 2 terms, doc matches 1 -> score = 1/2 = 0.5
        results = await reranker.rerank("alpha gamma", docs, top_k=1)
        assert results[0].relevance_score == 0.5

        # query has 2 terms, doc matches 0 -> score = 0/2 = 0.0
        results = await reranker.rerank("gamma delta", docs, top_k=1)
        assert results[0].relevance_score == 0.0

    @pytest.mark.asyncio
    async def test_rerank_identical_documents(self):
        reranker = SimpleReranker()
        docs = ["same content", "same content", "same content"]

        results = await reranker.rerank("same content", docs, top_k=3)

        assert len(results) == 3
        scores = [r.relevance_score for r in results]
        assert scores[0] == scores[1] == scores[2] == 1.0

    @pytest.mark.asyncio
    async def test_rerank_single_document(self):
        reranker = SimpleReranker()
        docs = ["the only document here"]

        results = await reranker.rerank("only document", docs, top_k=5)

        assert len(results) == 1
        assert results[0].relevance_score > 0

    @pytest.mark.asyncio
    async def test_rerank_partial_word_no_match(self):
        """Terms are split on spaces, so partial words should not match."""
        reranker = SimpleReranker()
        docs = ["programming"]

        # "program" is a substring of "programming" but not a full term
        results = await reranker.rerank("program", docs, top_k=1)
        assert results[0].relevance_score == 0.0

    @pytest.mark.asyncio
    async def test_rerank_default_top_k_is_5(self):
        reranker = SimpleReranker()
        docs = [f"doc {i}" for i in range(10)]

        results = await reranker.rerank("doc", docs)

        assert len(results) == 5
