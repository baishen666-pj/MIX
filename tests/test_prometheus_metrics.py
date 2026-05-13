"""Tests for Prometheus metrics format output."""

from __future__ import annotations

import pytest

from engine.monitoring.metrics import MetricsCollector


@pytest.mark.asyncio
async def test_prometheus_format_contains_all_metrics() -> None:
    collector = MetricsCollector(window_seconds=60)
    await collector.record_request("/api/chat", 120.5, 200)
    await collector.record_request("/api/chat", 50.0, 200)
    await collector.record_request("/api/skills", 30.0, 404)
    await collector.record_llm_call("openai", 500.0, 150)
    collector.set_active_sessions(3)
    collector.set_memory_entries(42)

    output = await collector.prometheus_format()

    assert "mix_uptime_seconds" in output
    assert "mix_requests_total 3" in output
    assert 'mix_request_duration_ms{quantile="avg"}' in output
    assert 'mix_request_duration_ms{quantile="p95"}' in output
    assert "mix_llm_calls_total 1" in output
    assert "mix_llm_tokens_total 150" in output
    assert "mix_active_sessions 3" in output
    assert "mix_memory_entries 42" in output


@pytest.mark.asyncio
async def test_prometheus_format_has_type_hints() -> None:
    collector = MetricsCollector()
    output = await collector.prometheus_format()

    assert "# TYPE mix_uptime_seconds gauge" in output
    assert "# TYPE mix_requests_total counter" in output
    assert "# TYPE mix_llm_calls_total counter" in output
    assert "# TYPE mix_active_sessions gauge" in output


@pytest.mark.asyncio
async def test_prometheus_format_empty_collector() -> None:
    collector = MetricsCollector()
    output = await collector.prometheus_format()

    assert "mix_requests_total 0" in output
    assert "mix_llm_calls_total 0" in output
    assert "mix_active_sessions 0" in output


@pytest.mark.asyncio
async def test_prometheus_format_endpoint_labels() -> None:
    collector = MetricsCollector()
    await collector.record_request("/api/chat", 10.0, 200)
    await collector.record_request("/api/sessions", 20.0, 200)

    output = await collector.prometheus_format()

    assert 'endpoint="api_chat"' in output
    assert 'endpoint="api_sessions"' in output


@pytest.mark.asyncio
async def test_prometheus_format_status_labels() -> None:
    collector = MetricsCollector()
    await collector.record_request("/api/test", 10.0, 200)
    await collector.record_request("/api/test", 10.0, 404)
    await collector.record_request("/api/test", 10.0, 500)

    output = await collector.prometheus_format()

    assert 'status="200"' in output
    assert 'status="404"' in output
    assert 'status="500"' in output


@pytest.mark.asyncio
async def test_prometheus_format_provider_labels() -> None:
    collector = MetricsCollector()
    await collector.record_llm_call("openai", 100.0, 50)
    await collector.record_llm_call("anthropic", 200.0, 80)

    output = await collector.prometheus_format()

    assert 'provider="openai"' in output
    assert 'provider="anthropic"' in output
