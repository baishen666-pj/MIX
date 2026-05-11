import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import type { GatewayConfig } from "./utils/config.js";
import { EngineBridge } from "./bridge.js";
import { ChannelRegistry } from "./channels/registry.js";
import { WebChatChannel } from "./channels/webchat.js";
import { TelegramChannel } from "./channels/telegram.js";
import { DiscordChannel } from "./channels/discord.js";
import { SlackChannel } from "./channels/slack.js";
import { DmPairing, DmSecurityFilter } from "./security/dm-pairing.js";
import type { DmPairingConfig } from "./security/acl.js";
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

  app.post("/api/pairing/approve", async (request) => {
    const body = request.body as { channel: string; code: string };
    const approved = pairing.approvePairing(body.channel, body.code);
    return { approved };
  });

  app.get("/api/pairing/pending", async () => {
    return { pending: pairing.getPendingPairings() };
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
