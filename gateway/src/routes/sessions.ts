import type { RouteContext } from "./types.js";

export function registerSessionRoutes(ctx: RouteContext): void {
  const { app, bridge } = ctx;

  app.get("/api/sessions", async (request, reply) => {
    try {
      const res = await bridge.proxyGet("/api/sessions");
      return await res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.delete("/api/sessions/:sessionId", async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const res = await fetch(`${bridge.getBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.get("/api/sessions/search", async (request, reply) => {
    try {
      const targetPath = `/api/sessions/search?${new URLSearchParams(request.query as Record<string, string>)}`;
      const res = await bridge.proxyGet(targetPath);
      return await res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.get("/api/sessions/:sessionId/export", async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const query = request.query as Record<string, string>;
      const params = new URLSearchParams(query);
      const res = await bridge.proxyGet(`/api/sessions/${encodeURIComponent(sessionId)}/export?${params}`);
      const contentType = res.headers.get("content-type") || "application/json";
      reply.type(contentType);
      if (contentType.includes("text/plain")) {
        return res.text();
      }
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.get("/api/sessions/:sessionId", async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const res = await bridge.proxyGet(`/api/sessions/${encodeURIComponent(sessionId)}`);
      return await res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });
}
