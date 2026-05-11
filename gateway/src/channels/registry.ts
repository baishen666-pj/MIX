import type { ChannelAdapter, ChannelConfig, ChannelMessage } from "./types.js";

type MessageHandler = (msg: ChannelMessage) => void;

export class ChannelRegistry {
  private adapters = new Map<string, ChannelAdapter>();
  private handlers: MessageHandler[] = [];

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.name, adapter);
    adapter.onMessage((msg) => {
      for (const handler of this.handlers) {
        handler(msg);
      }
    });
  }

  async startAll(): Promise<void> {
    const starts = Array.from(this.adapters.values()).map((a) => a.start());
    await Promise.all(starts);
  }

  async stopAll(): Promise<void> {
    const stops = Array.from(this.adapters.values()).map((a) => a.stop());
    await Promise.all(stops);
  }

  onMessage(handler: MessageHandler): void {
    this.handlers = [...this.handlers, handler];
  }

  async send(msg: ChannelMessage): Promise<void> {
    const adapter = this.adapters.get(msg.channel);
    if (!adapter) {
      throw new Error(`Unknown channel: ${msg.channel}`);
    }
    await adapter.send(msg);
  }

  getAdapter(name: string): ChannelAdapter | undefined {
    return this.adapters.get(name);
  }

  listChannels(): string[] {
    return Array.from(this.adapters.keys());
  }
}
