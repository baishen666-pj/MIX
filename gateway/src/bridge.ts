import type { ChatRequest, ChatResponse, StreamChunk } from "../../shared/protocols/messages";

export interface BridgeConfig {
  engineHost: string;
  enginePort: number;
}

export type { ChatRequest, ChatResponse, StreamChunk };

export class EngineBridge {
  private baseUrl: string;
  private wsUrl: string;

  constructor(config: BridgeConfig) {
    this.baseUrl = `http://${config.engineHost}:${config.enginePort}`;
    this.wsUrl = `ws://${config.engineHost}:${config.enginePort}`;
  }

  async health(): Promise<{ status: string; version: string }> {
    const res = await fetch(`${this.baseUrl}/api/health`);
    return res.json() as Promise<{ status: string; version: string }>;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return res.json() as Promise<ChatResponse>;
  }

  async *chatStream(req: ChatRequest): AsyncGenerator<StreamChunk> {
    const ws = new WebSocket(`${this.wsUrl}/ws/stream`);

    const messageQueue: StreamChunk[] = [];
    let resolve: ((value?: unknown) => void) | null = null;
    let done = false;

    ws.onmessage = (event) => {
      const chunk: StreamChunk = JSON.parse(event.data as string);
      messageQueue.push(chunk);
      if (resolve) {
        resolve();
        resolve = null;
      }
      if (chunk.done) {
        done = true;
        ws.close();
      }
    };

    ws.onopen = () => {
      ws.send(JSON.stringify(req));
    };

    while (!done || messageQueue.length > 0) {
      if (messageQueue.length > 0) {
        yield messageQueue.shift()!;
      } else {
        await new Promise((r) => {
          resolve = r;
        });
      }
    }
  }
}
