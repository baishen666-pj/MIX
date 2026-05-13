"""Comprehensive tests for engine.agent.bus -- AgentBus pub/sub message bus.

Covers: message creation, channel matching, request/response lifecycle,
wildcard patterns, edge cases (empty payloads, concurrent access, timeouts).
"""

from __future__ import annotations

import asyncio

import pytest

from engine.agent.bus import AgentBus, BusMessage

# ---------------------------------------------------------------------------
# BusMessage dataclass tests
# ---------------------------------------------------------------------------


class TestBusMessage:
    def test_default_id_is_generated(self) -> None:
        msg = BusMessage()
        assert isinstance(msg.id, str)
        assert len(msg.id) == 12

    def test_default_payload_is_empty_dict(self) -> None:
        msg = BusMessage()
        assert msg.payload == {}

    def test_default_sender_and_reply_to_are_none(self) -> None:
        msg = BusMessage()
        assert msg.sender is None
        assert msg.reply_to is None

    def test_custom_fields_preserved(self) -> None:
        msg = BusMessage(
            id="custom",
            channel="test.ch",
            payload={"key": "value"},
            sender="agent_a",
            reply_to="msg-001",
        )
        assert msg.id == "custom"
        assert msg.channel == "test.ch"
        assert msg.payload == {"key": "value"}
        assert msg.sender == "agent_a"
        assert msg.reply_to == "msg-001"

    def test_ids_are_unique(self) -> None:
        ids = {BusMessage().id for _ in range(100)}
        assert len(ids) == 100


# ---------------------------------------------------------------------------
# AgentBus publish / subscribe tests
# ---------------------------------------------------------------------------


class TestAgentBusPublishSubscribe:
    @pytest.mark.asyncio
    async def test_single_subscriber_receives_message(self) -> None:
        # Arrange
        bus = AgentBus()
        received: list[BusMessage] = []

        async def handler(msg: BusMessage) -> None:
            received.append(msg)

        # Act
        bus.subscribe("ch1", handler)
        await bus.publish("ch1", {"val": 42}, sender="producer")
        await asyncio.sleep(0.05)

        # Assert
        assert len(received) == 1
        assert received[0].payload == {"val": 42}
        assert received[0].sender == "producer"
        assert received[0].channel == "ch1"

    @pytest.mark.asyncio
    async def test_multiple_subscribers_on_same_channel(self) -> None:
        # Arrange
        bus = AgentBus()
        received_a: list[BusMessage] = []
        received_b: list[BusMessage] = []

        async def handler_a(msg: BusMessage) -> None:
            received_a.append(msg)

        async def handler_b(msg: BusMessage) -> None:
            received_b.append(msg)

        # Act
        bus.subscribe("ch", handler_a)
        bus.subscribe("ch", handler_b)
        await bus.publish("ch", {"x": 1})
        await asyncio.sleep(0.05)

        # Assert
        assert len(received_a) == 1
        assert len(received_b) == 1

    @pytest.mark.asyncio
    async def test_subscriber_on_different_channel_does_not_receive(self) -> None:
        # Arrange
        bus = AgentBus()
        received: list[BusMessage] = []

        async def handler(msg: BusMessage) -> None:
            received.append(msg)

        # Act
        bus.subscribe("alpha", handler)
        await bus.publish("beta", {"data": 1})
        await asyncio.sleep(0.05)

        # Assert
        assert len(received) == 0

    @pytest.mark.asyncio
    async def test_publish_empty_payload(self) -> None:
        # Arrange
        bus = AgentBus()
        received: list[BusMessage] = []

        async def handler(msg: BusMessage) -> None:
            received.append(msg)

        # Act
        bus.subscribe("ch", handler)
        await bus.publish("ch", {})
        await asyncio.sleep(0.05)

        # Assert
        assert len(received) == 1
        assert received[0].payload == {}

    @pytest.mark.asyncio
    async def test_publish_with_no_sender(self) -> None:
        # Arrange
        bus = AgentBus()
        received: list[BusMessage] = []

        async def handler(msg: BusMessage) -> None:
            received.append(msg)

        # Act
        bus.subscribe("ch", handler)
        await bus.publish("ch", {"d": 1})
        await asyncio.sleep(0.05)

        # Assert
        assert received[0].sender is None

    @pytest.mark.asyncio
    async def test_multiple_messages_delivered_in_order(self) -> None:
        # Arrange
        bus = AgentBus()
        received: list[BusMessage] = []

        async def handler(msg: BusMessage) -> None:
            received.append(msg)

        # Act
        bus.subscribe("ch", handler)
        await bus.publish("ch", {"seq": 1})
        await bus.publish("ch", {"seq": 2})
        await bus.publish("ch", {"seq": 3})
        await asyncio.sleep(0.1)

        # Assert
        assert len(received) == 3
        assert [m.payload["seq"] for m in received] == [1, 2, 3]


