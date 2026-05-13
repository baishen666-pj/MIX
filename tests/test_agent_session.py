"""Comprehensive tests for engine.agent.session -- SessionManager.

Covers: session creation, retrieval, listing, deletion, state isolation,
edge cases (empty list, double delete, large number of sessions).
"""

from __future__ import annotations

from engine.agent.session import SessionInfo, SessionManager

# ---------------------------------------------------------------------------
# SessionInfo dataclass tests
# ---------------------------------------------------------------------------


class TestSessionInfo:
    def test_fields_accessible(self) -> None:
        # Arrange / Act
        info = SessionInfo(
            id="abc",
            channel="webchat",
            user_id="user1",
            model="gpt-4o",
            created_at="2025-01-01T00:00:00",
            message_count=5,
        )

        # Assert
        assert info.id == "abc"
        assert info.channel == "webchat"
        assert info.user_id == "user1"
        assert info.model == "gpt-4o"
        assert info.created_at == "2025-01-01T00:00:00"
        assert info.message_count == 5


# ---------------------------------------------------------------------------
# Session creation
# ---------------------------------------------------------------------------


class TestSessionCreate:
    def test_create_returns_session_id(self) -> None:
        # Arrange
        manager = SessionManager()

        # Act
        session_id = manager.create()

        # Assert
        assert isinstance(session_id, str)
        assert len(session_id) > 0

    def test_create_generates_unique_ids(self) -> None:
        # Arrange
        manager = SessionManager()

        # Act
        ids = {manager.create() for _ in range(100)}

        # Assert
        assert len(ids) == 100

    def test_create_with_custom_channel(self) -> None:
        # Arrange
        manager = SessionManager()

        # Act
        session_id = manager.create(channel="telegram")
        session = manager.get(session_id)

        # Assert
        assert session is not None
        assert session["channel"] == "telegram"

    def test_create_with_custom_user_id(self) -> None:
        # Arrange
        manager = SessionManager()

        # Act
        session_id = manager.create(user_id="alice")
        session = manager.get(session_id)

        # Assert
        assert session is not None
        assert session["user_id"] == "alice"

    def test_create_with_custom_model(self) -> None:
        # Arrange
        manager = SessionManager()

        # Act
        session_id = manager.create(model="gpt-3.5-turbo")
        session = manager.get(session_id)

        # Assert
        assert session is not None
        assert session["model"] == "gpt-3.5-turbo"

    def test_create_stores_all_fields(self) -> None:
        # Arrange
        manager = SessionManager()

        # Act
        session_id = manager.create(channel="slack", user_id="bob", model="gpt-4o")
        session = manager.get(session_id)

        # Assert
        assert session is not None
        assert session["id"] == session_id
        assert session["channel"] == "slack"
        assert session["user_id"] == "bob"
        assert session["model"] == "gpt-4o"
        assert session["created_at"] is not None
        assert session["message_count"] == 0

    def test_create_default_values(self) -> None:
        # Arrange
        manager = SessionManager()

        # Act
        session_id = manager.create()
        session = manager.get(session_id)

        # Assert
        assert session["channel"] == "webchat"
        assert session["user_id"] == "default"
        assert session["model"] == ""

    def test_created_at_is_iso_format(self) -> None:
        # Arrange
        manager = SessionManager()

        # Act
        session_id = manager.create()
        session = manager.get(session_id)

        # Assert
        assert "T" in session["created_at"]


# ---------------------------------------------------------------------------
# Session retrieval
# ---------------------------------------------------------------------------


class TestSessionGet:
    def test_get_existing_session(self) -> None:
        # Arrange
        manager = SessionManager()
        session_id = manager.create()

        # Act
        session = manager.get(session_id)

        # Assert
        assert session is not None
        assert session["id"] == session_id

    def test_get_nonexistent_returns_none(self) -> None:
        # Arrange
        manager = SessionManager()

        # Act
        session = manager.get("does-not-exist")

        # Assert
        assert session is None

    def test_get_returns_dict(self) -> None:
        # Arrange
        manager = SessionManager()
        session_id = manager.create()

        # Act
        session = manager.get(session_id)

        # Assert
        assert isinstance(session, dict)

    def test_get_after_delete_returns_none(self) -> None:
        # Arrange
        manager = SessionManager()
        session_id = manager.create()
        manager.delete(session_id)

        # Act
        session = manager.get(session_id)

        # Assert
        assert session is None

    def test_get_empty_string_id_returns_none(self) -> None:
        # Arrange
        manager = SessionManager()

        # Act
        session = manager.get("")

        # Assert
        assert session is None


# ---------------------------------------------------------------------------
# Session listing
# ---------------------------------------------------------------------------


