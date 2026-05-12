import type { ChannelAdapter, ChannelMessage } from "./types.js";

type MessageHandler = (msg: ChannelMessage) => void;

export interface SignalConfig {
  serverUrl: string;
  phoneNumber: string;
}

export class SignalChannel implements ChannelAdapter {
  readonly name = "signal" as const;
  private handlers: MessageHandler[] = [];
  private config: SignalConfig;
  private polling = false;
  private abortController: AbortController | null = null;

  constructor(config: SignalConfig) {
    this.config = config;
  }

  onMessage(handler: MessageHandler): void {
    this.handlers = [...this.handlers, handler];
  }

  async start(): Promise<void> {
    if (!this.config.serverUrl) return;
    this.polling = true;
    this.abortController = new AbortController();
    this.poll();
  }

  async stop(): Promise<void> {
    this.polling = false;
    this.abortController?.abort();
    this.handlers = [];
  }

  async send(msg: ChannelMessage): Promise<void> {
    const to = msg.metadata.signalNumber as string;
    if (!to) return;
    await fetch(`${this.config.serverUrl}/v2/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg.content,
        number: this.config.phoneNumber,
        recipients: [to],
      }),
      signal: this.abortController?.signal,
    });
  }

  private async poll(): Promise<void> {
    while (this.polling) {
      try {
        const res = await fetch(`${this.config.serverUrl}/v1/receive/${this.config.phoneNumber}`, {
          signal: this.abortController?.signal,
        });
        const messages = (await res.json()) as Array<{ envelope?: { source?: string; dataMessage?: { message?: string; timestamp?: number } } }>;
        for (const m of messages) {
          const text = m.envelope?.dataMessage?.message;
          const source = m.envelope?.source;
          if (text && source) {
            const msg: ChannelMessage = {
              id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              channel: "signal",
              userId: source,
              content: text,
              metadata: { signalNumber: source },
              timestamp: new Date().toISOString(),
            };
            for (const handler of this.handlers) handler(msg);
          }
        }
      } catch {
        // Continue polling
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