# ---------------------------------------------------------------------------
# Wildcard channel matching
# ---------------------------------------------------------------------------


class TestAgentBusWildcardMatching:
    @pytest.mark.asyncio
    async def test_star_matches_suffix(self) -> None:
        # Arrange
        bus = AgentBus()
        received: list[BusMessage] = []

        async def handler(msg: BusMessage) -> None:
            received.append(msg)

        # Act
        bus.subscribe("agent.*", handler)
        await bus.publish("agent.chat", {"t": 1})
        await asyncio.sleep(0.05)

        # Assert
        assert len(received) == 1

    @pytest.mark.asyncio
    async def test_question_mark_matches_single_char(self) -> None:
        # Arrange
        bus = AgentBus()
        received: list[BusMessage] = []

        async def handler(msg: BusMessage) -> None:
            received.append(msg)

        # Act
        bus.subscribe("ch.?bc", handler)
        await bus.publish("ch.abc", {"v": 1})
        await bus.publish("ch.xbc", {"v": 2})
        await bus.publish("ch.abcd", {"v": 3})
        await asyncio.sleep(0.05)

        # Assert
        assert len(received) == 2

    @pytest.mark.asyncio
    async def test_bracket_pattern_matches(self) -> None:
        # Arrange
        bus = AgentBus()
        received: list[BusMessage] = []

        async def handler(msg: BusMessage) -> None:
            received.append(msg)

        # Act
        bus.subscribe("ch.[ab]", handler)
        await bus.publish("ch.a", {"v": 1})
        await bus.publish("ch.b", {"v": 2})
        await bus.publish("ch.c", {"v": 3})
        await asyncio.sleep(0.05)

        # Assert
        assert len(received) == 2

    @pytest.mark.asyncio
    async def test_no_pattern_no_match(self) -> None:
        """Exact channel name does not match a different channel."""
        # Arrange
        bus = AgentBus()
        received: list[BusMessage] = []

        async def handler(msg: BusMessage) -> None:
            received.append(msg)

        # Act
        bus.subscribe("exact", handler)
        await bus.publish("exactx", {"v": 1})
        await asyncio.sleep(0.05)

        # Assert
        assert len(received) == 0


# ---------------------------------------------------------------------------
# Channel matching static method
# ---------------------------------------------------------------------------


class TestChannelMatchesStatic:
    def test_exact_match(self) -> None:
        assert AgentBus._channel_matches("foo", "foo") is True

    def test_exact_mismatch(self) -> None:
        assert AgentBus._channel_matches("foo", "bar") is False

    def test_star_pattern_match(self) -> None:
        assert AgentBus._channel_matches("agent.*", "agent.chat") is True

    def test_star_pattern_no_match(self) -> None:
        assert AgentBus._channel_matches("agent.*", "system.chat") is False

    def test_question_mark_match(self) -> None:
        assert AgentBus._channel_matches("a?c", "abc") is True

    def test_question_mark_no_match(self) -> None:
        assert AgentBus._channel_matches("a?c", "abbc") is False

    def test_bracket_pattern_match(self) -> None:
        assert AgentBus._channel_matches("[ab]", "a") is True

    def test_bracket_pattern_no_match(self) -> None:
        assert AgentBus._channel_matches("[ab]", "c") is False

    def test_plain_string_no_wildcard_no_match(self) -> None:
        assert AgentBus._channel_matches("hello", "world") is False


