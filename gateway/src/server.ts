import Fastify, { type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import type { GatewayConfig } from "./utils/config.js";
import { EngineBridge } from "./bridge.js";
import { DmPairing, DmSecurityFilter } from "./security/dm-pairing.js";
import type { DmPairingConfig } from "./security/acl.js";
import { ApiKeyAuth } from "./security/api-key.js";
import { logger } from "./utils/logger.js";
import { validate, chatRequestSchema, pairingApproveSchema, wsMessageSchema } from "./schemas.js";
import { MetricsMiddleware } from "./monitoring/metrics.js";
import { setupChannels } from "./routes/channel-setup.js";
import { registerChannelWebhooks } from "./routes/channel-webhooks.js";

// ---------------------------------------------------------------------------
// Proxy route helpers
// ---------------------------------------------------------------------------

type ProxyMethod = "get" | "post" | "put" | "delete";

function proxyRoute(
  bridge: EngineBridge,
  app: FastifyInstance,
  method: ProxyMethod,
  path: string,
  enginePathFn?: (req: FastifyRequest) => string,
  errorFallback?: unknown,
): void {
  const methodNames: Record<ProxyMethod, keyof EngineBridge> = {
    get: "proxyGet",
    post: "proxyPost",
    put: "proxyPut",
    delete: "proxyDelete",
  };

  app[method](path, async (request, reply) => {
    try {
      const bridgeFn = bridge[methodNames[method]].bind(bridge);
      const targetPath = enginePathFn ? enginePathFn(request) : path;

      let res: Response;
      if (method === "post" || method === "put") {
        res = await (bridgeFn as (p: string, b: unknown) => Promise<Response>)(targetPath, request.body);
      } else {
        res = await (bridgeFn as (p: string) => Promise<Response>)(targetPath);
      }

      if (res.status === 204) {
        reply.code(204);
        return;
      }
      return await res.json();
    } catch (err) {
      if (errorFallback !== undefined) return errorFallback;
      reply.code(502);
      return { error: "Engine unreachable", details: String(err) };
    }
  });
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export async function createServer(config: GatewayConfig) {
  const app = Fastify({ logger: false });
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
  // Health
  // -----------------------------------------------------------------------

  app.get("/api/health", async () => {
    try {
      const engine = await bridge.health();
      return {
        status: "ok",
        gateway: "mix-gateway",
        engine,
        channels: channels.listChannels(),
      };
    } catch {
      return {
        status: "degraded",
        gateway: "mix-gateway",
        engine: "unreachable",
        channels: channels.listChannels(),
      };
    }
  });

  // -----------------------------------------------------------------------
  // Config
  // -----------------------------------------------------------------------

  proxyRoute(bridge, app, "get", "/api/config");
  proxyRoute(bridge, app, "put", "/api/config");

  // -----------------------------------------------------------------------
  // API Docs
  // -----------------------------------------------------------------------

  app.get("/api/docs", async (_request, reply) => {
    const res = await bridge.proxyGet("/docs");
    const body = await res.text();
    reply.headers(Object.fromEntries(res.headers.entries()));
    reply.type("text/html");
    return body;
  });

  app.get("/api/openapi.json", async (_request, reply) => {
    const res = await bridge.proxyGet("/openapi.json");
    const body = await res.text();
    reply.headers(Object.fromEntries(res.headers.entries()));
    reply.type("application/json");
    return body;
  });

  // -----------------------------------------------------------------------
  // Metrics
  // -----------------------------------------------------------------------

  app.get("/api/metrics", async () => {
    const gatewayMetrics = metricsMiddleware.getMetrics();
    gatewayMetrics.channels = channels.listChannels();
    try {
      const engineRes = await bridge.proxyGet("/api/metrics");
      const engineMetrics = await engineRes.json();
      return { gateway: gatewayMetrics, engine: engineMetrics };
    } catch {
      return { gateway: gatewayMetrics, engine: null };
    }
  });

  app.get("/metrics", async (_request, reply) => {
    try {
      const res = await bridge.proxyGet("/api/metrics/prometheus");
      reply.type("text/plain; version=0.0.4; charset=utf-8");
      return res.text();
    } catch {
      reply.code(502);
      return "# Engine unreachable\n";
    }
  });

  // -----------------------------------------------------------------------
  // Chat
  // -----------------------------------------------------------------------

  app.post("/api/chat", async (request, reply) => {
    let body;
    try {
      body = validate(chatRequestSchema, request.body);
    } catch (err) {
      reply.code(400);
      return { error: "Validation failed", details: String(err) };
    }
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
      reply.raw.write(`data: ${JSON.stringify({ error: String(err), done: true })}\n\n`);
    }
    reply.raw.end();
  });

  // -----------------------------------------------------------------------
  // Pairing
  // -----------------------------------------------------------------------

  app.post("/api/pairing/approve", async (request, reply) => {
    let body;
    try {
      body = validate(pairingApproveSchema, request.body);
    } catch (err) {
      reply.code(400);
      return { error: "Validation failed", details: String(err) };
    }
    const approved = pairing.approvePairing(body.channel, body.code);
    return { approved };
  });

  app.get("/api/pairing/pending", async () => {
    return { pending: pairing.getPendingPairings() };
  });

  // -----------------------------------------------------------------------
  // Skills
  // -----------------------------------------------------------------------

  proxyRoute(bridge, app, "get", "/api/skills");

  // -----------------------------------------------------------------------
  // Plugins
  // -----------------------------------------------------------------------

  app.post("/api/plugins/install", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const res = await fetch(`${bridge["baseUrl"]}/api/plugins/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable", details: String(err) };
    }
  });

  app.post("/api/plugins/uninstall", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const res = await fetch(`${bridge["baseUrl"]}/api/plugins/uninstall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable", details: String(err) };
    }
  });

  app.post("/api/plugins/update", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const res = await fetch(`${bridge["baseUrl"]}/api/plugins/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable", details: String(err) };
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
      return { error: "Engine unreachable", details: String(err) };
    }
  });

  // -----------------------------------------------------------------------
  // Memory
  // -----------------------------------------------------------------------

  proxyRoute(bridge, app, "post", "/api/memory/search");

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
      return { error: "Engine unreachable", details: String(err) };
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
      return { error: "Engine unreachable", details: String(err) };
    }
  });

  // -----------------------------------------------------------------------
  // Sessions
  // -----------------------------------------------------------------------

  proxyRoute(bridge, app, "get", "/api/sessions");

  app.delete("/api/sessions/:sessionId", async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const res = await fetch(`${bridge["baseUrl"]}/api/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable", details: String(err) };
    }
  });

  proxyRoute(
    bridge, app, "get", "/api/sessions/search",
    (req) => `/api/sessions/search?${new URLSearchParams(req.query as Record<string, string>)}`,
  );

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
      return { error: "Engine unreachable", details: String(err) };
    }
  });

  proxyRoute(
    bridge, app, "get", "/api/sessions/:sessionId",
    (req) => `/api/sessions/${encodeURIComponent((req.params as { sessionId: string }).sessionId)}`,
  );

  // -----------------------------------------------------------------------
  // WebSocket
  // -----------------------------------------------------------------------

  app.register(async function (fastify) {
    fastify.get("/ws/chat", { websocket: true }, (socket, req) => {
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
          socket.send(JSON.stringify({ error: "Invalid message format", details: String(err) }));
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

  // -----------------------------------------------------------------------
  // RAG
  // -----------------------------------------------------------------------

  proxyRoute(bridge, app, "post", "/api/rag/collections");
  proxyRoute(bridge, app, "get", "/api/rag/collections");
  proxyRoute(bridge, app, "get", "/api/rag/collections/:id",
    (req) => `/api/rag/collections/${encodeURIComponent((req.params as { id: string }).id)}`);
  proxyRoute(bridge, app, "delete", "/api/rag/collections/:id",
    (req) => `/api/rag/collections/${encodeURIComponent((req.params as { id: string }).id)}`);

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

  proxyRoute(bridge, app, "get", "/api/rag/collections/:id/documents",
    (req) => `/api/rag/collections/${encodeURIComponent((req.params as { id: string }).id)}/documents`);
  proxyRoute(bridge, app, "delete", "/api/rag/documents/:docId",
    (req) => `/api/rag/documents/${encodeURIComponent((req.params as { docId: string }).docId)}`);
  proxyRoute(bridge, app, "post", "/api/rag/query");

  // -----------------------------------------------------------------------
  // Tools
  // -----------------------------------------------------------------------

  proxyRoute(bridge, app, "post", "/api/tools/dynamic");
  proxyRoute(bridge, app, "delete", "/api/tools/dynamic/:name",
    (req) => `/api/tools/dynamic/${encodeURIComponent((req.params as { name: string }).name)}`);
  proxyRoute(bridge, app, "post", "/api/tools/chain");
  proxyRoute(bridge, app, "get", "/api/tools/approval/pending", undefined, { requests: [] });
  proxyRoute(bridge, app, "post", "/api/tools/approval/:requestId/approve",
    (req) => `/api/tools/approval/${encodeURIComponent((req.params as { requestId: string }).requestId)}/approve`);
  proxyRoute(bridge, app, "post", "/api/tools/approval/:requestId/reject",
    (req) => `/api/tools/approval/${encodeURIComponent((req.params as { requestId: string }).requestId)}/reject`);

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

  proxyRoute(bridge, app, "get", "/api/tools/history/stats", undefined, { total: 0, tools: {}, avg_time_ms: 0 });

  proxyRoute(bridge, app, "get", "/api/tools/chains/:chainId",
    (req) => `/api/tools/chains/${encodeURIComponent((req.params as { chainId: string }).chainId)}`);

  // -----------------------------------------------------------------------
  // Agents
  // -----------------------------------------------------------------------

  proxyRoute(bridge, app, "get", "/api/agents", undefined, { agents: [{ name: "main", channels: [], model: "default" }] });
  proxyRoute(bridge, app, "post", "/api/agents");
  proxyRoute(bridge, app, "get", "/api/agents/roles");
  proxyRoute(bridge, app, "get", "/api/agents/collaborations", undefined, { plans: [] });
  proxyRoute(bridge, app, "post", "/api/agents/collaborate");
  proxyRoute(bridge, app, "get", "/api/agents/collaborate/:planId",
    (req) => `/api/agents/collaborate/${encodeURIComponent((req.params as { planId: string }).planId)}`);
  proxyRoute(bridge, app, "get", "/api/agents/:name",
    (req) => `/api/agents/${encodeURIComponent((req.params as { name: string }).name)}`);
  proxyRoute(bridge, app, "put", "/api/agents/:name",
    (req) => `/api/agents/${encodeURIComponent((req.params as { name: string }).name)}`);
  proxyRoute(bridge, app, "delete", "/api/agents/:name",
    (req) => `/api/agents/${encodeURIComponent((req.params as { name: string }).name)}`);

  // -----------------------------------------------------------------------
  // Voice
  // -----------------------------------------------------------------------

  app.post("/api/voice/stt", async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        reply.code(400);
        return { error: "No audio file uploaded" };
      }
      const buffer = await data.toBuffer();
      const file = new File([new Uint8Array(buffer)], data.filename, { type: data.mimetype });
      const result = await bridge.transcribeAudio(file);
      return result;
    } catch (err) {
      reply.code(502);
      return { error: "Voice transcription failed", details: String(err) };
    }
  });

  app.post("/api/voice/tts", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const text = body.text as string;
      if (!text) {
        reply.code(400);
        return { error: "text is required" };
      }
      const stream = body.stream as boolean | undefined;
      const voice = body.voice as string | undefined;
      const model = body.model as string | undefined;

      if (stream) {
        reply.raw.writeHead(200, {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-cache",
        });
        for await (const chunk of bridge.synthesizeSpeechStream(text, voice, model)) {
          reply.raw.write(chunk);
        }
        reply.raw.end();
        return;
      }

      const result = await bridge.synthesizeSpeech(text, voice, model);
      return result;
    } catch (err) {
      reply.code(502);
      return { error: "Voice synthesis failed", details: String(err) };
    }
  });

  // -----------------------------------------------------------------------
  // Channel webhooks
  // -----------------------------------------------------------------------

  registerChannelWebhooks(app, channels, wechatAdapter);

  return { app, channels, bridge };
}
