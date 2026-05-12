import type { ChannelAdapter, ChannelMessage } from "./types.js";

type MessageHandler = (msg: ChannelMessage) => void;

export interface TeamsConfig {
  botId?: string;
  botPassword?: string;
}

interface TeamsActivity {
  type: string;
  text?: string;
  from?: { id?: string; name?: string };
  conversation?: { id?: string };
}

export class TeamsChannel implements ChannelAdapter {
  readonly name = "teams" as const;
  private handlers: MessageHandler[] = [];
  private config: TeamsConfig;

  constructor(config: TeamsConfig = {}) {
    this.config = config;
  }

  onMessage(handler: MessageHandler): void {
    this.handlers = [...this.handlers, handler];
  }

  async start(): Promise<void> {
    // Teams uses Bot Framework webhook push
  }

  async stop(): Promise<void> {
    this.handlers = [];
  }

  async send(msg: ChannelMessage): Promise<void> {
    const serviceUrl = msg.metadata.teamsServiceUrl as string;
    const conversationId = msg.metadata.teamsConversationId as string;
    if (!serviceUrl || !conversationId) return;

    await fetch(`${serviceUrl}/v3/conversations/${encodeURIComponent(conversationId)}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "message",
        text: msg.content,
      }),
    });
  }

  receiveActivity(activity: TeamsActivity): void {
    if (activity.type !== "message" || !activity.text) return;

    const msg: ChannelMessage = {
      id: `teams-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      channel: "teams",
      userId: activity.from?.id ?? "unknown",
      content: activity.text,
      metadata: {
        teamsConversationId: activity.conversation?.id,
        teamsFromName: activity.from?.name,
      },
      timestamp: new Date().toISOString(),
    };
    for (const handler of this.handlers) handler(msg);
  }
}
