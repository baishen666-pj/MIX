import type { ChannelAdapter, ChannelMessage } from "./types.js";

type MessageHandler = (msg: ChannelMessage) => void;

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

export class LineChannel implements ChannelAdapter {
  readonly name = "line" as const;
  private handlers: MessageHandler[] = [];
  private config: LineConfig;

  constructor(config: LineConfig) {
    this.config = config;
  }

  onMessage(handler: MessageHandler): void {
    this.handlers = [...this.handlers, handler];
  }

  async start(): Promise<void> {
    if (!this.config.channelAccessToken) return;
  }

  async stop(): Promise<void> {
    this.handlers = [];
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
        for (const handler of this.handlers) handler(msg);
      }
    }
  }
}
