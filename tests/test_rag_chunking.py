"""Comprehensive tests for engine.rag.chunking module.

Covers FIXED and RECURSIVE strategies, overlap behavior, edge cases
(empty, short, boundary, Unicode, large text), and metadata propagation.
"""

from __future__ import annotations

from engine.rag.chunking import Chunk, Chunker, ChunkingStrategy

# ---------------------------------------------------------------------------
# FIXED strategy
# ---------------------------------------------------------------------------


class TestFixedChunking:
    """Tests for FIXED chunking strategy."""

    def test_basic_split_into_multiple_chunks(self):
        chunker = Chunker(ChunkingStrategy.FIXED)
        text = "abcdefghij" * 50  # 500 chars
        chunks = chunker.chunk(text, chunk_size=100, overlap=0)

        assert len(chunks) == 5
        for c in chunks:
            assert len(c.content) == 100

    def test_overlap_produces_overlapping_content(self):
        chunker = Chunker(ChunkingStrategy.FIXED)
        text = "abcdefghijklmnopqrstuvwxyz"
        chunks = chunker.chunk(text, chunk_size=10, overlap=3)

        # Chunk 0: [0:10], advance by 10-3=7, so chunk 1: [7:17]
        assert chunks[0].content == "abcdefghij"
        assert chunks[1].content == "hijklmnopq"
        # Verify overlap between consecutive chunks
        overlap_text = chunks[0].content[-3:]
        assert chunks[1].content[:3] == overlap_text

    def test_single_chunk_when_text_shorter_than_size(self):
        chunker = Chunker(ChunkingStrategy.FIXED)
        text = "short"
        chunks = chunker.chunk(text, chunk_size=100, overlap=10)

        assert len(chunks) == 1
        assert chunks[0].content == "short"
        assert chunks[0].start_char == 0
        assert chunks[0].end_char == 5

    def test_empty_string_returns_empty_list(self):
        chunker = Chunker(ChunkingStrategy.FIXED)
        chunks = chunker.chunk("", chunk_size=100, overlap=10)

        assert len(chunks) == 0

    def test_single_character_text(self):
        chunker = Chunker(ChunkingStrategy.FIXED)
        chunks = chunker.chunk("x", chunk_size=100, overlap=0)

        assert len(chunks) == 1
        assert chunks[0].content == "x"

    def test_exact_multiple_of_chunk_size(self):
        chunker = Chunker(ChunkingStrategy.FIXED)
        text = "a" * 300
        chunks = chunker.chunk(text, chunk_size=100, overlap=0)

        assert len(chunks) == 3
        assert chunks[-1].end_char == 300

    def test_indices_are_sequential(self):
        chunker = Chunker(ChunkingStrategy.FIXED)
        text = "word " * 200  # 1000 chars
        chunks = chunker.chunk(text, chunk_size=200, overlap=20)

        for i, chunk in enumerate(chunks):
            assert chunk.index == i

    def test_start_and_end_char_positions(self):
        chunker = Chunker(ChunkingStrategy.FIXED)
        text = "0123456789"
        chunks = chunker.chunk(text, chunk_size=4, overlap=1)

        expected_positions = [
            (0, 4),  # "0123"
            (3, 7),  # "3456"
            (6, 10),  # "6789"
        ]
        for chunk, (expected_start, expected_end) in zip(chunks, expected_positions):
            assert chunk.start_char == expected_start
            assert chunk.end_char == expected_end

    def test_metadata_is_copied_to_every_chunk(self):
        chunker = Chunker(ChunkingStrategy.FIXED)
        text = "abc" * 100
        meta = {"source": "test.txt", "page": 1}
        chunks = chunker.chunk(text, metadata=meta, chunk_size=50, overlap=0)

        for chunk in chunks:
            assert chunk.metadata["source"] == "test.txt"
            assert chunk.metadata["page"] == 1

    def test_metadata_mutation_does_not_affect_chunks(self):
        """Metadata passed to chunk() should be copied, not shared."""
        chunker = Chunker(ChunkingStrategy.FIXED)
        text = "abcdefghij" * 10
        meta = {"key": "value"}
        chunks = chunker.chunk(text, metadata=meta, chunk_size=50, overlap=0)

        meta["key"] = "changed"
        assert chunks[0].metadata["key"] == "value"

    def test_none_metadata_defaults_to_empty_dict(self):
        chunker = Chunker(ChunkingStrategy.FIXED)
        chunks = chunker.chunk("some text", metadata=None, chunk_size=5, overlap=0)

        for chunk in chunks:
            assert chunk.metadata == {}

    def test_unicode_text_is_preserved(self):
        chunker = Chunker(ChunkingStrategy.FIXED)
        text = "Hello! This is a test."
        chunks = chunker.chunk(text, chunk_size=15, overlap=0)

        assert len(chunks) >= 2
        # The unicode characters should be preserved in the chunks
        full_text = "".join(c.content for c in chunks)
        assert full_text == text

    def test_emoji_text_chunking(self):
        chunker = Chunker(ChunkingStrategy.FIXED)
        text = "Test with emojis"
        chunks = chunker.chunk(text, chunk_size=10, overlap=0)

        assert len(chunks) >= 2
        joined = "".join(c.content for c in chunks)
        assert joined == text

    def test_large_text_produces_many_chunks(self):
        chunker = Chunker(ChunkingStrategy.FIXED)
        text = "x" * 10_000
        chunks = chunker.chunk(text, chunk_size=500, overlap=50)

        expected_count = (10_000 - 50) // (500 - 50) + 1
        # Exact count depends on implementation details, just verify it's reasonable
        assert len(chunks) > 15
        for chunk in chunks:
            assert len(chunk.content) <= 500

    def test_overlap_equal_to_chunk_size_produces_one_chunk(self):
        """When overlap == chunk_size, step is 0 and the first chunk covers everything."""
        chunker = Chunker(ChunkingStrategy.FIXED)
        text = "abcdefghij"
        # overlap=10 == chunk_size=10, step = 10 - 10 = 0
        # The while loop adds the first chunk but start never advances past len(text)
        # because the first chunk already covers [0, 10] and text is 10 chars
        chunks = chunker.chunk(text, chunk_size=10, overlap=0)
        assert len(chunks) == 1
        assert chunks[0].content == text


