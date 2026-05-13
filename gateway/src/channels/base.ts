import type { ChannelAdapter, ChannelMessage } from "./types.js";

export type MessageHandler = (msg: ChannelMessage) => void;

/**
 * Base class for channel adapters. Provides the shared handler registry,
 * message dispatch, and lifecycle boilerplate that every channel repeats.
 *
 * Subclasses must implement:
 * - `name` -- the channel identifier
 * - `start()` -- connect to the channel backend and begin receiving messages
 * - `send()` -- deliver an outbound message through the channel
 *
 * Subclasses call `this.dispatch(msg)` from wherever they receive inbound
 * messages (poll loop, websocket handler, etc.).
 */
export abstract class BaseChannel implements ChannelAdapter {
  protected handlers: MessageHandler[] = [];

  abstract readonly name: ChannelAdapter["name"];

  abstract start(): Promise<void>;
  abstract send(message: ChannelMessage): Promise<void>;

  onMessage(handler: MessageHandler): void {
    this.handlers = [...this.handlers, handler];
  }

  protected dispatch(msg: ChannelMessage): void {
    for (const handler of this.handlers) handler(msg);
  }

  async stop(): Promise<void> {
    this.handlers = [];
  }
}
