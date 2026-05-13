import { BaseChannel } from "./base.js";
import type { ChannelMessage } from "./types.js";

export interface LineConfig {
  channelAccessToken: string;
  channelSecret: string;
}

interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string; groupId?: string; type: string };
  message?: { type: string; text?: string; id: string };
}

export class LineChannel extends BaseChannel {
  readonly name = "line" as const;
  private config: LineConfig;

  constructor(config: LineConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    if (!this.config.channelAccessToken) return;
  }

  async send(msg: ChannelMessage): Promise<void> {
    const replyToken = msg.metadata.lineReplyToken as string;
    const to = (msg.metadata.lineUserId ?? msg.metadata.lineGroupId) as string;
    if (!to && !replyToken) return;

    const target = replyToken ? { replyToken } : { to };
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.channelAccessToken}`,
      },
      body: JSON.stringify({
        ...target,
        messages: [{ type: "text", text: msg.content }],
      }),
    });
  }

  receiveWebhook(body: { events?: LineWebhookEvent[] }): void {
    const events = body.events ?? [];
    for (const event of events) {
      if (event.type === "message" && event.message?.type === "text" && event.message.text) {
        const msg: ChannelMessage = {
          id: `line-${event.message.id}`,
          channel: "line",
          userId: event.source?.userId ?? "unknown",
          content: event.message.text,
          metadata: {
            lineReplyToken: event.replyToken,
            lineUserId: event.source?.userId,
            lineGroupId: event.source?.groupId,
            lineSourceType: event.source?.type,
          },
          timestamp: new Date().toISOString(),
        };
        this.dispatch(msg);
      }
    }
  }
}
