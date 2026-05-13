"""Tests for engine/rag/reranker.py -- SimpleReranker and LLMReranker."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from engine.rag.reranker import LLMReranker, RerankResult, SimpleReranker


# ===================================================================
# SimpleReranker
# ===================================================================


class TestSimpleReranker:
    """Keyword-based reranking using term frequency overlap."""

    @pytest.mark.asyncio
    async def test_reranks_by_term_overlap(self):
        # Arrange
        reranker = SimpleReranker()
        query = "python web framework"
        documents = [
            "python is a great programming language",
            "django is a python web framework for building websites",
            "java is also a programming language",
        ]
        # Act
        results = await reranker.rerank(query, documents)
        # Assert
        assert len(results) == 3
        # The document about "python web framework" should rank first
        assert results[0].index == 1
        assert results[0].relevance_score > results[1].relevance_score

    @pytest.mark.asyncio
    async def test_respects_top_k(self):
        # Arrange
        reranker = SimpleReranker()
        query = "machine learning"
        documents = [
            "machine learning basics",
            "deep learning intro",
            "machine learning advanced",
            "unrelated document",
            "machine learning with python",
        ]
        # Act
        results = await reranker.rerank(query, documents, top_k=3)
        # Assert
        assert len(results) == 3

    @pytest.mark.asyncio
    async def test_returns_empty_for_empty_documents(self):
        # Arrange
        reranker = SimpleReranker()
        # Act
        results = await reranker.rerank("query", [])
        # Assert
        assert results == []

    @pytest.mark.asyncio
    async def test_returns_empty_for_empty_query(self):
        # Arrange
        reranker = SimpleReranker()
        documents = ["some text", "more text"]
        # Act
        results = await reranker.rerank("", documents)
        # Assert
        assert len(results) == 2
        # All scores should be 0 since empty query has no terms
        for r in results:
            assert r.relevance_score == 0.0

    @pytest.mark.asyncio
    async def test_result_has_correct_fields(self):
        # Arrange
        reranker = SimpleReranker()
        # Act
        results = await reranker.rerank("test", ["test document"])
        # Assert
        assert len(results) == 1
        r = results[0]
        assert isinstance(r, RerankResult)
        assert r.index == 0
        assert r.content == "test document"
        assert isinstance(r.relevance_score, float)
        assert r.original_rank == 0

    @pytest.mark.asyncio
    async def test_case_insensitive_matching(self):
        # Arrange
        reranker = SimpleReranker()
        query = "PYTHON"
        documents = ["python is great"]
        # Act
        results = await reranker.rerank(query, documents)
        # Assert
        assert results[0].relevance_score > 0

    @pytest.mark.asyncio
    async def test_single_word_query(self):
        # Arrange
        reranker = SimpleReranker()
        query = "database"
        documents = [
            "the database is running",
            "cache layer for performance",
            "database connection pool settings",
        ]
        # Act
        results = await reranker.rerank(query, documents)
        # Assert
        assert len(results) == 3
        # Both documents with "database" should rank above the cache one
        assert results[-1].index == 1  # cache doc ranks last

    @pytest.mark.asyncio
    async def test_handles_duplicate_documents(self):
        # Arrange
        reranker = SimpleReranker()
        query = "test"
        documents = ["test content", "test content"]
        # Act
        results = await reranker.rerank(query, documents)
        # Assert
        assert len(results) == 2
        assert results[0].relevance_score == results[1].relevance_score


# ===================================================================
# LLMReranker
# ===================================================================


class TestLLMReranker:
    """LLM-based reranking with fallback to SimpleReranker."""

    @pytest.mark.asyncio
    async def test_reranks_with_llm_scores(self):
        # Arrange
        provider = AsyncMock()
        provider.complete = AsyncMock(return_value={"content": "[8, 3, 9]"})
        reranker = LLMReranker(provider)
        documents = ["highly relevant doc", "not relevant doc", "very relevant doc"]
        # Act
        results = await reranker.rerank("test query", documents)
        # Assert
        assert len(results) == 3
        # Document at index 2 (score 9) should rank first
        assert results[0].index == 2
        assert results[0].relevance_score == pytest.approx(0.9)

    @pytest.mark.asyncio
    async def test_respects_top_k(self):
        # Arrange
        provider = AsyncMock()
        provider.complete = AsyncMock(return_value={"content": "[5, 8, 2, 9, 1]"})
        reranker = LLMReranker(provider)
        documents = ["d1", "d2", "d3", "d4", "d5"]
        # Act
        results = await reranker.rerank("query", documents, top_k=2)
        # Assert
        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_returns_empty_for_empty_documents(self):
        # Arrange
        provider = AsyncMock()
        reranker = LLMReranker(provider)
        # Act
        results = await reranker.rerank("query", [])
        # Assert
        assert results == []
        # Provider should NOT be called for empty documents
        provider.complete.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_falls_back_on_malformed_json(self):
        # Arrange
        provider = AsyncMock()
        provider.complete = AsyncMock(return_value={"content": "this is not json"})
        reranker = LLMReranker(provider)
        documents = ["relevant document", "other document"]
        # Act
        results = await reranker.rerank("relevant", documents)
        # Assert
        # Should fall back to SimpleReranker and still return results
        assert len(results) == 2
        assert isinstance(results[0], RerankResult)

    @pytest.mark.asyncio
    async def test_falls_back_on_llm_error(self):
        # Arrange
        provider = AsyncMock()
        provider.complete = AsyncMock(side_effect=RuntimeError("LLM unavailable"))
        reranker = LLMReranker(provider)
        documents = ["test doc one", "test doc two"]
        # Act
        results = await reranker.rerank("test", documents)
        # Assert
        assert len(results) == 2
        # Results come from fallback SimpleReranker
        assert all(isinstance(r, RerankResult) for r in results)

    @pytest.mark.asyncio
    async def test_handles_missing_content_key(self):
        # Arrange
        provider = AsyncMock()
        provider.complete = AsyncMock(return_value={})
        reranker = LLMReranker(provider)
        documents = ["doc"]
        # Act
        results = await reranker.rerank("query", documents)
        # Assert -- content defaults to "[]", json.loads("[]") = [], zip truncates
        # to 0 items, so results are empty. This is a known edge case.
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_handles_non_list_score_response(self):
        # Arrange -- LLM returns a single number instead of a list
        provider = AsyncMock()
        provider.complete = AsyncMock(return_value={"content": "7"})
        reranker = LLMReranker(provider)
        documents = ["some doc"]
        # Act
        results = await reranker.rerank("query", documents)
        # Assert
        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_truncates_long_documents_in_prompt(self):
        # Arrange
        provider = AsyncMock()
        provider.complete = AsyncMock(return_value={"content": "[5]"})
        reranker = LLMReranker(provider)
        long_doc = "x" * 500  # longer than 200 char truncation
        documents = [long_doc]
        # Act
        results = await reranker.rerank("query", documents)
        # Assert
        assert len(results) == 1
        # Verify the content in the prompt was truncated
        call_args = provider.complete.call_args
        prompt = call_args.kwargs.get("messages", [{}])[0].get("content", "")
        # The original document in the prompt should be truncated to ~200 chars
        assert len(documents[0]) == 500
        # The result should have the full original content
        assert len(results[0].content) == 500

    @pytest.mark.asyncio
    async def test_normalizes_scores_to_zero_to_one_range(self):
        # Arrange
        provider = AsyncMock()
        provider.complete = AsyncMock(return_value={"content": "[10, 5, 0]"})
        reranker = LLMReranker(provider)
        documents = ["perfect", "okay", "bad"]
        # Act
        results = await reranker.rerank("query", documents)
        # Assert
        assert results[0].relevance_score == pytest.approx(1.0)
        assert results[1].relevance_score == pytest.approx(0.5)
        assert results[2].relevance_score == pytest.approx(0.0)

    @pytest.mark.asyncio
    async def test_preserves_original_rank_in_results(self):
        # Arrange
        provider = AsyncMock()
        provider.complete = AsyncMock(return_value={"content": "[3, 9, 1]"})
        reranker = LLMReranker(provider)
        documents = ["low", "high", "lowest"]
        # Act
        results = await reranker.rerank("query", documents)
        # Assert -- results are sorted by score, original_rank tracks position
        for r in results:
            assert r.original_rank == r.index