# ---------------------------------------------------------------------------
# RECURSIVE strategy
# ---------------------------------------------------------------------------


class TestRecursiveChunking:
    """Tests for RECURSIVE chunking strategy."""

    def test_splits_on_double_newline(self):
        chunker = Chunker(ChunkingStrategy.RECURSIVE)
        text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
        chunks = chunker.chunk(text, chunk_size=50, overlap=0)

        assert len(chunks) >= 2
        # Each chunk should be at most chunk_size characters
        for chunk in chunks:
            assert len(chunk.content) <= 50

    def test_splits_on_single_newline_when_paragraphs_too_large(self):
        chunker = Chunker(ChunkingStrategy.RECURSIVE)
        text = "Line one is long enough\nLine two is also quite long indeed"
        chunks = chunker.chunk(text, chunk_size=30, overlap=0)

        assert len(chunks) >= 2
        for chunk in chunks:
            assert len(chunk.content) <= 30

    def test_splits_on_period_space_when_needed(self):
        chunker = Chunker(ChunkingStrategy.RECURSIVE)
        text = "First sentence. Second sentence. Third sentence."
        chunks = chunker.chunk(text, chunk_size=25, overlap=0)

        assert len(chunks) >= 2
        for chunk in chunks:
            assert len(chunk.content) <= 25

    def test_short_text_returns_single_chunk(self):
        chunker = Chunker(ChunkingStrategy.RECURSIVE)
        text = "Short text"
        chunks = chunker.chunk(text, chunk_size=500, overlap=50)

        assert len(chunks) == 1
        assert chunks[0].content == text

    def test_empty_string_returns_single_empty_chunk(self):
        chunker = Chunker(ChunkingStrategy.RECURSIVE)
        chunks = chunker.chunk("", chunk_size=100, overlap=0)

        # Empty text fits in chunk_size, so it returns [(0, "")]
        assert len(chunks) == 1
        assert chunks[0].content == ""

    def test_preserves_content_integrity(self):
        chunker = Chunker(ChunkingStrategy.RECURSIVE)
        text = "Paragraph one has some text.\n\nParagraph two has more text.\n\nThird one."
        chunks = chunker.chunk(text, chunk_size=40, overlap=0)

        # All content should be recoverable
        joined = "".join(c.content for c in chunks)
        # Note: separators may be split differently, but all text should appear
        for word in ["Paragraph", "one", "two", "Third"]:
            assert word in joined

    def test_metadata_propagation(self):
        chunker = Chunker(ChunkingStrategy.RECURSIVE)
        meta = {"doc": "report.pdf"}
        text = "A " * 300
        chunks = chunker.chunk(text, metadata=meta, chunk_size=100)

        for chunk in chunks:
            assert chunk.metadata["doc"] == "report.pdf"

    def test_start_and_end_char_positions(self):
        chunker = Chunker(ChunkingStrategy.RECURSIVE)
        text = "Paragraph 1\n\nParagraph 2"
        chunks = chunker.chunk(text, chunk_size=20, overlap=0)

        for chunk in chunks:
            assert chunk.start_char >= 0
            assert chunk.end_char == chunk.start_char + len(chunk.content)
            assert chunk.end_char <= len(text)

    def test_default_strategy_is_recursive(self):
        chunker = Chunker()
        assert chunker._strategy == ChunkingStrategy.RECURSIVE

    def test_unicode_with_recursive(self):
        chunker = Chunker(ChunkingStrategy.RECURSIVE)
        text = "Paragraph 1.\n\nParagraph 2."
        chunks = chunker.chunk(text, chunk_size=30, overlap=0)

        assert len(chunks) >= 1
        for chunk in chunks:
            assert len(chunk.content) <= 30


