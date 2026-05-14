import type { RouteContext } from "./types.js";

export function registerPluginRoutes(ctx: RouteContext): void {
  const { app, bridge } = ctx;

  app.post("/api/plugins/install", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const res = await fetch(`${bridge.getBaseUrl()}/api/plugins/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.post("/api/plugins/uninstall", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const res = await fetch(`${bridge.getBaseUrl()}/api/plugins/uninstall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.post("/api/plugins/update", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const res = await fetch(`${bridge.getBaseUrl()}/api/plugins/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.get("/api/plugins/available", async (request, reply) => {
    try {
      const query = request.query as Record<string, string>;
      const params = new URLSearchParams(query);
      const res = await bridge.proxyGet(`/api/plugins/available?${params}`);
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  // Alias: GET /api/plugins -> /api/plugins/available
  app.get("/api/plugins", async (request, reply) => {
    try {
      const query = request.query as Record<string, string>;
      const params = new URLSearchParams(query);
      const res = await bridge.proxyGet(`/api/plugins/available?${params}`);
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  // Marketplace
  app.get("/api/plugins/marketplace", async (request, reply) => {
    try {
      const query = request.query as Record<string, string>;
      const params = new URLSearchParams(query);
      const res = await bridge.proxyGet(`/api/plugins/marketplace?${params}`);
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.get("/api/plugins/marketplace/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const res = await bridge.proxyGet(`/api/plugins/marketplace/${encodeURIComponent(id)}`);
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.post("/api/plugins/marketplace/refresh", async (request, reply) => {
    try {
      const res = await fetch(`${bridge.getBaseUrl()}/api/plugins/marketplace/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.post("/api/plugins/marketplace/install", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const res = await fetch(`${bridge.getBaseUrl()}/api/plugins/marketplace/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });
}
