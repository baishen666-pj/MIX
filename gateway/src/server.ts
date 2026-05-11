import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import type { GatewayConfig } from "./utils/config.js";
import { EngineBridge } from "./bridge.js";
import { ChannelRegistry } from "./channels/registry.js";
import { WebChatChannel } from "./channels/webchat.js";
import { logger } from "./utils/logger.js";

export async function createServer(config: GatewayConfig) {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(websocket);

  const bridge = new EngineBridge({
    engineHost: config.engine.host,
    enginePort: config.engine.port,
  });

  const channels = new ChannelRegistry();
  const webchat = new WebChatChannel();
  channels.register(webchat);

  channels.onMessage(async (msg) => {
    logger.info(`Message from ${msg.channel}: ${msg.userId}`);
    try {
      const response = await bridge.chat({
        message: msg.content,
        session_id: msg.metadata.sessionId as string | undefined,
        channel: msg.channel,
      });
      logger.info(`Response: ${response.content.slice(0, 100)}...`);
    } catch (err) {
      logger.error("Engine error", err);
    }
  });

  app.get("/api/health", async () => {
    try {
      const engine = await bridge.health();
      return { status: "ok", gateway: "mix-gateway", engine };
    } catch {
      return { status: "degraded", gateway: "mix-gateway", engine: "unreachable" };
    }
  });

  app.post("/api/chat", async (request, reply) => {
    const body = request.body as { message: string; session_id?: string };
    try {
      const response = await bridge.chat({
        message: body.message,
        session_id: body.session_id,
      });
      return response;
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable", details: String(err) };
    }
  });

  app.register(async function (fastify) {
    fastify.get("/ws/chat", { websocket: true }, (socket, _req) => {
      socket.on("message", async (raw: Buffer) => {
        const data = JSON.parse(raw.toString());
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

  return { app, channels, bridge };
}
