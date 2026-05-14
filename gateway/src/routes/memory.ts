import type { RouteContext } from "./types.js";

export function registerMemoryRoutes(ctx: RouteContext): void {
  const { app, bridge } = ctx;

  app.post("/api/memory/search", async (request, reply) => {
    try {
      const res = await bridge.proxyPost("/api/memory/search", request.body);
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

  app.post("/api/memory/ingest", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const result = await bridge.ingestDocument(
        String(body.text ?? ""),
        body.source ? String(body.source) : undefined,
        body.chunk_size ? Number(body.chunk_size) : undefined,
      );
      return result;
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.post("/api/memory/upload", async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        reply.code(400);
        return { error: "No file uploaded" };
      }
      const buffer = await data.toBuffer();
      const file = new File([new Uint8Array(buffer)], data.filename, { type: data.mimetype });
      const result = await bridge.uploadFile(file);
      return result;
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });
}
