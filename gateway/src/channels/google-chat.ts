import { BaseChannel } from "./base.js";
import type { ChannelMessage } from "./types.js";

export interface GoogleChatConfig {
  serviceAccountKey?: string;
  webhookUrl?: string;
}

interface ChatEvent {
  type: string;
  eventTime?: string;
  message?: {
    name: string;
    sender?: { displayName?: string; email?: string; type?: string };
    text?: string;
    space?: { name: string; displayName?: string };
  };
}

export class GoogleChatChannel extends BaseChannel {
  readonly name = "google_chat" as const;
  private config: GoogleChatConfig;

  constructor(config: GoogleChatConfig = {}) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    // Google Chat uses webhook push; no polling needed
  }

  async send(msg: ChannelMessage): Promise<void> {
    const webhookUrl = msg.metadata.googleChatWebhookUrl as string ?? this.config.webhookUrl;
    if (!webhookUrl) return;

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg.content }),
    });
  }

  receiveEvent(event: ChatEvent): void {
    if (event.type !== "MESSAGE" || !event.message?.text) return;
    if (event.message.sender?.type === "BOT") return;

    const msg: ChannelMessage = {
      id: `gc-${event.message.name}`,
      channel: "google_chat",
      userId: event.message.sender?.email ?? event.message.sender?.displayName ?? "unknown",
      content: event.message.text,
      metadata: {
        googleChatSpace: event.message.space?.name,
        googleChatSender: event.message.sender?.displayName,
      },
      timestamp: event.eventTime ?? new Date().toISOString(),
    };
    this.dispatch(msg);
  }
}
