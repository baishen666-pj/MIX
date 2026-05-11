import type { ChannelType } from "../../../shared/protocols/messages";

export type { ChannelType };

export interface ChannelMessage {
  id: string;
  channel: ChannelType;
  userId: string;
  content: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface ChannelAdapter {
  readonly name: ChannelType;
  start(): Promise<void>;
  stop(): Promise<void>;
  onMessage(handler: (msg: ChannelMessage) => void): void;
  send(message: ChannelMessage): Promise<void>;
}

export interface ChannelConfig {
  enabled: boolean;
  [key: string]: unknown;
}

export interface OutboundMessage {
  sessionId: string;
  content: string;
  channel: ChannelType;
  targetUserId?: string;
}
