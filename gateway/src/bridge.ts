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

  async *chatStreamSSE(message: string, sessionId?: string): AsyncGenerator<StreamChunk> {
    const params = new URLSearchParams({ message });
    if (sessionId) params.set("session_id", sessionId);

    const res = await fetch(`${this.baseUrl}/api/chat/stream?${params}`);
    if (!res.body) throw new Error("No response body for SSE stream");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const dataLine = line.trim();
        if (!dataLine.startsWith("data: ")) continue;
        const payload = dataLine.slice(6);
        if (payload === "[DONE]") return;
        yield JSON.parse(payload) as StreamChunk;
      }
    }
  }

  async ingestDocument(text: string, source?: string, chunkSize?: number): Promise<{status: string; chunks_created: number}> {
    const res = await fetch(`${this.baseUrl}/api/memory/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source, chunk_size: chunkSize }),
    });
    return res.json() as Promise<{status: string; chunks_created: number}>;
  }

  async proxyGet(path: string): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`);
  }

  async proxyPost(path: string, body: unknown): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async uploadFile(file: File): Promise<{status: string; filename: string; chunks_created: number}> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${this.baseUrl}/api/memory/upload`, {
      method: "POST",
      body: formData,
    });
    return res.json() as Promise<{status: string; filename: string; chunks_created: number}>;
  }

  async transcribeAudio(file: File): Promise<{text: string}> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${this.baseUrl}/api/voice/stt`, {
      method: "POST",
      body: formData,
    });
    return res.json() as Promise<{text: string}>;
  }

  async synthesizeSpeech(text: string, voice?: string, model?: string): Promise<{status: string; path: string}> {
    const res = await fetch(`${this.baseUrl}/api/voice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: voice || "alloy", model: model || "tts-1" }),
    });
    return res.json() as Promise<{status: string; path: string}>;
  }

  async *synthesizeSpeechStream(text: string, voice?: string, model?: string): AsyncGenerator<Uint8Array> {
    const res = await fetch(`${this.baseUrl}/api/voice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: voice || "alloy", model: model || "tts-1", stream: true }),
    });
    if (!res.body) throw new Error("No response body for TTS stream");
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  }
}
