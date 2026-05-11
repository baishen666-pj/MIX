import type { ChannelAdapter, ChannelMessage } from "./types.js";

type MessageHandler = (msg: ChannelMessage) => void;

interface WeChatConfig {
  webhookUrl: string;
  corpId?: string;
  agentId?: string;
  secret?: string;
}

export class WeChatChannel implements ChannelAdapter {
  readonly name = "wechat" as const;
  private handlers: MessageHandler[] = [];
  private config: WeChatConfig;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(config: WeChatConfig) {
    this.config = config;
  }

  onMessage(handler: MessageHandler): void {
    this.handlers = [...this.handlers, handler];
  }

  async start(): Promise<void> {
    if (!this.config.webhookUrl && !this.config.corpId) return;
  }

  async stop(): Promise<void> {
    this.handlers = [];
    this.accessToken = null;
  }

  async send(msg: ChannelMessage): Promise<void> {
    if (this.config.webhookUrl) {
      await this.sendViaWebhook(msg.content);
    } else if (this.config.corpId && this.config.agentId && this.config.secret) {
      const userId = msg.metadata.wechatUserId as string;
      if (userId) {
        await this.sendViaApp(userId, msg.content);
      }
    }
  }

  receiveWebhook(body: Record<string, unknown>): void {
    const content = body.Content as string;
    const fromUser = body.FromUserName as string;
    const msgType = body.MsgType as string;

    if (msgType !== "text" || !content || !fromUser) return;

    const msg: ChannelMessage = {
      id: `wx-${body.MsgId ?? Date.now()}`,
      channel: "wechat",
      userId: fromUser,
      content,
      metadata: {
        wechatUserId: fromUser,
        isDm: true,
      },
      timestamp: new Date().toISOString(),
    };

    for (const handler of this.handlers) {
      handler(msg);
    }
  }

  private async sendViaWebhook(content: string): Promise<void> {
    await fetch(this.config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "text",
        text: { content },
      }),
    });
  }

  private async sendViaApp(userId: string, content: string): Promise<void> {
    const token = await this.getAccessToken();
    await fetch(`https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        touser: userId,
        msgtype: "text",
        agentid: this.config.agentId,
        text: { content },
      }),
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.config.corpId}&corpsecret=${this.config.secret}`;
    const res = await fetch(url);
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    this.accessToken = data.access_token ?? null;
    this.tokenExpiry = Date.now() + (data.expires_in ?? 7200) * 1000 - 300000;
    return this.accessToken ?? "";
  }
}
