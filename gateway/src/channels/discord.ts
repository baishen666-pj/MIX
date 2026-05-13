import { BaseChannel } from "./base.js";
import type { ChannelMessage } from "./types.js";

interface DiscordConfig {
  botToken: string;
  allowedGuilds?: string[];
  dmPolicy?: "pairing" | "open" | "closed";
}

export class DiscordChannel extends BaseChannel {
  readonly name = "discord" as const;
  private config: DiscordConfig;
  private ws: WebSocket | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private sessionId: string | null = null;
  private resumeUrl: string | null = null;

  constructor(config: DiscordConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    if (!this.config.botToken) return;
    await this.connect();
  }

  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.ws?.close();
    this.ws = null;
    await super.stop();
  }

  async send(msg: ChannelMessage): Promise<void> {
    const channelId = msg.metadata.discordChannelId as string;
    if (!channelId) return;
    await this.callApi(`/channels/${channelId}/messages`, "POST", {
      content: msg.content,
    });
  }

  private async connect(): Promise<void> {
    const gatewayData = (await this.callApi("/gateway/bot", "GET")) as {
      url: string;
      session_start_limit?: { remaining: number };
    };
    const url = this.resumeUrl || `${gatewayData.url}?v=10&encoding=json`;

    this.ws = new WebSocket(url);

    this.ws.onmessage = (event) => {
      const payload = JSON.parse(event.data as string);
      this.handlePayload(payload);
    };

    this.ws.onclose = () => {
      if (this.handlers.length > 0) {
        setTimeout(() => this.connect(), 5000);
      }
    };
  }

  private handlePayload(payload: { op: number; t?: string; d?: Record<string, unknown> }): void {
    const { op, t, d } = payload;

    if (op === 10 && d) {
      const interval = d.heartbeat_interval as number;
      this.heartbeatInterval = setInterval(() => {
        this.ws?.send(JSON.stringify({ op: 1, d: this.sessionId }));
      }, interval);
      this.identify();
    }

    if (op === 11) return; // heartbeat ack

    if (t === "READY" && d) {
      this.sessionId = d.session_id as string;
      this.resumeUrl = d.resume_gateway_url as string;
    }

    if (t === "MESSAGE_CREATE" && d) {
      const author = d.author as Record<string, unknown> | undefined;
      if (!author || author.bot) return;

      const content = d.content as string;
      if (!content) return;

      const channelType = d.channel_id as string;
      const isDm = !d.guild_id;

      const msg: ChannelMessage = {
        id: `dc-${d.id}`,
        channel: "discord",
        userId: String(author.id),
        content,
        metadata: {
          discordChannelId: channelType,
          guildId: d.guild_id ?? null,
          username: author.username,
          isDm,
        },
        timestamp: new Date().toISOString(),
      };

      this.dispatch(msg);
    }
  }

  private identify(): void {
    this.ws?.send(
      JSON.stringify({
        op: 2,
        d: {
          token: this.config.botToken,
          intents: (1 << 9) | (1 << 15), // GUILD_MESSAGES + DM_MESSAGES
          properties: { os: "windows", browser: "mix", device: "mix" },
        },
      }),
    );
  }

  private async callApi(path: string, method: string, body?: Record<string, unknown>): Promise<unknown> {
    const url = `https://discord.com/api/v10${path}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bot ${this.config.botToken}`,
        "Content-Type": "application/json",
      },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    if (res.status === 204) return null;
    return res.json();
  }
}
