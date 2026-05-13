import { BaseChannel } from "./base.js";
import type { ChannelMessage } from "./types.js";

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

export class TeamsChannel extends BaseChannel {
  readonly name = "teams" as const;
  private config: TeamsConfig;

  constructor(config: TeamsConfig = {}) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    // Teams uses Bot Framework webhook push
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
    this.dispatch(msg);
  }
}
