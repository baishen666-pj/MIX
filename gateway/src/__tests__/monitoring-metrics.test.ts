import { describe, it, expect } from "vitest";
import { MetricsMiddleware } from "../monitoring/metrics.js";

describe("MetricsMiddleware", () => {
  it("starts with zero metrics", () => {
    const middleware = new MetricsMiddleware();
    const metrics = middleware.getMetrics();

    expect(metrics.requests.total).toBe(0);
    expect(metrics.requests.avgDurationMs).toBe(0);
    expect(metrics.requests.byEndpoint).toEqual({});
    expect(metrics.requests.byStatus).toEqual({});
    expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    expect(metrics.channels).toEqual([]);
  });

  it("records a single timed request", () => {
    const middleware = new MetricsMiddleware();
    middleware.recordTimedRequest("/api/chat", 50, 200);

    const metrics = middleware.getMetrics();
    expect(metrics.requests.total).toBe(1);
    expect(metrics.requests.avgDurationMs).toBe(50);
    expect(metrics.requests.byStatus["200"]).toBe(1);
  });

  it("records multiple requests and computes averages", () => {
    const middleware = new MetricsMiddleware();
    middleware.recordTimedRequest("/api/chat", 100, 200);
    middleware.recordTimedRequest("/api/chat", 200, 200);
    middleware.recordTimedRequest("/api/health", 10, 200);

    const metrics = middleware.getMetrics();
    expect(metrics.requests.total).toBe(3);
    expect(metrics.requests.avgDurationMs).toBeCloseTo(103.33, 1);

    expect(metrics.requests.byEndpoint["/api/chat"]).toEqual({
      total: 2,
      avgDurationMs: 150,
      errorCount: 0,
    });
    expect(metrics.requests.byEndpoint["/api/health"]).toEqual({
      total: 1,
      avgDurationMs: 10,
      errorCount: 0,
    });
  });

  it("tracks error counts for status >= 400", () => {
    const middleware = new MetricsMiddleware();
    middleware.recordTimedRequest("/api/chat", 50, 200);
    middleware.recordTimedRequest("/api/chat", 50, 400);
    middleware.recordTimedRequest("/api/chat", 50, 500);

    const metrics = middleware.getMetrics();
    expect(metrics.requests.byStatus["200"]).toBe(1);
    expect(metrics.requests.byStatus["400"]).toBe(1);
    expect(metrics.requests.byStatus["500"]).toBe(1);

    expect(metrics.requests.byEndpoint["/api/chat"].errorCount).toBe(2);
  });

  it("tracks uptime increasing", async () => {
    const middleware = new MetricsMiddleware();
    const metrics1 = middleware.getMetrics();

    await new Promise((resolve) => setTimeout(resolve, 50));

    const metrics2 = middleware.getMetrics();
    expect(metrics2.uptime).toBeGreaterThan(metrics1.uptime);
  });

  it("reset clears all metrics", () => {
    const middleware = new MetricsMiddleware();
    middleware.recordTimedRequest("/api/chat", 50, 200);
    middleware.recordTimedRequest("/api/health", 10, 200);

    middleware.reset();

    const metrics = middleware.getMetrics();
    expect(metrics.requests.total).toBe(0);
    expect(metrics.requests.byEndpoint).toEqual({});
    expect(metrics.requests.byStatus).toEqual({});
    expect(metrics.requests.avgDurationMs).toBe(0);
  });

  it("does not mutate returned metrics objects", () => {
    const middleware = new MetricsMiddleware();
    middleware.recordTimedRequest("/api/chat", 50, 200);

    const metrics1 = middleware.getMetrics();
    metrics1.requests.byStatus["999"] = 42;

    const metrics2 = middleware.getMetrics();
    expect(metrics2.requests.byStatus["999"]).toBeUndefined();
  });
});
