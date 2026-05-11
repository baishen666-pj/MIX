import type { ChannelAdapter, ChannelMessage } from "./types.js";

type MessageHandler = (msg: ChannelMessage) => void;

export class WebChatChannel implements ChannelAdapter {
  readonly name = "webchat" as const;
  private handlers: MessageHandler[] = [];

  onMessage(handler: MessageHandler): void {
    this.handlers = [...this.handlers, handler];
  }

  async start(): Promise<void> {
    // WebChat receives messages via HTTP/WS endpoints in server.ts
  }

  async stop(): Promise<void> {
    this.handlers = [];
  }

  receive(msg: ChannelMessage): void {
    for (const handler of this.handlers) {
      handler(msg);
    }
  }

  async send(_msg: ChannelMessage): Promise<void> {
    // Outbound webchat messages are sent via WebSocket in server.ts
  }
}
