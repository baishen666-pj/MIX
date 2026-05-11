import type { ChannelAdapter, ChannelMessage } from "./types.js";

type MessageHandler = (msg: ChannelMessage) => void;

interface SlackConfig {
  botToken: string;
  appToken?: string;
  allowedChannels?: string[];
}

export class SlackChannel implements ChannelAdapter {
  readonly name = "slack" as const;
  private handlers: MessageHandler[] = [];
  private config: SlackConfig;
  private ws: WebSocket | null = null;
  private lastTimestamp = 0;

  constructor(config: SlackConfig) {
    this.config = config;
  }

  onMessage(handler: MessageHandler): void {
    this.handlers = [...this.handlers, handler];
  }

  async start(): Promise<void> {
    if (!this.config.botToken) return;
    this.pollMessages();
  }

  async stop(): Promise<void> {
    this.ws?.close();
    this.ws = null;
    this.handlers = [];
  }

  async send(msg: ChannelMessage): Promise<void> {
    const channel = msg.metadata.slackChannel as string;
    if (!channel) return;
    await this.callApi("chat.postMessage", {
      channel,
      text: msg.content,
      unfurl_links: false,
      unfurl_media: false,
    });
  }

  private async pollMessages(): Promise<void> {
    while (this.handlers.length > 0) {
      try {
        const url = `https://slack.com/api/conversations.history?types=message&limit=10&oldest=${this.lastTimestamp}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${this.config.botToken}` },
        });
        const data = (await res.json()) as {
          ok: boolean;
          messages?: Array<{
            type: string;
            text: string;
            user: string;
            channel?: string;
            ts: string;
            bot_id?: string;
            subtype?: string;
          }>;
        };

        if (data.ok && data.messages) {
          const userMessages = data.messages.filter(
            (m) => m.type === "message" && !m.bot_id && !m.subtype,
          );

          for (const msg of userMessages.reverse()) {
            const ts = parseFloat(msg.ts);
            if (ts > this.lastTimestamp) {
              this.lastTimestamp = ts;
              const channelMsg: ChannelMessage = {
                id: `slack-${msg.ts}`,
                channel: "slack",
                userId: msg.user,
                content: msg.text,
                metadata: {
                  slackChannel: msg.channel,
                  isDm: msg.channel?.startsWith("D") ?? false,
                },
                timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
              };
              for (const handler of this.handlers) {
                handler(channelMsg);
              }
            }
          }
        }
      } catch {
        // Continue polling
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  private async callApi(method: string, params: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(params),
    });
    return res.json();
  }
}
