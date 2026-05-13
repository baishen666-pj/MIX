import { BaseChannel } from "./base.js";
import type { ChannelMessage } from "./types.js";

export interface MatrixConfig {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  rooms: string[];
}

interface MatrixEvent {
  event_id: string;
  type: string;
  content?: { body?: string; msgtype?: string };
  sender: string;
  room_id: string;
}

export class MatrixChannel extends BaseChannel {
  readonly name = "matrix" as const;
  private config: MatrixConfig;
  private polling = false;
  private sinceToken: string | null = null;
  private abortController: AbortController | null = null;

  constructor(config: MatrixConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    if (!this.config.homeserverUrl || !this.config.accessToken) return;
    this.polling = true;
    this.abortController = new AbortController();
    this.poll();
  }

  async stop(): Promise<void> {
    this.polling = false;
    this.abortController?.abort();
    await super.stop();
  }

  async send(msg: ChannelMessage): Promise<void> {
    const roomId = msg.metadata.matrixRoomId as string;
    if (!roomId) return;
    const txnId = `mix-${Date.now()}`;
    await this.callApi(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`, "PUT", {
      msgtype: "m.text",
      body: msg.content,
    });
  }

  private async poll(): Promise<void> {
    while (this.polling) {
      try {
        const params = new URLSearchParams({ timeout: "30000" });
        if (this.sinceToken) params.set("since", this.sinceToken);

        const res = await this.callApi(`/_matrix/client/v3/sync?${params}`, "GET");
        const data = res as { next_batch?: string; rooms?: { join?: Record<string, { timeline?: { events?: MatrixEvent[] } }> } };

        if (data.next_batch) this.sinceToken = data.next_batch;

        if (data.rooms?.join) {
          for (const [roomId, roomData] of Object.entries(data.rooms.join)) {
            const events = roomData.timeline?.events ?? [];
            for (const event of events) {
              if (event.type === "m.room.message" && event.sender !== this.config.userId && event.content?.body) {
                const msg: ChannelMessage = {
                  id: `mx-${event.event_id}`,
                  channel: "matrix",
                  userId: event.sender,
                  content: event.content.body,
                  metadata: { matrixRoomId: roomId },
                  timestamp: new Date().toISOString(),
                };
                this.dispatch(msg);
              }
            }
          }
        }
      } catch {
        // Continue polling
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  private async callApi(path: string, method: string, body?: unknown): Promise<unknown> {
    const url = `${this.config.homeserverUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.config.accessToken}`,
    };
    const options: RequestInit = { method, headers };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(url, { ...options, signal: this.abortController?.signal });
    return res.json();
  }
}
