import type { RouteContext } from "./types.js";
import { validate, chatRequestSchema } from "../schemas.js";
import { logger } from "../utils/logger.js";

export function registerChatRoutes(ctx: RouteContext): void {
  const { app, bridge } = ctx;

  app.post("/api/chat", async (request, reply) => {
    let body;
    try {
      body = validate(chatRequestSchema, request.body);
    } catch (err) {
      reply.code(400);
      return { error: "Validation failed" };
    }
    try {
      const response = await bridge.chat({
        message: body.message,
        session_id: body.session_id,
      });
      return response;
    } catch (err) {
      logger.error("Chat error", err);
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });

  app.get("/api/chat/stream", async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const message = query.message;
    if (!message) {
      reply.code(400);
      return { error: "message query parameter is required" };
    }
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    try {
      for await (const chunk of bridge.chatStreamSSE(message, query.session_id)) {
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
        if (chunk.done) break;
      }
      reply.raw.write("data: [DONE]\n\n");
    } catch (err) {
      logger.error("SSE stream error", err);
      reply.raw.write(`data: ${JSON.stringify({ error: "Stream interrupted", done: true })}\n\n`);
    }
    reply.raw.end();
  });
}