# ---------------------------------------------------------------------------
# Unsubscribe
# ---------------------------------------------------------------------------


class TestAgentBusUnsubscribe:
    @pytest.mark.asyncio
    async def test_unsubscribe_stops_delivery(self) -> None:
        # Arrange
        bus = AgentBus()
        received: list[BusMessage] = []

        async def handler(msg: BusMessage) -> None:
            received.append(msg)

        # Act
        bus.subscribe("ch", handler)
        await bus.publish("ch", {"n": 1})
        await asyncio.sleep(0.05)
        bus.unsubscribe("ch", handler)
        await bus.publish("ch", {"n": 2})
        await asyncio.sleep(0.05)

        # Assert
        assert len(received) == 1
        assert received[0].payload["n"] == 1

    @pytest.mark.asyncio
    async def test_unsubscribe_nonexistent_handler_no_error(self) -> None:
        # Arrange
        bus = AgentBus()

        async def handler(msg: BusMessage) -> None:
            pass

        async def other(msg: BusMessage) -> None:
            pass

        # Act
        bus.subscribe("ch", handler)
        bus.unsubscribe("ch", other)  # different handler, no error

        # Assert -- subscriber_count unchanged
        assert bus.subscriber_count("ch") == 1

    @pytest.mark.asyncio
    async def test_unsubscribe_from_empty_channel_no_error(self) -> None:
        bus = AgentBus()

        async def handler(msg: BusMessage) -> None:
            pass

        bus.unsubscribe("nonexistent", handler)  # should not raise

    @pytest.mark.asyncio
    async def test_unsubscribe_only_target_handler(self) -> None:
        # Arrange
        bus = AgentBus()
        received_a: list[BusMessage] = []
        received_b: list[BusMessage] = []

        async def handler_a(msg: BusMessage) -> None:
            received_a.append(msg)

        async def handler_b(msg: BusMessage) -> None:
            received_b.append(msg)

        # Act
        bus.subscribe("ch", handler_a)
        bus.subscribe("ch", handler_b)
        bus.unsubscribe("ch", handler_a)
        await bus.publish("ch", {"x": 1})
        await asyncio.sleep(0.05)

        # Assert
        assert len(received_a) == 0
        assert len(received_b) == 1


# ---------------------------------------------------------------------------
# Request / Response
# ---------------------------------------------------------------------------


class TestAgentBusRequestResponse:
    @pytest.mark.asyncio
    async def test_request_gets_response(self) -> None:
        # Arrange
        bus = AgentBus()

        async def responder(msg: BusMessage) -> None:
            await bus.respond(msg.id, {"answer": 99}, sender="responder")

        bus.subscribe("q", responder)

        # Act
        response = await bus.request("q", {"question": "number"}, sender="asker", timeout=5.0)

        # Assert
        assert response.payload == {"answer": 99}
        assert response.reply_to is not None

    @pytest.mark.asyncio
    async def test_request_timeout_raises(self) -> None:
        # Arrange
        bus = AgentBus()
        # No subscribers

        # Act / Assert
        with pytest.raises(TimeoutError, match="timed out"):
            await bus.request("empty", {"data": 1}, timeout=0.1)

    @pytest.mark.asyncio
    async def test_respond_to_unknown_message_returns_false(self) -> None:
        # Arrange
        bus = AgentBus()

        # Act
        result = await bus.respond("nonexistent-id", {"data": 1})

        # Assert
        assert result is False

    @pytest.mark.asyncio
    async def test_respond_to_already_resolved_returns_false(self) -> None:
        # Arrange
        bus = AgentBus()

        async def responder(msg: BusMessage) -> None:
            await bus.respond(msg.id, {"first": 1})
            # Second response to same message
            second = await bus.respond(msg.id, {"second": 2})
            assert second is False

        bus.subscribe("ch", responder)

        # Act
        response = await bus.request("ch", {"q": 1}, timeout=5.0)

        # Assert
        assert response.payload == {"first": 1}

    @pytest.mark.asyncio
    async def test_request_delivers_to_wildcard_subscribers(self) -> None:
        # Arrange
        bus = AgentBus()
        responded = False

        async def handler(msg: BusMessage) -> None:
            nonlocal responded
            responded = True
            await bus.respond(msg.id, {"ok": True})

        bus.subscribe("rpc.*", handler)

        # Act
        resp = await bus.request("rpc.compute", {"task": 1}, timeout=5.0)

        # Assert
        assert responded
        assert resp.payload == {"ok": True}


