import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer } from "../server.js";
import type { FastifyInstance } from "fastify";

describe("Server integration", () => {
  let app: FastifyInstance;
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.DISCORD_BOT_TOKEN;
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.WECHAT_WEBHOOK_URL;
    delete process.env.WECHAT_CORP_ID;
  });

  afterEach(async () => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    if (app) await app.close();
  });

  async function setupServer() {
    const result = await createServer({
      host: "127.0.0.1",
      port: 18789,
      engine: { host: "127.0.0.1", port: 18700 },
    });
    app = result.app;
    return result;
  }

  describe("GET /api/health", () => {
    it("returns degraded when engine is unreachable", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      await setupServer();

      const res = await app.inject({ method: "GET", url: "/api/health" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe("degraded");
      expect(body.engine).toBe("unreachable");
      expect(body.channels).toContain("webchat");
    });

    it("returns ok when engine is reachable", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "ok", version: "0.1.0" }),
      });
      await setupServer();

      const res = await app.inject({ method: "GET", url: "/api/health" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe("ok");
      expect(body.engine.status).toBe("ok");
    });
  });

  describe("POST /api/chat", () => {
    it("returns 400 for invalid body", async () => {
      await setupServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
    });

    it("returns engine response for valid message", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "resp-1", content: "Hello!", session_id: "s1" }),
      });
      await setupServer();

      const res = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { message: "Hi" },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.content).toBe("Hello!");
    });

    it("returns 502 when engine is unreachable", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      await setupServer();

      const res = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { message: "Hi" },
      });
      expect(res.statusCode).toBe(502);
      expect(res.json().error).toBe("Engine unreachable");
    });
  });

  describe("POST /api/pairing/approve", () => {
    it("returns 400 for invalid body", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      await setupServer();

      const res = await app.inject({
        method: "POST",
        url: "/api/pairing/approve",
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns approved=false for wrong code", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      await setupServer();

      const res = await app.inject({
        method: "POST",
        url: "/api/pairing/approve",
        payload: { channel: "telegram", code: "NONEXIST" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().approved).toBe(false);
    });
  });

  describe("GET /api/pairing/pending", () => {
    it("returns empty pending list", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      await setupServer();

      const res = await app.inject({ method: "GET", url: "/api/pairing/pending" });
      expect(res.statusCode).toBe(200);
      expect(res.json().pending).toEqual([]);
    });
  });
});
