import type { RouteContext } from "./types.js";
import type { MetricsMiddleware } from "../monitoring/metrics.js";
import type { ChannelRegistry } from "../channels/registry.js";

export function registerHealthRoutes(
  ctx: RouteContext,
  metricsMiddleware: MetricsMiddleware,
  channels: ChannelRegistry,
): void {
  const { app, bridge } = ctx;

  app.get("/api/health", async () => {
    try {
      const engine = await bridge.health();
      return {
        status: "ok",
        gateway: "mix-gateway",
        engine,
        channels: channels.listChannels(),
      };
    } catch {
      return {
        status: "degraded",
        gateway: "mix-gateway",
        engine: "unreachable",
        channels: channels.listChannels(),
      };
    }
  });

  // Config (proxied)
  app.get("/api/config", async (request, reply) => {
    try {
      const res = await bridge.proxyGet("/api/config");
      return await res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.put("/api/config", async (request, reply) => {
    try {
      const res = await bridge.proxyPut("/api/config", request.body);
      if (res.status === 204) {
        reply.code(204);
        return;
      }
      return await res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  // API Docs
  app.get("/api/docs", async (_request, reply) => {
    const res = await bridge.proxyGet("/docs");
    const body = await res.text();
    reply.headers(Object.fromEntries(res.headers.entries()));
    reply.type("text/html");
    return body;
  });

  app.get("/api/openapi.json", async (_request, reply) => {
    const res = await bridge.proxyGet("/openapi.json");
    const body = await res.text();
    reply.headers(Object.fromEntries(res.headers.entries()));
    reply.type("application/json");
    return body;
  });

  // Metrics
  app.get("/api/metrics", async () => {
    const gatewayMetrics = metricsMiddleware.getMetrics();
    gatewayMetrics.channels = channels.listChannels();
    try {
      const engineRes = await bridge.proxyGet("/api/metrics");
      const engineMetrics = await engineRes.json();
      return { gateway: gatewayMetrics, engine: engineMetrics };
    } catch {
      return { gateway: gatewayMetrics, engine: null };
    }
  });

  app.get("/metrics", async (_request, reply) => {
    try {
      const res = await bridge.proxyGet("/api/metrics/prometheus");
      reply.type("text/plain; version=0.0.4; charset=utf-8");
      return res.text();
    } catch {
      reply.code(502);
      return "# Engine unreachable\n";
    }
  });

  // Skills (proxied, simple GET)
  app.get("/api/skills", async (request, reply) => {
    try {
      const res = await bridge.proxyGet("/api/skills");
      return await res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });
}
