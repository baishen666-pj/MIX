import type { RouteContext } from "./types.js";
import type { ApiKeyAuth } from "../security/api-key.js";
import { validate, wsMessageSchema } from "../schemas.js";

export function registerWebSocketRoutes(ctx: RouteContext, apiKeyAuth: ApiKeyAuth): void {
  const { app, bridge, corsOrigins } = ctx;

  app.register(async function (fastify) {
    fastify.get("/ws/chat", { websocket: true }, (socket, req) => {
      const origin = req.headers.origin;
      if (origin && !corsOrigins.includes(origin)) {
        socket.close(4003, "Forbidden origin");
        return;
      }

      if (apiKeyAuth.isEnabled()) {
        const token = (req.query as Record<string, string | undefined> | undefined)?.token
          || (req.headers["sec-websocket-protocol"] as string | undefined)
          || req.headers.authorization?.replace("Bearer ", "");
        if (!token || !apiKeyAuth.validateKey(token)) {
          socket.close(4001, "Unauthorized");
          return;
        }
      }

      socket.on("message", async (raw: Buffer) => {
        let data;
        try {
          data = validate(wsMessageSchema, JSON.parse(raw.toString()));
        } catch (err) {
          socket.send(JSON.stringify({ error: "Invalid message format" }));
          return;
        }
        try {
          for await (const chunk of bridge.chatStream({
            message: data.message,
            session_id: data.session_id,
          })) {
            socket.send(JSON.stringify(chunk));
            if (chunk.done) break;
          }
        } catch (err) {
          socket.send(JSON.stringify({ error: String(err), done: true }));
        }
      });
    });
  });
}
