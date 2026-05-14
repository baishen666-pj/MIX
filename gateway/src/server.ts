import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { GatewayConfig } from "./utils/config.js";
import { EngineBridge } from "./bridge.js";
import { DmPairing, DmSecurityFilter } from "./security/dm-pairing.js";
import type { DmPairingConfig } from "./security/acl.js";
import { ApiKeyAuth } from "./security/api-key.js";
import { logger } from "./utils/logger.js";
import { MetricsMiddleware } from "./monitoring/metrics.js";
import { setupChannels } from "./routes/channel-setup.js";
import { registerChannelWebhooks } from "./routes/channel-webhooks.js";
import type { RouteContext } from "./routes/types.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerPluginRoutes } from "./routes/plugins.js";
import { registerMemoryRoutes } from "./routes/memory.js";
import { registerSessionRoutes } from "./routes/sessions.js";
import { registerToolRoutes } from "./routes/tools.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerVoiceRoutes } from "./routes/voice.js";
import { registerPairingRoutes } from "./routes/pairing.js";
import { registerWebSocketRoutes } from "./routes/websocket.js";
import { registerRagRoutes } from "./routes/rag.js";

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export async function createServer(config: GatewayConfig) {
  const app: FastifyInstance = Fastify({ logger: false });
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : ["http://localhost:8080"];
  await app.register(cors, { origin: corsOrigins });
  await app.register(websocket);
  await app.register(multipart);

  const bridge = new EngineBridge({
    engineHost: config.engine.host,
    enginePort: config.engine.port,
  });

  const metricsMiddleware = new MetricsMiddleware();

  const { channels, wechatAdapter } = setupChannels();

  const apiKeyAuth = new ApiKeyAuth(process.env as Record<string, string | undefined>);

  const skipAuth = (url: string) =>
    url === "/api/health" ||
    url === "/api/webhook" ||
    url.startsWith("/api/webhook/") ||
    url.startsWith("/ws/");

  app.addHook("preHandler", (request, reply, done) => {
    if (skipAuth(request.url)) {
      done();
      return;
    }
    apiKeyAuth.authenticate(request, reply, done);
  });

  app.addHook("preHandler", (request, reply, done) => {
    if (skipAuth(request.url)) {
      done();
      return;
    }
    apiKeyAuth.rateLimit(request, reply, done);
  });

  const metricsStartMap = new WeakMap<FastifyRequest, number>();
  app.addHook("onRequest", (request, _reply, done) => {
    metricsStartMap.set(request, Date.now());
    done();
  });
  app.addHook("onResponse", (request, reply, done) => {
    const start = metricsStartMap.get(request);
    if (start) {
      const durationMs = Date.now() - start;
      metricsMiddleware.recordTimedRequest(
        request.url ?? "unknown",
        durationMs,
        reply.statusCode ?? 0,
      );
    }
    done();
  });

  const validPolicies = ["open", "pairing", "closed"] as const;
  const rawPolicy = process.env.DM_POLICY || "pairing";
  const policy: DmPairingConfig["policy"] = validPolicies.includes(rawPolicy as typeof validPolicies[number])
    ? rawPolicy as DmPairingConfig["policy"]
    : "pairing";
  const dmConfig: DmPairingConfig = {
    policy,
    allowedUsers: process.env.ALLOWED_USERS?.split(",").filter(Boolean) || [],
  };
  const pairing = new DmPairing(dmConfig);
  const securityFilter = new DmSecurityFilter(pairing);

  channels.onMessage(async (msg) => {
    logger.info(`Message from ${msg.channel}: ${msg.userId}`);

    const security = securityFilter.filter(msg);
    if (!security.allowed) {
      if (security.response) {
        await channels.send({
          ...msg,
          content: security.response,
          metadata: { ...msg.metadata, system: true },
        });
      }
      return;
    }

    try {
      const response = await bridge.chat({
        message: msg.content,
        session_id: msg.metadata.sessionId as string | undefined,
        channel: msg.channel,
      });
      await channels.send({
        id: `resp-${response.id}`,
        channel: msg.channel,
        userId: "mix",
        content: response.content,
        metadata: { ...msg.metadata, originalMsgId: msg.id },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error("Engine error", err);
    }
  });

  // -----------------------------------------------------------------------
  // Register route modules
  // -----------------------------------------------------------------------

  const ctx: RouteContext = { app, bridge, corsOrigins };

  registerHealthRoutes(ctx, metricsMiddleware, channels);
  registerChatRoutes(ctx);
  registerPairingRoutes(ctx, pairing);
  registerPluginRoutes(ctx);
  registerMemoryRoutes(ctx);
  registerSessionRoutes(ctx);
  registerToolRoutes(ctx);
  registerAgentRoutes(ctx);
  registerVoiceRoutes(ctx);
  registerRagRoutes(ctx);
  registerWebSocketRoutes(ctx, apiKeyAuth);

  // Channel webhooks
  registerChannelWebhooks(app, channels, wechatAdapter);

  return { app, channels, bridge };
}