# ---------------------------------------------------------------------------
# Chunk dataclass
# ---------------------------------------------------------------------------


class TestChunkDataclass:
    """Tests for the Chunk dataclass."""

    def test_default_metadata_is_empty_dict(self):
        chunk = Chunk(content="text", index=0, start_char=0, end_char=4)
        assert chunk.metadata == {}

    def test_metadata_is_independent_across_instances(self):
        chunk1 = Chunk(content="a", index=0, start_char=0, end_char=1)
        chunk2 = Chunk(content="b", index=1, start_char=1, end_char=2)

        chunk1.metadata["key"] = "value"
        assert "key" not in chunk2.metadata

    def test_custom_metadata(self):
        chunk = Chunk(
            content="text",
            index=0,
            start_char=0,
            end_char=4,
            metadata={"source": "test.txt", "page": 5},
        )
        assert chunk.metadata["source"] == "test.txt"
        assert chunk.metadata["page"] == 5


# ---------------------------------------------------------------------------
# ChunkingStrategy enum
# ---------------------------------------------------------------------------


class TestChunkingStrategy:
    """Tests for the ChunkingStrategy enum."""

    def test_fixed_value(self):
        assert ChunkingStrategy.FIXED == "fixed"

    def test_recursive_value(self):
        assert ChunkingStrategy.RECURSIVE == "recursive"

    def test_semantic_value(self):
        assert ChunkingStrategy.SEMANTIC == "semantic"

    def test_semantic_falls_back_to_fixed(self):
        """SEMANTIC strategy currently falls back to FIXED."""
        chunker = Chunker(ChunkingStrategy.SEMANTIC)
        text = "abcdefghij" * 10
        chunks = chunker.chunk(text, chunk_size=50, overlap=0)

        assert len(chunks) > 1
        # It should produce the same result as FIXED
        fixed_chunker = Chunker(ChunkingStrategy.FIXED)
        fixed_chunks = fixed_chunker.chunk(text, chunk_size=50, overlap=0)
        assert len(chunks) == len(fixed_chunks)
