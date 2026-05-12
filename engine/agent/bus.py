from __future__ import annotations

import asyncio
import fnmatch
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine
from collections import defaultdict

log = logging.getLogger("mix.bus")


@dataclass
class BusMessage:
    channel: str
    payload: dict[str, Any]
    sender: str | None = None


class AgentBus:
    """Inter-agent message bus with publish/subscribe and wildcard channels."""

    def __init__(self) -> None:
        self._subscribers: dict[str, list[tuple[Callable, asyncio.Queue]]] = defaultdict(list)
        self._queues: dict[str, list[asyncio.Queue]] = defaultdict(list)

    def subscribe(self, channel: str, handler: Callable[[BusMessage], Coroutine]) -> None:
        """Subscribe *handler* to messages published on *channel*.

        Wildcard patterns like ``agent.*`` are supported.  The handler
        must be an async callable that accepts a single :class:`BusMessage`.
        """
        queue: asyncio.Queue[BusMessage] = asyncio.Queue()
        self._subscribers[channel].append((handler, queue))
        self._queues[channel].append(queue)

        async def _dispatch() -> None:
            while True:
                msg = await queue.get()
                try:
                    await handler(msg)
                except Exception:
                    log.exception("Handler error on channel %s", channel)
                queue.task_done()

        asyncio.ensure_future(_dispatch())
        log.debug("Subscribed handler to channel %s", channel)

    def unsubscribe(self, channel: str, handler: Callable) -> None:
        """Remove *handler* from *channel*."""
        remaining = [
            (h, q) for h, q in self._subscribers.get(channel, [])
            if h is not handler
        ]
        removed = len(self._subscribers.get(channel, [])) - len(remaining)
        self._subscribers[channel] = remaining
        if removed:
            log.debug("Unsubscribed handler from channel %s (%d removed)", channel, removed)

    async def publish(self, channel: str, payload: dict[str, Any], sender: str | None = None) -> None:
        """Publish a message to *channel*.

        The message is delivered to:
        * all exact-match subscribers on *channel*
        * all wildcard subscribers whose pattern matches *channel*
        """
        msg = BusMessage(channel=channel, payload=payload, sender=sender)
        delivered = 0

        for pattern, subscribers in self._subscribers.items():
            if self._channel_matches(pattern, channel):
                for handler, queue in subscribers:
                    await queue.put(msg)
                    delivered += 1

        log.debug("Published to %s, delivered to %d subscriber(s)", channel, delivered)

    def list_channels(self) -> list[str]:
        """Return a sorted list of channels that have at least one subscriber."""
        return sorted(
            ch for ch, subs in self._subscribers.items() if subs
        )

    def subscriber_count(self, channel: str) -> int:
        """Return the number of subscribers for *channel* (exact match only)."""
        return len(self._subscribers.get(channel, []))

    @staticmethod
    def _channel_matches(pattern: str, channel: str) -> bool:
        """Check whether *channel* matches *pattern*.

        Exact match always works.  Patterns containing ``*`` use
        :func:`fnmatch.fnmatch`.
        """
        if pattern == channel:
            return True
        if "*" in pattern or "?" in pattern or "[" in pattern:
            return fnmatch.fnmatch(channel, pattern)
        return False
