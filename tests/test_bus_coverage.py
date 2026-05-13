"""Additional coverage tests for engine.agent.bus.

Targets uncovered lines 44-46, 70-72:
- Lines 44-46: handler crash resolves pending future via set_exception
- Lines 70-72: publish resolves pending future via set_result
"""

from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest

from engine.agent.bus import AgentBus, BusMessage


class TestHandlerCrashResolvesPendingFuture:
    """Cover lines 44-46: handler exception resolves pending request future."""

    @pytest.mark.asyncio
    async def test_handler_error_propagates_to_request_future(self) -> None:
        bus = AgentBus()

        async def crashing_handler(msg: BusMessage) -> None:
            raise RuntimeError("handler exploded")

        bus.subscribe("rpc.crash", crashing_handler)

        with pytest.raises(RuntimeError, match="handler exploded"):
            await bus.request("rpc.crash", {"q": 1}, timeout=5.0)

    @pytest.mark.asyncio
    async def test_handler_error_does_not_affect_other_channels(self) -> None:
        bus = AgentBus()
        received_on_other: list[BusMessage] = []

        async def crashing_handler(msg: BusMessage) -> None:
            raise ValueError("boom")

        async def safe_handler(msg: BusMessage) -> None:
            received_on_other.append(msg)

        bus.subscribe("ch.crash", crashing_handler)
        bus.subscribe("ch.safe", safe_handler)

        # Publish to crashing channel
        await bus.publish("ch.crash", {"x": 1})
        # Publish to safe channel
        await bus.publish("ch.safe", {"x": 2})
        await asyncio.sleep(0.1)

        assert len(received_on_other) == 1
        assert received_on_other[0].payload["x"] == 2


class TestPublishResolvesPendingFuture:
    """Cover lines 70-72: publish sets result on pending request future.

    The publish method checks if msg.id is in _pending_requests and resolves
    the future. We test this directly by setting up a pending future and
    publishing to trigger the resolution path.
    """

    @pytest.mark.asyncio
    async def test_publish_resolves_pending_request_future(self) -> None:
        bus = AgentBus()

        # Manually create a pending request future
        msg_id = "test-msg-123"
        future: asyncio.Future[BusMessage] = asyncio.get_event_loop().create_future()
        bus._pending_requests[msg_id] = future

        # Monkey-patch BusMessage to use our known ID so publish hits the pending path
        original_init = BusMessage.__init__

        def _patched_init(self_msg, *args, **kwargs):
            original_init(self_msg, *args, **kwargs)
            self_msg.id = msg_id

        with patch.object(BusMessage, "__init__", _patched_init):
            # Publish with no subscribers -- the pending future should still be resolved
            await bus.publish("test.channel", {"data": "payload"})

        # The future should now be resolved
        assert future.done()
        result = future.result()
        assert result.payload == {"data": "payload"}

    @pytest.mark.asyncio
    async def test_publish_skips_already_done_future(self) -> None:
        bus = AgentBus()

        msg_id = "done-msg-456"
        future: asyncio.Future[BusMessage] = asyncio.get_event_loop().create_future()
        future.set_result(BusMessage(payload={"pre": "set"}))
        bus._pending_requests[msg_id] = future

        original_init = BusMessage.__init__

        def _patched_init(self_msg, *args, **kwargs):
            original_init(self_msg, *args, **kwargs)
            self_msg.id = msg_id

        with patch.object(BusMessage, "__init__", _patched_init):
            await bus.publish("test.channel", {"data": "new"})

        # The future should still have the original result (not overwritten)
        assert future.result().payload == {"pre": "set"}


class TestPublishNoSubscribers:
    """Cover the case where publish delivers to zero subscribers."""

    @pytest.mark.asyncio
    async def test_publish_to_empty_channel_completes(self) -> None:
        bus = AgentBus()
        # No subscribers at all
        await bus.publish("empty.channel", {"data": "test"})
        # Should complete without error

    @pytest.mark.asyncio
    async def test_request_to_empty_channel_times_out(self) -> None:
        bus = AgentBus()
        with pytest.raises(TimeoutError, match="timed out"):
            await bus.request("no.subs", {"x": 1}, timeout=0.2)


class TestUnsubscribeEdgeCases:
    """Additional unsubscribe edge cases."""

    @pytest.mark.asyncio
    async def test_unsubscribe_all_handlers_clears_channel(self) -> None:
        bus = AgentBus()

        async def handler_a(msg: BusMessage) -> None:
            pass

        async def handler_b(msg: BusMessage) -> None:
            pass

        bus.subscribe("ch", handler_a)
        bus.subscribe("ch", handler_b)
        assert bus.subscriber_count("ch") == 2

        bus.unsubscribe("ch", handler_a)
        bus.unsubscribe("ch", handler_b)
        assert bus.subscriber_count("ch") == 0

        # Channel should not appear in list_channels
        assert "ch" not in bus.list_channels()
