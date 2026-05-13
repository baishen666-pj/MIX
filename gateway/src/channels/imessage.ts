import { BaseChannel } from "./base.js";
import type { ChannelMessage } from "./types.js";

export interface IMessageConfig {
  businessId?: string;
  apiEndpoint?: string;
}

export class IMessageChannel extends BaseChannel {
  readonly name = "imessage" as const;
  private config: IMessageConfig;

  constructor(config: IMessageConfig = {}) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    // Apple Messages for Business uses webhook push
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
    this.dispatch(msg);
  }
}
