from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field


@dataclass
class RequestRecord:
    """A single recorded request with its duration."""

    timestamp: float
    duration_ms: float
    status_code: int
    endpoint: str


@dataclass
class LlmCallRecord:
    """A single recorded LLM call with its duration and token usage."""

    timestamp: float
    duration_ms: float
    tokens: int
    provider: str


class MetricsCollector:
    """Thread-safe in-memory metrics collector with time-based windows.

    Tracks request counts, response times, error counts, LLM call stats,
    and session/memory counts. Uses collections.deque for bounded time-windowed
    storage and asyncio.Lock for thread safety in async contexts.
    """

    def __init__(self, window_seconds: int = 60, max_records: int = 10000) -> None:
        self._window_seconds = window_seconds
        self._max_records = max_records
        self._start_time = time.monotonic()
        self._lock = asyncio.Lock()

        # Time-windowed request records per endpoint
        self._request_records: deque[RequestRecord] = deque(maxlen=max_records)
        self._request_durations: deque[float] = deque(maxlen=max_records)

        # Counters
        self._total_requests: int = 0
        self._requests_by_endpoint: dict[str, int] = defaultdict(int)
        self._requests_by_status: dict[int, int] = defaultdict(int)

        # LLM tracking
        self._llm_records: deque[LlmCallRecord] = deque(maxlen=max_records)
        self._total_llm_calls: int = 0
        self._llm_by_provider: dict[str, int] = defaultdict(int)
        self._total_llm_tokens: int = 0

        # Session and memory tracking (simple counters, updated externally)
        self._active_sessions: int = 0
        self._memory_entries: int = 0

    async def record_request(
        self, endpoint: str, duration_ms: float, status_code: int
    ) -> None:
        """Record a completed request."""
        now = time.monotonic()
        record = RequestRecord(
            timestamp=now,
            duration_ms=duration_ms,
            status_code=status_code,
            endpoint=endpoint,
        )
        async with self._lock:
            self._request_records.append(record)
            self._request_durations.append(duration_ms)
            self._total_requests += 1
            self._requests_by_endpoint[endpoint] += 1
            self._requests_by_status[status_code] += 1

    async def record_llm_call(
        self, provider: str, duration_ms: float, tokens: int
    ) -> None:
        """Record an LLM API call."""
        now = time.monotonic()
        record = LlmCallRecord(
            timestamp=now,
            duration_ms=duration_ms,
            tokens=tokens,
            provider=provider,
        )
        async with self._lock:
            self._llm_records.append(record)
            self._total_llm_calls += 1
            self._llm_by_provider[provider] += 1
            self._total_llm_tokens += tokens

    def set_active_sessions(self, count: int) -> None:
        """Update the active session count."""
        self._active_sessions = count

    def set_memory_entries(self, count: int) -> None:
        """Update the memory entry count."""
        self._memory_entries = count

    async def get_metrics(self) -> dict:
        """Return all metrics as a dict."""
        async with self._lock:
            now = time.monotonic()
            uptime = now - self._start_time

            # Filter recent request durations for the time window
            window_cutoff = now - self._window_seconds
            recent_durations = [
                r.duration_ms
                for r in self._request_records
                if r.timestamp >= window_cutoff
            ]

            avg_duration = (
                sum(recent_durations) / len(recent_durations)
                if recent_durations
                else 0.0
            )
            p95_duration = _percentile(recent_durations, 95) if recent_durations else 0.0

            # LLM recent window stats
            recent_llm = [
                r for r in self._llm_records if r.timestamp >= window_cutoff
            ]
            recent_llm_durations = [r.duration_ms for r in recent_llm]
            avg_llm_latency = (
                sum(recent_llm_durations) / len(recent_llm_durations)
                if recent_llm_durations
                else 0.0
            )

            return {
                "uptime_seconds": round(uptime, 2),
                "window_seconds": self._window_seconds,
                "requests": {
                    "total": self._total_requests,
                    "by_endpoint": dict(self._requests_by_endpoint),
                    "by_status": {str(k): v for k, v in self._requests_by_status.items()},
                    "avg_duration_ms": round(avg_duration, 2),
                    "p95_duration_ms": round(p95_duration, 2),
                    "recent_count": len(recent_durations),
                },
                "llm": {
                    "total_calls": self._total_llm_calls,
                    "by_provider": dict(self._llm_by_provider),
                    "avg_latency_ms": round(avg_llm_latency, 2),
                    "total_tokens": self._total_llm_tokens,
                    "recent_calls": len(recent_llm),
                },
                "sessions": {
                    "active_count": self._active_sessions,
                },
                "memory": {
                    "entry_count": self._memory_entries,
                },
                "timestamp": time.time(),
            }

    async def reset(self) -> None:
        """Clear all collected metrics and restart timers."""
        async with self._lock:
            self._start_time = time.monotonic()
            self._request_records.clear()
            self._request_durations.clear()
            self._total_requests = 0
            self._requests_by_endpoint.clear()
            self._requests_by_status.clear()
            self._llm_records.clear()
            self._total_llm_calls = 0
            self._llm_by_provider.clear()
            self._total_llm_tokens = 0
            self._active_sessions = 0
            self._memory_entries = 0

    async def prometheus_format(self) -> str:
        """Return metrics in Prometheus text exposition format."""
        metrics = await self.get_metrics()
        lines: list[str] = []

        lines.append("# HELP mix_uptime_seconds Total uptime in seconds")
        lines.append("# TYPE mix_uptime_seconds gauge")
        lines.append(f'mix_uptime_seconds {metrics["uptime_seconds"]}')

        lines.append("")
        lines.append("# HELP mix_requests_total Total HTTP requests")
        lines.append("# TYPE mix_requests_total counter")
        lines.append(f'mix_requests_total {metrics["requests"]["total"]}')

        lines.append("")
        lines.append("# HELP mix_request_duration_ms Request duration in milliseconds")
        lines.append("# TYPE mix_request_duration_ms summary")
        lines.append(f'mix_request_duration_ms{{quantile="avg"}} {metrics["requests"]["avg_duration_ms"]}')
        lines.append(f'mix_request_duration_ms{{quantile="p95"}} {metrics["requests"]["p95_duration_ms"]}')

        for endpoint, count in metrics["requests"]["by_endpoint"].items():
            safe = endpoint.replace("/", "_").strip("_") or "root"
            lines.append(f'mix_requests_by_endpoint{{endpoint="{safe}"}} {count}')

        for status, count in metrics["requests"]["by_status"].items():
            lines.append(f'mix_requests_by_status{{status="{status}"}} {count}')

        lines.append("")
        lines.append("# HELP mix_llm_calls_total Total LLM API calls")
        lines.append("# TYPE mix_llm_calls_total counter")
        lines.append(f'mix_llm_calls_total {metrics["llm"]["total_calls"]}')

        lines.append("")
        lines.append("# HELP mix_llm_tokens_total Total LLM tokens used")
        lines.append("# TYPE mix_llm_tokens_total counter")
        lines.append(f'mix_llm_tokens_total {metrics["llm"]["total_tokens"]}')

        lines.append("")
        lines.append("# HELP mix_llm_latency_ms LLM call latency in milliseconds")
        lines.append("# TYPE mix_llm_latency_ms gauge")
        lines.append(f'mix_llm_latency_ms {metrics["llm"]["avg_latency_ms"]}')

        for provider, count in metrics["llm"]["by_provider"].items():
            lines.append(f'mix_llm_calls_by_provider{{provider="{provider}"}} {count}')

        lines.append("")
        lines.append("# HELP mix_active_sessions Number of active sessions")
        lines.append("# TYPE mix_active_sessions gauge")
        lines.append(f'mix_active_sessions {metrics["sessions"]["active_count"]}')

        lines.append("")
        lines.append("# HELP mix_memory_entries Total memory entries")
        lines.append("# TYPE mix_memory_entries gauge")
        lines.append(f'mix_memory_entries {metrics["memory"]["entry_count"]}')

        return "\n".join(lines) + "\n"


def _percentile(values: list[float], pct: int) -> float:
    """Compute the given percentile from a list of values.

    Uses the nearest-rank method. Returns 0.0 for empty input.
    """
    if not values:
        return 0.0
    sorted_values = sorted(values)
    idx = max(0, int(len(sorted_values) * pct / 100) - 1)
    return sorted_values[idx]
