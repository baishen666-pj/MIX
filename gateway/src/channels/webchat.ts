import { BaseChannel } from "./base.js";
import type { ChannelMessage } from "./types.js";

export class WebChatChannel extends BaseChannel {
  readonly name = "webchat" as const;

  async start(): Promise<void> {
    // WebChat receives messages via HTTP/WS endpoints in server.ts
  }

  receive(msg: ChannelMessage): void {
    this.dispatch(msg);
  }

  async send(_msg: ChannelMessage): Promise<void> {
    // Outbound webchat messages are sent via WebSocket in server.ts
  }
}
