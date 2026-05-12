import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { createServer } from "../server.js";
import type { FastifyInstance } from "fastify";

describe("Gateway → Engine E2E", () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    // Clear env to prevent channel side effects
    const savedEnv = { ...process.env };
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.DISCORD_BOT_TOKEN;
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.WECHAT_WEBHOOK_URL;
    delete process.env.IRC_SERVER;
    delete process.env.WHATSAPP_ENABLED;

    // Mock fetch to simulate engine responses
    const mockEngineResponses: Record<string, unknown> = {
      "/api/health": { status: "ok", version: "0.1.0", engine: "mix-python" },
    };

    vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
      const urlStr = url.toString();

      // Health check
      if (urlStr.includes("/api/health")) {
        return new Response(JSON.stringify(mockEngineResponses["/api/health"]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Chat
      if (urlStr.includes("/api/chat")) {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        const sessionId = body.session_id || "e2e-session-1";
        return new Response(
          JSON.stringify({
            id: "resp-e2e-1",
            session_id: sessionId,
            content: `Echo: ${body.message}`,
            tool_calls: null,
            metadata: {},
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("Not Found", { status: 404 });
    });

    const { app: server } = await createServer({
      host: "127.0.0.1",
      port: 0,
      engine: { host: "127.0.0.1", port: 18700 },
    });
    app = server;

    cleanup = async () => {
      Object.assign(process.env, savedEnv);
      vi.restoreAllMocks();
    };
  });

  afterAll(async () => {
    await cleanup?.();
    await app?.close();
  });

  it("GET /api/health returns gateway + engine status", async () => {
    const resp = await app.inject({ method: "GET", url: "/api/health" });
    expect(resp.statusCode).toBe(200);
    const data = resp.json();
    expect(data.status).toBe("ok");
    expect(data.gateway).toBe("mix-gateway");
    expect(data.engine).toBeDefined();
    expect(data.channels).toContain("webchat");
  });

  it("POST /api/chat forwards to engine and returns response", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "Hello E2E" },
    });
    expect(resp.statusCode).toBe(200);
    const data = resp.json();
    expect(data.content).toBe("Echo: Hello E2E");
    expect(data.id).toBeDefined();
  });

  it("POST /api/chat returns 400 for invalid body", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {},
    });
    expect(resp.statusCode).toBe(400);
  });

  it("POST /api/chat returns 400 for empty message", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "" },
    });
    expect(resp.statusCode).toBe(400);
  });

  it("GET /api/health returns degraded when engine is unreachable", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("Connection refused");
    });

    const resp = await app.inject({ method: "GET", url: "/api/health" });
    expect(resp.statusCode).toBe(200);
    const data = resp.json();
    expect(data.status).toBe("degraded");
    expect(data.engine).toBe("unreachable");
  });

  it("POST /api/pairing/approve validates and processes pairing", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/api/pairing/approve",
      payload: { channel: "telegram", code: "wrong-code" },
    });
    expect(resp.statusCode).toBe(200);
    expect(resp.json().approved).toBe(false);
  });

  it("GET /api/pairing/pending returns empty list", async () => {
    const resp = await app.inject({ method: "GET", url: "/api/pairing/pending" });
    expect(resp.statusCode).toBe(200);
    expect(resp.json().pending).toEqual([]);
  });

  it("lists webchat as default channel", async () => {
    const resp = await app.inject({ method: "GET", url: "/api/health" });
    const channels = resp.json().channels;
    expect(channels).toContain("webchat");
    expect(channels).not.toContain("telegram");
    expect(channels).not.toContain("discord");
  });
});