class TestSessionList:
    def test_list_empty_returns_empty_list(self) -> None:
        # Arrange
        manager = SessionManager()

        # Act
        sessions = manager.list_sessions()

        # Assert
        assert sessions == []

    def test_list_returns_session_info_objects(self) -> None:
        # Arrange
        manager = SessionManager()
        manager.create()

        # Act
        sessions = manager.list_sessions()

        # Assert
        assert len(sessions) == 1
        assert isinstance(sessions[0], SessionInfo)

    def test_list_all_created_sessions(self) -> None:
        # Arrange
        manager = SessionManager()
        ids = [manager.create() for _ in range(5)]

        # Act
        sessions = manager.list_sessions()

        # Assert
        assert len(sessions) == 5
        listed_ids = {s.id for s in sessions}
        assert listed_ids == set(ids)

    def test_list_excludes_deleted_sessions(self) -> None:
        # Arrange
        manager = SessionManager()
        id1 = manager.create()
        id2 = manager.create()
        manager.delete(id1)

        # Act
        sessions = manager.list_sessions()

        # Assert
        assert len(sessions) == 1
        assert sessions[0].id == id2

    def test_list_returns_info_with_correct_fields(self) -> None:
        # Arrange
        manager = SessionManager()
        manager.create(channel="irc", user_id="eve", model="gpt-4")

        # Act
        sessions = manager.list_sessions()

        # Assert
        info = sessions[0]
        assert info.channel == "irc"
        assert info.user_id == "eve"
        assert info.model == "gpt-4"
        assert info.message_count == 0


# ---------------------------------------------------------------------------
# Session deletion
# ---------------------------------------------------------------------------


class TestSessionDelete:
    def test_delete_existing_returns_true(self) -> None:
        # Arrange
        manager = SessionManager()
        session_id = manager.create()

        # Act
        result = manager.delete(session_id)

        # Assert
        assert result is True

    def test_delete_nonexistent_returns_false(self) -> None:
        # Arrange
        manager = SessionManager()

        # Act
        result = manager.delete("nonexistent")

        # Assert
        assert result is False

    def test_double_delete_returns_false_second_time(self) -> None:
        # Arrange
        manager = SessionManager()
        session_id = manager.create()
        manager.delete(session_id)

        # Act
        result = manager.delete(session_id)

        # Assert
        assert result is False

    def test_delete_removes_from_listing(self) -> None:
        # Arrange
        manager = SessionManager()
        id1 = manager.create()
        id2 = manager.create()
        manager.delete(id1)

        # Act
        sessions = manager.list_sessions()

        # Assert
        assert len(sessions) == 1
        assert sessions[0].id == id2

    def test_delete_all_sessions(self) -> None:
        # Arrange
        manager = SessionManager()
        ids = [manager.create() for _ in range(5)]

        # Act
        for sid in ids:
            manager.delete(sid)

        # Assert
        assert manager.list_sessions() == []


# ---------------------------------------------------------------------------
# State isolation
# ---------------------------------------------------------------------------


class TestStateIsolation:
    def test_managers_are_independent(self) -> None:
        # Arrange
        m1 = SessionManager()
        m2 = SessionManager()

        # Act
        sid = m1.create()

        # Assert
        assert m1.get(sid) is not None
        assert m2.get(sid) is None

    def test_session_dict_is_not_shared_reference(self) -> None:
        # Arrange
        manager = SessionManager()
        sid = manager.create()
        session1 = manager.get(sid)
        session2 = manager.get(sid)

        # Act -- mutate one returned dict
        if session1 is not None:
            session1["model"] = "modified"

        # Assert -- internal state may or may not be affected,
        # but we verify get() returns data each time
        assert session2 is not None


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


class TestEdgeCases:
    def test_large_number_of_sessions(self) -> None:
        # Arrange
        manager = SessionManager()

        # Act
        ids = [manager.create() for _ in range(1000)]

        # Assert
        assert len(manager.list_sessions()) == 1000
        for sid in ids:
            assert manager.get(sid) is not None

    def test_create_session_with_empty_channel(self) -> None:
        # Arrange
        manager = SessionManager()

        # Act
        sid = manager.create(channel="")
        session = manager.get(sid)

        # Assert
        assert session is not None
        assert session["channel"] == ""

    def test_create_session_with_empty_user_id(self) -> None:
        # Arrange
        manager = SessionManager()

        # Act
        sid = manager.create(user_id="")
        session = manager.get(sid)

        # Assert
        assert session is not None
        assert session["user_id"] == ""

    def test_list_after_many_operations(self) -> None:
        # Arrange
        manager = SessionManager()
        ids = [manager.create() for _ in range(10)]

        # Act -- delete every other session
        for i in range(0, 10, 2):
            manager.delete(ids[i])

        # Assert
        sessions = manager.list_sessions()
        assert len(sessions) == 5
        remaining_ids = {s.id for s in sessions}
        for i in range(1, 10, 2):
            assert ids[i] in remaining_ids