# ---------------------------------------------------------------------------
# List channels / subscriber count
# ---------------------------------------------------------------------------


class TestAgentBusIntrospection:
    @pytest.mark.asyncio
    async def test_list_channels_returns_sorted_unique(self) -> None:
        # Arrange
        bus = AgentBus()

        async def noop(msg: BusMessage) -> None:
            pass

        bus.subscribe("delta", noop)
        bus.subscribe("alpha", noop)
        bus.subscribe("charlie", noop)

        # Act
        channels = bus.list_channels()

        # Assert
        assert channels == ["alpha", "charlie", "delta"]

    @pytest.mark.asyncio
    async def test_list_channels_omits_empty(self) -> None:
        # Arrange
        bus = AgentBus()

        async def noop(msg: BusMessage) -> None:
            pass

        bus.subscribe("ch1", noop)
        # Unsubscribe all handlers from ch1
        bus.unsubscribe("ch1", noop)

        # Act
        channels = bus.list_channels()

        # Assert -- empty channel should not appear
        assert "ch1" not in channels

    @pytest.mark.asyncio
    async def test_subscriber_count_no_subscribers(self) -> None:
        bus = AgentBus()
        assert bus.subscriber_count("unknown") == 0

    @pytest.mark.asyncio
    async def test_subscriber_count_tracks_additions(self) -> None:
        # Arrange
        bus = AgentBus()

        async def noop(msg: BusMessage) -> None:
            pass

        # Act
        bus.subscribe("ch", noop)
        bus.subscribe("ch", noop)
        bus.subscribe("ch", noop)

        # Assert
        assert bus.subscriber_count("ch") == 3

    @pytest.mark.asyncio
    async def test_subscriber_count_after_unsubscribe(self) -> None:
        # Arrange
        bus = AgentBus()

        async def noop(msg: BusMessage) -> None:
            pass

        bus.subscribe("ch", noop)
        bus.unsubscribe("ch", noop)

        # Assert
        assert bus.subscriber_count("ch") == 0


# ---------------------------------------------------------------------------
# Handler error isolation
# ---------------------------------------------------------------------------


class TestAgentBusErrorHandling:
    @pytest.mark.asyncio
    async def test_handler_exception_does_not_crash_bus(self) -> None:
        # Arrange
        bus = AgentBus()

        async def bad(msg: BusMessage) -> None:
            raise ValueError("handler error")

        async def good(msg: BusMessage) -> None:
            pass

        # Act
        bus.subscribe("ch", bad)
        bus.subscribe("ch", good)
        await bus.publish("ch", {"x": 1})
        await asyncio.sleep(0.05)

        # Assert -- no crash; good handler still received
        # (We just verify the test completes without exception)

    @pytest.mark.asyncio
    async def test_publish_to_nonexistent_channel_no_error(self) -> None:
        # Act
        bus = AgentBus()
        await bus.publish("no.listeners", {"data": 1})

        # Assert -- no exception raised
