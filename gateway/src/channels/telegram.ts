import type { ChannelAdapter, ChannelMessage } from "./types.js";

type MessageHandler = (msg: ChannelMessage) => void;

interface TelegramConfig {
  botToken: string;
  allowedUsers?: string[];
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
  };
}

export class TelegramChannel implements ChannelAdapter {
  readonly name = "telegram" as const;
  private handlers: MessageHandler[] = [];
  private config: TelegramConfig;
  private polling = false;
  private lastUpdateId = 0;
  private abortController: AbortController | null = null;

  constructor(config: TelegramConfig) {
    this.config = config;
  }

  onMessage(handler: MessageHandler): void {
    this.handlers = [...this.handlers, handler];
  }

  async start(): Promise<void> {
    if (!this.config.botToken) return;
    this.polling = true;
    this.abortController = new AbortController();
    this.poll();
  }

  async stop(): Promise<void> {
    this.polling = false;
    this.abortController?.abort();
    this.handlers = [];
  }

  private async poll(): Promise<void> {
    while (this.polling) {
      try {
        const updates = await this.getUpdates();
        for (const update of updates) {
          this.lastUpdateId = update.update_id + 1;
          if (update.message?.text && update.message.from) {
            const msg = this.toChannelMessage(update);
            if (msg) {
              for (const handler of this.handlers) {
                handler(msg);
              }
            }
          }
        }
      } catch {
        // Continue polling on error
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  async send(msg: ChannelMessage): Promise<void> {
    const chatId = msg.metadata.telegramChatId as number;
    if (!chatId) return;
    await this.callApi("sendMessage", {
      chat_id: chatId,
      text: msg.content,
    });
  }

  private toChannelMessage(update: TelegramUpdate): ChannelMessage | null {
    const msg = update.message;
    if (!msg?.from || !msg.text) return null;

    return {
      id: `tg-${msg.message_id}`,
      channel: "telegram",
      userId: String(msg.from.id),
      content: msg.text,
      metadata: {
        telegramChatId: msg.chat.id,
        username: msg.from.username,
        firstName: msg.from.first_name,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async getUpdates(): Promise<TelegramUpdate[]> {
    const url = `https://api.telegram.org/bot${this.config.botToken}/getUpdates?offset=${this.lastUpdateId}&timeout=30`;
    const res = await fetch(url, { signal: this.abortController?.signal });
    const data = (await res.json()) as { ok: boolean; result: TelegramUpdate[] };
    return data.ok ? data.result : [];
  }

  private async callApi(method: string, params: Record<string, unknown>): Promise<unknown> {
    const url = `https://api.telegram.org/bot${this.config.botToken}/${method}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return res.json();
  }
}
