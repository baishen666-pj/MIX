import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import type { GatewayConfig } from "./utils/config.js";
import { EngineBridge } from "./bridge.js";
import { ChannelRegistry } from "./channels/registry.js";
import { WebChatChannel } from "./channels/webchat.js";
import { TelegramChannel } from "./channels/telegram.js";
import { DiscordChannel } from "./channels/discord.js";
import { SlackChannel } from "./channels/slack.js";
import { WeChatChannel } from "./channels/wechat.js";
import { IrcChannel } from "./channels/irc.js";
import { WhatsAppChannel } from "./channels/whatsapp.js";
import { MatrixChannel } from "./channels/matrix.js";
import { LineChannel } from "./channels/line.js";
import { GoogleChatChannel } from "./channels/google-chat.js";
import { SignalChannel } from "./channels/signal.js";
import { TeamsChannel } from "./channels/teams.js";
import { IMessageChannel } from "./channels/imessage.js";
import { FeishuChannel } from "./channels/feishu.js";
import { DmPairing, DmSecurityFilter } from "./security/dm-pairing.js";
import type { DmPairingConfig } from "./security/acl.js";
import { ApiKeyAuth } from "./security/api-key.js";
import { logger } from "./utils/logger.js";
import { validate, chatRequestSchema, pairingApproveSchema, wsMessageSchema } from "./schemas.js";
import { MetricsMiddleware } from "./monitoring/metrics.js";

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

  const channels = new ChannelRegistry();
  const webchat = new WebChatChannel();
  channels.register(webchat);

  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (telegramToken) {
    channels.register(new TelegramChannel({ botToken: telegramToken }));
    logger.info("Telegram channel enabled");
  }

  const discordToken = process.env.DISCORD_BOT_TOKEN;
  if (discordToken) {
    channels.register(new DiscordChannel({ botToken: discordToken }));
    logger.info("Discord channel enabled");
  }

  const slackToken = process.env.SLACK_BOT_TOKEN;
  if (slackToken) {
    channels.register(new SlackChannel({ botToken: slackToken }));
    logger.info("Slack channel enabled");
  }

  const wechatWebhook = process.env.WECHAT_WEBHOOK_URL;
  let wechatAdapter: WeChatChannel | undefined;
  if (wechatWebhook) {
    wechatAdapter = new WeChatChannel({ webhookUrl: wechatWebhook });
    channels.register(wechatAdapter);
    logger.info("WeChat channel enabled");
  }

  const wechatCorpId = process.env.WECHAT_CORP_ID;
  const wechatAgentId = process.env.WECHAT_AGENT_ID;
  const wechatSecret = process.env.WECHAT_SECRET;
  if (!wechatWebhook && wechatCorpId && wechatAgentId && wechatSecret) {
    wechatAdapter = new WeChatChannel({ webhookUrl: "", corpId: wechatCorpId, agentId: wechatAgentId, secret: wechatSecret });
    channels.register(wechatAdapter);
    logger.info("WeChat app channel enabled");
  }

  const ircServer = process.env.IRC_SERVER;
  const ircNick = process.env.IRC_NICK;
  if (ircServer && ircNick) {
    const ircChannels = process.env.IRC_CHANNELS?.split(",").filter(Boolean) ?? [];
    channels.register(new IrcChannel({
      server: ircServer,
      nick: ircNick,
      channels: ircChannels,
      port: process.env.IRC_PORT ? parseInt(process.env.IRC_PORT, 10) : undefined,
      password: process.env.IRC_PASSWORD,
      tls: process.env.IRC_TLS === "true",
    }));
    logger.info("IRC channel enabled");
  }

  const whatsappEnabled = process.env.WHATSAPP_ENABLED === "true";
  if (whatsappEnabled) {
    channels.register(new WhatsAppChannel());
    logger.info("WhatsApp channel enabled");
  }

  const matrixServer = process.env.MATRIX_HOMESERVER;
  const matrixToken = process.env.MATRIX_ACCESS_TOKEN;
  if (matrixServer && matrixToken) {
    channels.register(new MatrixChannel({
      homeserverUrl: matrixServer,
      accessToken: matrixToken,
      userId: process.env.MATRIX_USER_ID ?? "",
      rooms: process.env.MATRIX_ROOMS?.split(",").filter(Boolean) ?? [],
    }));
    logger.info("Matrix channel enabled");
  }

  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (lineToken) {
    channels.register(new LineChannel({
      channelAccessToken: lineToken,
      channelSecret: process.env.LINE_CHANNEL_SECRET ?? "",
    }));
    logger.info("LINE channel enabled");
  }

  const googleChatWebhook = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (googleChatWebhook) {
    channels.register(new GoogleChatChannel({ webhookUrl: googleChatWebhook }));
    logger.info("Google Chat channel enabled");
  }

  const signalServer = process.env.SIGNAL_SERVER_URL;
  if (signalServer) {
    channels.register(new SignalChannel({
      serverUrl: signalServer,
      phoneNumber: process.env.SIGNAL_PHONE_NUMBER ?? "",
    }));
    logger.info("Signal channel enabled");
  }

  const teamsBotId = process.env.TEAMS_BOT_ID;
  if (teamsBotId) {
    channels.register(new TeamsChannel({ botId: teamsBotId, botPassword: process.env.TEAMS_BOT_PASSWORD }));
    logger.info("Teams channel enabled");
  }

  const imessageBusinessId = process.env.IMESSAGE_BUSINESS_ID;
  if (imessageBusinessId) {
    channels.register(new IMessageChannel({ businessId: imessageBusinessId, apiEndpoint: process.env.IMESSAGE_API_ENDPOINT }));
    logger.info("iMessage channel enabled");
  }

  const feishuAppId = process.env.FEISHU_APP_ID;
  const feishuAppSecret = process.env.FEISHU_APP_SECRET;
  if (feishuAppId && feishuAppSecret) {
    channels.register(new FeishuChannel({ appId: feishuAppId, appSecret: feishuAppSecret }));
    logger.info("Feishu channel enabled");
  }

  const apiKeyAuth = new ApiKeyAuth(process.env as Record<string, string | undefined>);

  // Auth + rate limit on all routes except health and webhook endpoints
  app.addHook("preHandler", (request, reply, done) => {
    if (
      request.url === "/api/health" ||
      request.url.includes("/webhook")
    ) {
      done();
      return;
    }
    apiKeyAuth.authenticate(request, reply, done);
  });

  // Rate limiting runs after auth
  app.addHook("preHandler", (request, reply, done) => {
    if (
      request.url === "/api/health" ||
      request.url.includes("/webhook")
    ) {
      done();
      return;
    }
    apiKeyAuth.rateLimit(request, reply, done);
  });

  // Metrics timing hook
  app.addHook("onRequest", (request, _reply, done) => {
    (request as any).__metricsStart = Date.now();
    done();
  });
  app.addHook("onResponse", (request, reply, done) => {
    const start = (request as any).__metricsStart;
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

  const dmConfig: DmPairingConfig = {
    policy: (process.env.DM_POLICY as DmPairingConfig["policy"]) || "pairing",
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

  app.get("/api/metrics", async (_request, reply) => {
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

  app.get("/api/skills", async (_request, reply) => {
    try {
      const res = await bridge.proxyGet("/api/skills");
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable", details: String(err) };
    }
  });

  app.post("/api/memory/search", async (request, reply) => {
    try {
      const res = await bridge.proxyPost("/api/memory/search", request.body);
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable", details: String(err) };
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
      const file = new File([buffer], data.filename, { type: data.mimetype });
      const result = await bridge.uploadFile(file);
      return result;
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable", details: String(err) };
    }
  });

  app.get("/api/sessions", async (_request, reply) => {
    try {
      const res = await bridge.proxyGet("/api/sessions");
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable", details: String(err) };
    }
  });

  app.delete("/api/sessions/:sessionId", async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const res = await fetch(`${bridge["baseUrl"]}/api/sessions/${sessionId}`, { method: "DELETE" });
      return res.json();
    } catch (err) {
      reply.code(502);
      return { error: "Engine unreachable", details: String(err) };
    }
  });

  app.register(async function (fastify) {
    fastify.get("/ws/chat", { websocket: true }, (socket, _req) => {
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

  // --- Voice ---

  app.post("/api/voice/stt", async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        reply.code(400);
        return { error: "No audio file uploaded" };
      }
      const buffer = await data.toBuffer();
      const file = new File([buffer], data.filename, { type: data.mimetype });
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

  if (wechatAdapter) {
    app.post("/api/wechat/webhook", async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      wechatAdapter!.receiveWebhook(body);
      return { status: "ok" };
    });
  }

  // Webhook routes for push-based channels
  const lineAdapter = channels.getAdapter("line") as InstanceType<typeof LineChannel> | undefined;
  if (lineAdapter) {
    app.post("/api/line/webhook", async (request) => {
      lineAdapter.receiveWebhook(request.body as Parameters<typeof lineAdapter.receiveWebhook>[0]);
      return { status: "ok" };
    });
  }

  const googleChatAdapter = channels.getAdapter("google_chat") as InstanceType<typeof GoogleChatChannel> | undefined;
  if (googleChatAdapter) {
    app.post("/api/google-chat/webhook", async (request) => {
      googleChatAdapter.receiveEvent(request.body as Parameters<typeof googleChatAdapter.receiveEvent>[0]);
      return { status: "ok" };
    });
  }

  const teamsAdapter = channels.getAdapter("teams") as InstanceType<typeof TeamsChannel> | undefined;
  if (teamsAdapter) {
    app.post("/api/teams/webhook", async (request) => {
      teamsAdapter.receiveActivity(request.body as Parameters<typeof teamsAdapter.receiveActivity>[0]);
      return { status: "ok" };
    });
  }

  const imessageAdapter = channels.getAdapter("imessage") as InstanceType<typeof IMessageChannel> | undefined;
  if (imessageAdapter) {
    app.post("/api/imessage/webhook", async (request) => {
      imessageAdapter.receiveMessage(request.body as Parameters<typeof imessageAdapter.receiveMessage>[0]);
      return { status: "ok" };
    });
  }

  const feishuAdapter = channels.getAdapter("feishu") as InstanceType<typeof FeishuChannel> | undefined;
  if (feishuAdapter) {
    app.post("/api/feishu/webhook", async (request) => {
      feishuAdapter.receiveEvent(request.body as Parameters<typeof feishuAdapter.receiveEvent>[0]);
      return { status: "ok" };
    });
  }

  return { app, channels, bridge };
}
