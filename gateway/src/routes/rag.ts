import type { RouteContext } from "./types.js";

export function registerRagRoutes(ctx: RouteContext): void {
  const { app, bridge } = ctx;

  app.post("/api/rag/collections", async (request, reply) => {
    try {
      const res = await bridge.proxyPost("/api/rag/collections", request.body);
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

  app.get("/api/rag/collections", async (request, reply) => {
    try {
      const res = await bridge.proxyGet("/api/rag/collections");
      return await res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.get("/api/rag/collections/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const res = await bridge.proxyGet(`/api/rag/collections/${encodeURIComponent(id)}`);
      return await res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.delete("/api/rag/collections/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const res = await bridge.proxyDelete(`/api/rag/collections/${encodeURIComponent(id)}`);
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

  app.post("/api/rag/collections/:id/documents", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const data = await request.file();
      if (!data) {
        reply.code(400);
        return { error: "No file uploaded" };
      }
      const buffer = await data.toBuffer();
      const file = new File([new Uint8Array(buffer)], data.filename, { type: data.mimetype });
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `${bridge.getBaseUrl()}/api/rag/collections/${encodeURIComponent(id)}/documents`,
        { method: "POST", body: formData },
      );
      return await res.json();
    } catch (err) {
      reply.code(502);
      return { error: String(err) };
    }
  });

  app.get("/api/rag/collections/:id/documents", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const res = await bridge.proxyGet(`/api/rag/collections/${encodeURIComponent(id)}/documents`);
      return await res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.delete("/api/rag/documents/:docId", async (request, reply) => {
    try {
      const { docId } = request.params as { docId: string };
      const res = await bridge.proxyDelete(`/api/rag/documents/${encodeURIComponent(docId)}`);
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

  app.post("/api/rag/query", async (request, reply) => {
    try {
      const res = await bridge.proxyPost("/api/rag/query", request.body);
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
