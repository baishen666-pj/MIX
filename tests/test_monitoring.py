from __future__ import annotations

import asyncio
import time

import pytest

from engine.monitoring.metrics import MetricsCollector, _percentile


# --- Unit: MetricsCollector core logic ---


@pytest.mark.asyncio
async def test_record_request_increments_total() -> None:
    collector = MetricsCollector()
    await collector.record_request("/api/chat", 50.0, 200)
    await collector.record_request("/api/chat", 100.0, 200)
    metrics = await collector.get_metrics()
    assert metrics["requests"]["total"] == 2


@pytest.mark.asyncio
async def test_record_request_by_endpoint() -> None:
    collector = MetricsCollector()
    await collector.record_request("/api/chat", 50.0, 200)
    await collector.record_request("/api/health", 10.0, 200)
    await collector.record_request("/api/chat", 80.0, 200)
    metrics = await collector.get_metrics()
    assert metrics["requests"]["by_endpoint"]["/api/chat"] == 2
    assert metrics["requests"]["by_endpoint"]["/api/health"] == 1


@pytest.mark.asyncio
async def test_record_request_by_status() -> None:
    collector = MetricsCollector()
    await collector.record_request("/api/chat", 50.0, 200)
    await collector.record_request("/api/chat", 50.0, 400)
    await collector.record_request("/api/chat", 50.0, 500)
    metrics = await collector.get_metrics()
    assert metrics["requests"]["by_status"]["200"] == 1
    assert metrics["requests"]["by_status"]["400"] == 1
    assert metrics["requests"]["by_status"]["500"] == 1


@pytest.mark.asyncio
async def test_avg_duration_calculation() -> None:
    collector = MetricsCollector()
    await collector.record_request("/api/chat", 100.0, 200)
    await collector.record_request("/api/chat", 200.0, 200)
    await collector.record_request("/api/chat", 300.0, 200)
    metrics = await collector.get_metrics()
    assert metrics["requests"]["avg_duration_ms"] == 200.0


@pytest.mark.asyncio
async def test_p95_duration_calculation() -> None:
    collector = MetricsCollector()
    # 20 values: 10, 20, 30, ... 200
    for i in range(1, 21):
        await collector.record_request("/api/test", float(i * 10), 200)
    metrics = await collector.get_metrics()
    # p95 of 20 values: nearest-rank method -> index 20*95/100 - 1 = 18
    # sorted[18] = 190.0 (1-indexed: 10,20,...,200 -> index 18 is 190)
    assert metrics["requests"]["p95_duration_ms"] == 190.0


@pytest.mark.asyncio
async def test_p95_empty() -> None:
    collector = MetricsCollector()
    metrics = await collector.get_metrics()
    assert metrics["requests"]["p95_duration_ms"] == 0.0


@pytest.mark.asyncio
async def test_avg_duration_empty() -> None:
    collector = MetricsCollector()
    metrics = await collector.get_metrics()
    assert metrics["requests"]["avg_duration_ms"] == 0.0


@pytest.mark.asyncio
async def test_record_llm_call() -> None:
    collector = MetricsCollector()
    await collector.record_llm_call("openai", 150.0, 500)
    await collector.record_llm_call("openai", 200.0, 300)
    await collector.record_llm_call("anthropic", 100.0, 400)
    metrics = await collector.get_metrics()
    assert metrics["llm"]["total_calls"] == 3
    assert metrics["llm"]["by_provider"]["openai"] == 2
    assert metrics["llm"]["by_provider"]["anthropic"] == 1
    assert metrics["llm"]["total_tokens"] == 1200
    assert metrics["llm"]["avg_latency_ms"] > 0


@pytest.mark.asyncio
async def test_uptime_increases() -> None:
    collector = MetricsCollector()
    metrics1 = await collector.get_metrics()
    await asyncio.sleep(0.05)
    metrics2 = await collector.get_metrics()
    assert metrics2["uptime_seconds"] > metrics1["uptime_seconds"]


@pytest.mark.asyncio
async def test_session_and_memory_counts() -> None:
    collector = MetricsCollector()
    collector.set_active_sessions(5)
    collector.set_memory_entries(42)
    metrics = await collector.get_metrics()
    assert metrics["sessions"]["active_count"] == 5
    assert metrics["memory"]["entry_count"] == 42


@pytest.mark.asyncio
async def test_reset_clears_all_metrics() -> None:
    collector = MetricsCollector()
    await collector.record_request("/api/chat", 50.0, 200)
    await collector.record_llm_call("openai", 100.0, 500)
    collector.set_active_sessions(3)
    collector.set_memory_entries(10)

    await collector.reset()

    metrics = await collector.get_metrics()
    assert metrics["requests"]["total"] == 0
    assert metrics["requests"]["by_endpoint"] == {}
    assert metrics["requests"]["by_status"] == {}
    assert metrics["llm"]["total_calls"] == 0
    assert metrics["llm"]["by_provider"] == {}
    assert metrics["llm"]["total_tokens"] == 0
    assert metrics["sessions"]["active_count"] == 0
    assert metrics["memory"]["entry_count"] == 0


@pytest.mark.asyncio
async def test_timestamp_present() -> None:
    collector = MetricsCollector()
    metrics = await collector.get_metrics()
    assert "timestamp" in metrics
    assert isinstance(metrics["timestamp"], float)
    assert metrics["timestamp"] > 0


# --- Unit: _percentile helper ---


def test_percentile_basic() -> None:
    values = [10.0, 20.0, 30.0, 40.0, 50.0]
    # nearest-rank: idx = max(0, n*pct/100 - 1)
    # p50: max(0, 5*50/100 - 1) = max(0, 1) = 1 -> sorted[1] = 20.0
    assert _percentile(values, 50) == 20.0
    assert _percentile(values, 100) == 50.0
    assert _percentile(values, 0) == 10.0


def test_percentile_single_value() -> None:
    assert _percentile([42.0], 95) == 42.0


def test_percentile_empty() -> None:
    assert _percentile([], 95) == 0.0


def test_percentile_p95_twenty_values() -> None:
    values = [float(i) for i in range(1, 21)]
    # p95: index = max(0, 20*95/100 - 1) = 18, sorted[18] = 19.0
    assert _percentile(values, 95) == 19.0


# --- Integration: FastAPI endpoint ---


@pytest.mark.asyncio
async def test_metrics_endpoint() -> None:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from engine.api.routes import router, init_routes
    from engine.monitoring.metrics import MetricsCollector

    collector = MetricsCollector()
    await collector.record_request("/api/chat", 50.0, 200)

    init_routes(
        agent_loop=None,  # type: ignore[arg-type]
        metrics=collector,
    )

    app = FastAPI()
    app.include_router(router, prefix="/api")
    client = TestClient(app)

    resp = client.get("/api/metrics")
    assert resp.status_code == 200
    body = resp.json()
    assert body["requests"]["total"] == 1
    assert body["requests"]["by_endpoint"]["/api/chat"] == 1
    assert "uptime_seconds" in body
    assert "timestamp" in body
    assert "channels" in body
