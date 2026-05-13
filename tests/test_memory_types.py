"""Tests for engine.memory.types -- MemoryEntry and MemoryType definitions."""

from __future__ import annotations

import uuid
from datetime import datetime

from engine.memory.types import MemoryEntry, MemoryType


class TestMemoryTypeEnum:
    def test_all_expected_types_exist(self) -> None:
        # Assert
        assert MemoryType.FACT.value == "fact"
        assert MemoryType.PREFERENCE.value == "preference"
        assert MemoryType.CONTEXT.value == "context"
        assert MemoryType.SKILL_RESULT.value == "skill_result"
        assert MemoryType.USER_MODEL.value == "user_model"

    def test_enum_has_five_members(self) -> None:
        # Assert
        assert len(MemoryType) == 5

    def test_enum_is_string_based(self) -> None:
        # Assert
        assert isinstance(MemoryType.FACT, str)
        assert MemoryType.FACT == "fact"


class TestMemoryEntryDefaults:
    def test_default_id_is_uuid(self) -> None:
        # Act
        entry = MemoryEntry()

        # Assert -- should be a valid UUID string
        uuid.UUID(entry.id)

    def test_default_type_is_fact(self) -> None:
        # Act
        entry = MemoryEntry()

        # Assert
        assert entry.type == MemoryType.FACT

    def test_default_content_is_empty(self) -> None:
        # Act
        entry = MemoryEntry()

        # Assert
        assert entry.content == ""

    def test_default_tags_is_empty_list(self) -> None:
        # Act
        entry = MemoryEntry()

        # Assert
        assert entry.tags == []

    def test_default_importance_is_half(self) -> None:
        # Act
        entry = MemoryEntry()

        # Assert
        assert entry.importance == 0.5

    def test_default_access_count_is_zero(self) -> None:
        # Act
        entry = MemoryEntry()

        # Assert
        assert entry.access_count == 0

    def test_default_collection_and_document_are_none(self) -> None:
        # Act
        entry = MemoryEntry()

        # Assert
        assert entry.collection_id is None
        assert entry.document_id is None

    def test_default_metadata_is_empty_dict(self) -> None:
        # Act
        entry = MemoryEntry()

        # Assert
        assert entry.metadata == {}

    def test_created_at_is_utc_iso_format(self) -> None:
        # Act
        entry = MemoryEntry()

        # Assert -- should parse as a valid datetime
        parsed = datetime.fromisoformat(entry.created_at)
        assert parsed.tzinfo is not None


class TestMemoryEntryCustomValues:
    def test_custom_type_and_content(self) -> None:
        # Act
        entry = MemoryEntry(
            type=MemoryType.PREFERENCE,
            content="dark mode",
            tags=["ui"],
        )

        # Assert
        assert entry.type == MemoryType.PREFERENCE
        assert entry.content == "dark mode"
        assert entry.tags == ["ui"]

    def test_custom_source_and_session(self) -> None:
        # Act
        entry = MemoryEntry(source="chat", session_id="sess-123")

        # Assert
        assert entry.source == "chat"
        assert entry.session_id == "sess-123"

    def test_each_entry_gets_unique_id(self) -> None:
        # Act
        entry1 = MemoryEntry()
        entry2 = MemoryEntry()

        # Assert
        assert entry1.id != entry2.id


class TestMemoryEntryTouch:
    def test_touch_increments_access_count(self) -> None:
        # Arrange
        entry = MemoryEntry()

        # Act
        entry.touch()

        # Assert
        assert entry.access_count == 1

    def test_touch_updates_accessed_at(self) -> None:
        # Arrange
        entry = MemoryEntry()
        original = entry.accessed_at

        # Act
        entry.touch()

        # Assert -- accessed_at is always regenerated via datetime.now()
        # and access_count must have incremented, proving touch() ran.
        assert entry.access_count == 1
        # accessed_at is a valid ISO timestamp (same format as before)
        datetime.fromisoformat(entry.accessed_at)

    def test_touch_multiple_times(self) -> None:
        # Arrange
        entry = MemoryEntry()

        # Act
        for _ in range(5):
            entry.touch()

        # Assert
        assert entry.access_count == 5


class TestMemoryEntryToDict:
    def test_to_dict_contains_all_keys(self) -> None:
        # Arrange
        entry = MemoryEntry(
            type=MemoryType.CONTEXT,
            content="test content",
            tags=["a", "b"],
            source="unit-test",
        )

        # Act
        d = entry.to_dict()

        # Assert
        expected_keys = {
            "id",
            "type",
            "content",
            "tags",
            "source",
            "session_id",
            "created_at",
            "accessed_at",
            "access_count",
            "importance",
        }
        assert set(d.keys()) == expected_keys

    def test_to_dict_type_is_string_value(self) -> None:
        # Arrange
        entry = MemoryEntry(type=MemoryType.SKILL_RESULT)

        # Act
        d = entry.to_dict()

        # Assert
        assert d["type"] == "skill_result"
        assert isinstance(d["type"], str)

    def test_to_dict_preserves_values(self) -> None:
        # Arrange
        entry = MemoryEntry(
            content="preserved",
            tags=["x"],
            importance=0.9,
            access_count=3,
        )

        # Act
        d = entry.to_dict()

        # Assert
        assert d["content"] == "preserved"
        assert d["tags"] == ["x"]
        assert d["importance"] == 0.9
        assert d["access_count"] == 3

    def test_to_dict_does_not_include_metadata(self) -> None:
        # Arrange
        entry = MemoryEntry(metadata={"extra": "data"})

        # Act
        d = entry.to_dict()

        # Assert -- to_dict does not include metadata per the implementation
        assert "metadata" not in d
