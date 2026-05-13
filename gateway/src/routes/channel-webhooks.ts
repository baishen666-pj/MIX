import type { FastifyInstance } from "fastify";
import type { ChannelRegistry } from "../channels/registry.js";
import { WeChatChannel } from "../channels/wechat.js";
import { LineChannel } from "../channels/line.js";
import { GoogleChatChannel } from "../channels/google-chat.js";
import { TeamsChannel } from "../channels/teams.js";
import { IMessageChannel } from "../channels/imessage.js";
import { FeishuChannel } from "../channels/feishu.js";

export function registerChannelWebhooks(
  app: FastifyInstance,
  channels: ChannelRegistry,
  wechatAdapter?: WeChatChannel,
): void {
  if (wechatAdapter) {
    app.post("/api/wechat/webhook", async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      wechatAdapter!.receiveWebhook(body);
      return { status: "ok" };
    });
  }

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
}
