import type { RouteContext } from "./types.js";

export function registerToolRoutes(ctx: RouteContext): void {
  const { app, bridge } = ctx;

  app.post("/api/tools/dynamic", async (request, reply) => {
    try {
      const res = await bridge.proxyPost("/api/tools/dynamic", request.body);
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

  app.delete("/api/tools/dynamic/:name", async (request, reply) => {
    try {
      const { name } = request.params as { name: string };
      const res = await bridge.proxyDelete(`/api/tools/dynamic/${encodeURIComponent(name)}`);
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

  app.post("/api/tools/chain", async (request, reply) => {
    try {
      const res = await bridge.proxyPost("/api/tools/chain", request.body);
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

  app.get("/api/tools/approval/pending", async () => {
    try {
      const res = await bridge.proxyGet("/api/tools/approval/pending");
      return await res.json();
    } catch {
      return { requests: [] };
    }
  });

  app.post("/api/tools/approval/:requestId/approve", async (request, reply) => {
    try {
      const { requestId } = request.params as { requestId: string };
      const res = await bridge.proxyPost(`/api/tools/approval/${encodeURIComponent(requestId)}/approve`, request.body);
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

  app.post("/api/tools/approval/:requestId/reject", async (request, reply) => {
    try {
      const { requestId } = request.params as { requestId: string };
      const res = await bridge.proxyPost(`/api/tools/approval/${encodeURIComponent(requestId)}/reject`, request.body);
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

  app.get("/api/tools/history", async (request) => {
    const query = (request.query as Record<string, string>) || {};
    const params = new URLSearchParams(query).toString();
    try {
      const res = await bridge.proxyGet(`/api/tools/history?${params}`);
      return await res.json();
    } catch {
      return { records: [] };
    }
  });

  app.get("/api/tools/history/stats", async () => {
    try {
      const res = await bridge.proxyGet("/api/tools/history/stats");
      return await res.json();
    } catch {
      return { total: 0, tools: {}, avg_time_ms: 0 };
    }
  });

  app.get("/api/tools/chains/:chainId", async (request, reply) => {
    try {
      const { chainId } = request.params as { chainId: string };
      const res = await bridge.proxyGet(`/api/tools/chains/${encodeURIComponent(chainId)}`);
      return await res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });
}
