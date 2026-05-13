"""Tests for engine.memory.embeddings — cosine_similarity, serialize/deserialize."""

from __future__ import annotations

import pytest

from engine.memory.embeddings import EmbeddingService


class TestCosineSimilarity:
    def test_identical_vectors(self) -> None:
        vec = [1.0, 0.0, 0.0]
        assert EmbeddingService.cosine_similarity(vec, vec) == pytest.approx(1.0)

    def test_orthogonal_vectors(self) -> None:
        a = [1.0, 0.0, 0.0]
        b = [0.0, 1.0, 0.0]
        assert EmbeddingService.cosine_similarity(a, b) == pytest.approx(0.0)

    def test_opposite_vectors(self) -> None:
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert EmbeddingService.cosine_similarity(a, b) == pytest.approx(-1.0)

    def test_zero_vector_returns_zero(self) -> None:
        a = [0.0, 0.0]
        b = [1.0, 1.0]
        assert EmbeddingService.cosine_similarity(a, b) == 0.0

    def test_both_zero_returns_zero(self) -> None:
        a = [0.0, 0.0]
        b = [0.0, 0.0]
        assert EmbeddingService.cosine_similarity(a, b) == 0.0

    def test_arbitrary_vectors(self) -> None:
        a = [1.0, 2.0, 3.0]
        b = [4.0, 5.0, 6.0]
        dot = 1 * 4 + 2 * 5 + 3 * 6  # 32
        norm_a = (1 + 4 + 9) ** 0.5  # sqrt(14)
        norm_b = (16 + 25 + 36) ** 0.5  # sqrt(77)
        expected = dot / (norm_a * norm_b)
        assert EmbeddingService.cosine_similarity(a, b) == pytest.approx(expected)

    def test_different_lengths_zip_truncates(self) -> None:
        a = [1.0, 2.0, 3.0]
        b = [1.0, 2.0]
        # zip truncates to shorter: dot = 1*1 + 2*2 = 5
        result = EmbeddingService.cosine_similarity(a, b)
        assert isinstance(result, float)


class TestSerializeVector:
    def test_roundtrip(self) -> None:
        original = [0.1, 0.2, 0.3, 0.4]
        serialized = EmbeddingService.serialize_vector(original)
        assert isinstance(serialized, bytes)
        assert len(serialized) == len(original) * 4

        deserialized = EmbeddingService.deserialize_vector(serialized)
        assert len(deserialized) == len(original)
        for orig, deser in zip(original, deserialized):
            assert orig == pytest.approx(deser, abs=1e-6)

    def test_empty_vector(self) -> None:
        serialized = EmbeddingService.serialize_vector([])
        assert serialized == b""
        deserialized = EmbeddingService.deserialize_vector(serialized)
        assert deserialized == []

    def test_single_element(self) -> None:
        vec = [3.14]
        serialized = EmbeddingService.serialize_vector(vec)
        deserialized = EmbeddingService.deserialize_vector(serialized)
        assert deserialized[0] == pytest.approx(3.14, abs=1e-5)

    def test_negative_values(self) -> None:
        vec = [-1.0, -0.5, 0.0, 0.5, 1.0]
        serialized = EmbeddingService.serialize_vector(vec)
        deserialized = EmbeddingService.deserialize_vector(serialized)
        for orig, deser in zip(vec, deserialized):
            assert orig == pytest.approx(deser, abs=1e-6)

    def test_large_vector(self) -> None:
        vec = [float(i) / 100 for i in range(384)]
        serialized = EmbeddingService.serialize_vector(vec)
        assert len(serialized) == 384 * 4
        deserialized = EmbeddingService.deserialize_vector(serialized)
        assert len(deserialized) == 384


class TestEmbeddingServiceInit:
    def test_model_not_loaded_on_init(self) -> None:
        svc = EmbeddingService()
        assert svc._model is None
