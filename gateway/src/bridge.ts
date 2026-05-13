import type { ChatRequest, ChatResponse, StreamChunk } from "../../shared/protocols/messages";
import { logger } from "./utils/logger.js";

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

  private checkResponse(res: Response): void {
    if (!res.ok) {
      throw new Error(`Engine returned ${res.status}: ${res.statusText}`);
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async health(): Promise<{ status: string; version: string }> {
    const res = await fetch(`${this.baseUrl}/api/health`);
    this.checkResponse(res);
    return res.json() as Promise<{ status: string; version: string }>;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    this.checkResponse(res);
    return res.json() as Promise<ChatResponse>;
  }

  async *chatStream(req: ChatRequest): AsyncGenerator<StreamChunk> {
    const ws = new WebSocket(`${this.wsUrl}/ws/stream`);

    const messageQueue: StreamChunk[] = [];
    let resolve: ((value?: unknown) => void) | null = null;
    let done = false;

    // Delta batching state
    let batchDelta = "";
    let batchTimer: ReturnType<typeof setTimeout> | null = null;
    let batchResolve: ((value?: unknown) => void) | null = null;

    const flushBatch = () => {
      if (batchDelta) {
        messageQueue.push({ id: req.session_id || "", session_id: "", delta: batchDelta, done: false });
        batchDelta = "";
      }
      if (batchTimer) {
        clearTimeout(batchTimer);
        batchTimer = null;
      }
      if (batchResolve) {
        batchResolve();
        batchResolve = null;
      }
    };

    ws.onmessage = (event) => {
      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(event.data as string);
      } catch (err) {
        logger.error("Failed to parse WebSocket message from engine", err);
        return;
      }

      const chunkExtra = chunk as unknown as Record<string, unknown>;
      const isTerminal = chunk.done || chunkExtra.error || chunkExtra.type;

      if (isTerminal) {
        flushBatch();
        messageQueue.push(chunk);
      } else if (chunk.delta) {
        batchDelta += chunk.delta;
        if (!batchTimer) {
          batchTimer = setTimeout(flushBatch, 50);
        }
        if (resolve) {
          resolve();
          resolve = null;
        }
        return;
      } else {
        messageQueue.push(chunk);
      }

      if (resolve) {
        resolve();
        resolve = null;
      }
      if (chunk.done) {
        flushBatch();
        done = true;
        ws.close();
      }
    };

    ws.onopen = () => {
      ws.send(JSON.stringify(req));
    };

    while (!done || messageQueue.length > 0 || batchDelta) {
      if (messageQueue.length > 0) {
        yield messageQueue.shift()!;
      } else if (batchDelta) {
        await new Promise((r) => {
          batchResolve = r;
          resolve = r;
        });
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
    this.checkResponse(res);
    if (!res.body) throw new Error("No response body for SSE stream");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // Delta batching state
    let batchDelta = "";
    let batchId = "";
    let batchSessionId = "";
    let batchTimer: ReturnType<typeof setTimeout> | null = null;
    const batchQueue: StreamChunk[] = [];

    const flushBatch = () => {
      if (batchDelta) {
        batchQueue.push({ id: batchId, session_id: batchSessionId, delta: batchDelta, done: false });
        batchDelta = "";
      }
      if (batchTimer) {
        clearTimeout(batchTimer);
        batchTimer = null;
      }
    };

    try {
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
          if (payload === "[DONE]") {
            flushBatch();
            return;
          }
          try {
            const chunk = JSON.parse(payload) as StreamChunk;
            const chunkExtra = chunk as unknown as Record<string, unknown>;
            const isTerminal = chunk.done || chunkExtra.error || chunkExtra.type;

            if (isTerminal) {
              flushBatch();
              batchQueue.push(chunk);
            } else if (chunk.delta) {
              batchDelta += chunk.delta;
              batchId = chunk.id;
              batchSessionId = chunk.session_id;
              if (!batchTimer) {
                batchTimer = setTimeout(flushBatch, 50);
              }
              continue;
            } else {
              batchQueue.push(chunk);
            }
          } catch (err) {
            logger.error("Failed to parse SSE chunk from engine", err);
          }
        }

        // Yield any completed batch items
        while (batchQueue.length > 0) {
          yield batchQueue.shift()!;
        }
      }
    } finally {
      flushBatch();
      while (batchQueue.length > 0) {
        yield batchQueue.shift()!;
      }
    }
  }

  async ingestDocument(text: string, source?: string, chunkSize?: number): Promise<{status: string; chunks_created: number}> {
    const res = await fetch(`${this.baseUrl}/api/memory/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source, chunk_size: chunkSize }),
    });
    this.checkResponse(res);
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

  async proxyPut(path: string, body: unknown): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async proxyDelete(path: string): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
    });
  }

  async uploadFile(file: File): Promise<{status: string; filename: string; chunks_created: number}> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${this.baseUrl}/api/memory/upload`, {
      method: "POST",
      body: formData,
    });
    this.checkResponse(res);
    return res.json() as Promise<{status: string; filename: string; chunks_created: number}>;
  }

  async transcribeAudio(file: File): Promise<{text: string}> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${this.baseUrl}/api/voice/stt`, {
      method: "POST",
      body: formData,
    });
    this.checkResponse(res);
    return res.json() as Promise<{text: string}>;
  }

  async synthesizeSpeech(text: string, voice?: string, model?: string): Promise<{status: string; path: string}> {
    const res = await fetch(`${this.baseUrl}/api/voice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: voice || "alloy", model: model || "tts-1" }),
    });
    this.checkResponse(res);
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
