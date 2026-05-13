from __future__ import annotations

import asyncio
import fnmatch
import logging
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine

log = logging.getLogger("mix.bus")


@dataclass
class BusMessage:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    channel: str = ""
    payload: dict[str, Any] = field(default_factory=dict)
    sender: str | None = None
    reply_to: str | None = None


class AgentBus:
    """Inter-agent message bus with publish/subscribe, wildcard channels, and request/response."""

    def __init__(self) -> None:
        self._subscribers: dict[str, list[tuple[Callable, asyncio.Queue]]] = defaultdict(list)
        self._queues: dict[str, list[asyncio.Queue]] = defaultdict(list)
        self._pending_requests: dict[str, asyncio.Future[BusMessage]] = {}

    def subscribe(self, channel: str, handler: Callable[[BusMessage], Coroutine]) -> None:
        queue: asyncio.Queue[BusMessage] = asyncio.Queue()
        self._subscribers[channel].append((handler, queue))
        self._queues[channel].append(queue)

        async def _dispatch() -> None:
            while True:
                msg = await queue.get()
                try:
                    await handler(msg)
                except Exception as exc:
                    log.exception("Handler error on channel %s", channel)
                    if msg.id in self._pending_requests:
                        future = self._pending_requests.pop(msg.id)
                        if not future.done():
                            future.set_exception(exc)
                queue.task_done()

        asyncio.ensure_future(_dispatch())
        log.debug("Subscribed handler to channel %s", channel)

    def unsubscribe(self, channel: str, handler: Callable) -> None:
        remaining = [(h, q) for h, q in self._subscribers.get(channel, []) if h is not handler]
        removed = len(self._subscribers.get(channel, [])) - len(remaining)
        self._subscribers[channel] = remaining
        if removed:
            log.debug("Unsubscribed handler from channel %s (%d removed)", channel, removed)

    async def publish(self, channel: str, payload: dict[str, Any], sender: str | None = None) -> None:
        msg = BusMessage(channel=channel, payload=payload, sender=sender)
        delivered = 0

        for pattern, subscribers in self._subscribers.items():
            if self._channel_matches(pattern, channel):
                for handler, queue in subscribers:
                    await queue.put(msg)
                    delivered += 1

        if msg.id in self._pending_requests:
            future = self._pending_requests.pop(msg.id)
            if not future.done():
                future.set_result(msg)

        log.debug("Published to %s, delivered to %d subscriber(s)", channel, delivered)

    async def request(
        self,
        channel: str,
        payload: dict[str, Any],
        sender: str | None = None,
        timeout: float = 30.0,
    ) -> BusMessage:
        msg = BusMessage(channel=channel, payload=payload, sender=sender)
        future: asyncio.Future[BusMessage] = asyncio.get_event_loop().create_future()
        self._pending_requests[msg.id] = future

        for pattern, subscribers in self._subscribers.items():
            if self._channel_matches(pattern, channel):
                for handler, queue in subscribers:
                    await queue.put(msg)

        try:
            return await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            self._pending_requests.pop(msg.id, None)
            raise TimeoutError(f"Request to {channel} timed out after {timeout}s")

    async def respond(self, original_message_id: str, payload: dict[str, Any], sender: str | None = None) -> bool:
        future = self._pending_requests.pop(original_message_id, None)
        if future is None or future.done():
            return False
        response = BusMessage(
            payload=payload,
            sender=sender,
            reply_to=original_message_id,
        )
        future.set_result(response)
        return True

    def list_channels(self) -> list[str]:
        return sorted(ch for ch, subs in self._subscribers.items() if subs)

    def subscriber_count(self, channel: str) -> int:
        return len(self._subscribers.get(channel, []))

    @staticmethod
    def _channel_matches(pattern: str, channel: str) -> bool:
        if pattern == channel:
            return True
        if "*" in pattern or "?" in pattern or "[" in pattern:
            return fnmatch.fnmatch(channel, pattern)
        return False
