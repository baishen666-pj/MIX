import type { ChannelAdapter, ChannelMessage } from "./types.js";

type MessageHandler = (msg: ChannelMessage) => void;

export interface IMessageConfig {
  businessId?: string;
  apiEndpoint?: string;
}

export class IMessageChannel implements ChannelAdapter {
  readonly name = "imessage" as const;
  private handlers: MessageHandler[] = [];
  private config: IMessageConfig;

  constructor(config: IMessageConfig = {}) {
    this.config = config;
  }

  onMessage(handler: MessageHandler): void {
    this.handlers = [...this.handlers, handler];
  }

  async start(): Promise<void> {
    // Apple Messages for Business uses webhook push
  }

  async stop(): Promise<void> {
    this.handlers = [];
  }

  async send(msg: ChannelMessage): Promise<void> {
    const endpoint = this.config.apiEndpoint;
    if (!endpoint) return;

    await fetch(`${endpoint}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: msg.metadata.imessageUserId,
        message: msg.content,
        business_id: this.config.businessId,
      }),
    });
  }

  receiveMessage(payload: { message?: { id?: string; text?: string; sender?: string } }): void {
    if (!payload.message?.text) return;

    const msg: ChannelMessage = {
      id: `im-${payload.message.id ?? Date.now()}`,
      channel: "imessage",
      userId: payload.message.sender ?? "unknown",
      content: payload.message.text,
      metadata: { imessageUserId: payload.message.sender },
      timestamp: new Date().toISOString(),
    };
    for (const handler of this.handlers) handler(msg);
  }
}
