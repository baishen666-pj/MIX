import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer } from "../server";

describe("Voice Routes", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  let app: Awaited<ReturnType<typeof createServer>>["app"];

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.DISCORD_BOT_TOKEN;
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.API_KEYS;
  });

  afterEach(async () => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    if (app) await app.close();
  });

  async function setupServer() {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await createServer({ host: "127.0.0.1", port: 18789, engine: { host: "127.0.0.1", port: 18700 } });
    app = result.app;
    return app;
  }

  it("POST /api/voice/tts - returns synthesized audio path", async () => {
    const server = await setupServer();

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/voice/tts")) {
        return new Response(JSON.stringify({ status: "ok", path: "/tmp/tts_audio.mp3" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not Found", { status: 404 });
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/voice/tts",
      payload: { text: "Hello world", voice: "alloy" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("ok");
    expect(body.path).toContain("tts_audio");
  });

  it("POST /api/voice/tts - returns 400 when text is missing", async () => {
    const server = await setupServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/voice/tts",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("text");
  });

  it("POST /api/voice/tts - returns 502 when engine unreachable", async () => {
    const server = await setupServer();
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await server.inject({
      method: "POST",
      url: "/api/voice/tts",
      payload: { text: "Hello" },
    });

    expect(response.statusCode).toBe(502);
  });

  it("POST /api/voice/tts - proxies voice and model params", async () => {
    const server = await setupServer();
    let capturedBody: string | null = null;

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string | URL, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ status: "ok", path: "/tmp/t.mp3" }), {
        headers: { "Content-Type": "application/json" },
      });
    });

    await server.inject({
      method: "POST",
      url: "/api/voice/tts",
      payload: { text: "test", voice: "nova", model: "tts-1-hd" },
    });

    expect(capturedBody).toBeTruthy();
    const parsed = JSON.parse(capturedBody!);
    expect(parsed.voice).toBe("nova");
    expect(parsed.model).toBe("tts-1-hd");
  });

  it("POST /api/voice/stt - returns error when no file uploaded", async () => {
    const server = await setupServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/voice/stt",
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });
});
