import { BaseChannel } from "./base.js";
import type { ChannelMessage } from "./types.js";

export interface FeishuConfig {
  appId: string;
  appSecret: string;
}

interface FeishuEvent {
  header?: { event_id?: string; event_type?: string };
  event?: {
    sender?: { sender_id?: { user_id?: string } };
    message?: { content?: string; message_type?: string; chat_id?: string };
  };
}

export class FeishuChannel extends BaseChannel {
  readonly name = "feishu" as const;
  private config: FeishuConfig;
  private tenantToken: string | null = null;
  private tokenExpiry = 0;

  constructor(config: FeishuConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    if (!this.config.appId || !this.config.appSecret) return;
  }

  async send(msg: ChannelMessage): Promise<void> {
    const chatId = msg.metadata.feishuChatId as string;
    if (!chatId) return;

    const token = await this.getTenantToken();
    await fetch("https://open.feishu.cn/open-apis/im/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: "text",
        content: JSON.stringify({ text: msg.content }),
      }),
    });
  }

  receiveEvent(event: FeishuEvent): void {
    const eventType = event.header?.event_type;
    if (eventType !== "im.message.receive_v1") return;

    const content = event.event?.message?.content;
    if (!content) return;

    try {
      const parsed = JSON.parse(content) as { text?: string };
      if (!parsed.text) return;

      const msg: ChannelMessage = {
        id: `fs-${event.header?.event_id ?? Date.now()}`,
        channel: "feishu",
        userId: event.event?.sender?.sender_id?.user_id ?? "unknown",
        content: parsed.text,
        metadata: {
          feishuChatId: event.event?.message?.chat_id,
        },
        timestamp: new Date().toISOString(),
      };
      this.dispatch(msg);
    } catch {
      // Invalid JSON content
    }
  }

  private async getTenantToken(): Promise<string> {
    if (this.tenantToken && Date.now() < this.tokenExpiry) return this.tenantToken;

    const res = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: this.config.appId, app_secret: this.config.appSecret }),
    });
    const data = (await res.json()) as { tenant_access_token?: string; expire?: number };
    this.tenantToken = data.tenant_access_token ?? "";
    this.tokenExpiry = Date.now() + (data.expire ?? 7200) * 1000 - 60000;
    return this.tenantToken;
  }
}
