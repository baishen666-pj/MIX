import type { RouteContext } from "./types.js";

export function registerAgentRoutes(ctx: RouteContext): void {
  const { app, bridge } = ctx;

  app.get("/api/agents", async () => {
    try {
      const res = await bridge.proxyGet("/api/agents");
      return await res.json();
    } catch {
      return { agents: [{ name: "main", channels: [], model: "default" }] };
    }
  });

  app.post("/api/agents", async (request, reply) => {
    try {
      const res = await bridge.proxyPost("/api/agents", request.body);
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

  app.get("/api/agents/roles", async (request, reply) => {
    try {
      const res = await bridge.proxyGet("/api/agents/roles");
      return await res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.get("/api/agents/collaborations", async () => {
    try {
      const res = await bridge.proxyGet("/api/agents/collaborations");
      return await res.json();
    } catch {
      return { plans: [] };
    }
  });

  app.post("/api/agents/collaborate", async (request, reply) => {
    try {
      const res = await bridge.proxyPost("/api/agents/collaborate", request.body);
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

  app.get("/api/agents/collaborate/:planId", async (request, reply) => {
    try {
      const { planId } = request.params as { planId: string };
      const res = await bridge.proxyGet(`/api/agents/collaborate/${encodeURIComponent(planId)}`);
      return await res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.get("/api/agents/:name", async (request, reply) => {
    try {
      const { name } = request.params as { name: string };
      const res = await bridge.proxyGet(`/api/agents/${encodeURIComponent(name)}`);
      return await res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.put("/api/agents/:name", async (request, reply) => {
    try {
      const { name } = request.params as { name: string };
      const res = await bridge.proxyPut(`/api/agents/${encodeURIComponent(name)}`, request.body);
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

  app.delete("/api/agents/:name", async (request, reply) => {
    try {
      const { name } = request.params as { name: string };
      const res = await bridge.proxyDelete(`/api/agents/${encodeURIComponent(name)}`);
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
}
