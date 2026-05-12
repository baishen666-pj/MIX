import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer } from "../server.js";
import type { FastifyInstance } from "fastify";

describe("API Key Authentication", () => {
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
    delete process.env.API_KEYS;
    delete process.env.RATE_LIMIT_PER_KEY;
  });

  afterEach(async () => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    if (app) await app.close();
  });

  async function setupServer(): Promise<FastifyInstance> {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await createServer({
      host: "127.0.0.1",
      port: 18789,
      engine: { host: "127.0.0.1", port: 18700 },
    });
    app = result.app;
    return app;
  }

  describe("when API_KEYS is not set", () => {
    it("allows requests without auth", async () => {
      await setupServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { message: "Hi" },
      });
      // 502 because engine is unreachable, not 401
      expect(res.statusCode).toBe(502);
    });
  });

  describe("when API_KEYS is set", () => {
    it("rejects requests without an API key with 401", async () => {
      process.env.API_KEYS = "test-key-1,test-key-2";
      await setupServer();

      const res = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { message: "Hi" },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("Missing API key");
    });

    it("rejects requests with an invalid API key with 401", async () => {
      process.env.API_KEYS = "test-key-1,test-key-2";
      await setupServer();

      const res = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { message: "Hi" },
        headers: { authorization: "Bearer wrong-key" },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("Invalid API key");
    });

    it("accepts valid key via Authorization header", async () => {
      process.env.API_KEYS = "test-key-1,test-key-2";
      await setupServer();

      const res = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { message: "Hi" },
        headers: { authorization: "Bearer test-key-1" },
      });
      // 502 = auth passed, engine unreachable
      expect(res.statusCode).toBe(502);
    });

    it("accepts valid key via query parameter", async () => {
      process.env.API_KEYS = "test-key-1,test-key-2";
      await setupServer();

      const res = await app.inject({
        method: "POST",
        url: "/api/chat?api_key=test-key-2",
        payload: { message: "Hi" },
      });
      expect(res.statusCode).toBe(502);
    });
  });

  describe("health endpoint bypasses auth", () => {
    it("health endpoint works without key even when auth is enabled", async () => {
      process.env.API_KEYS = "test-key-1";
      await setupServer();

      const res = await app.inject({ method: "GET", url: "/api/health" });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("degraded");
    });
  });

  describe("rate limiting", () => {
    it("returns 429 when rate limit is exceeded", async () => {
      process.env.API_KEYS = "rate-test-key";
      process.env.RATE_LIMIT_PER_KEY = "3";
      await setupServer();

      // Make requests up to the limit
      for (let i = 0; i < 3; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/api/chat",
          payload: { message: `Hi ${i}` },
          headers: { authorization: "Bearer rate-test-key" },
        });
        // All under limit should pass auth (502 = engine unreachable)
        expect(res.statusCode).toBe(502);
      }

      // The 4th request should be rate limited
      const res = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { message: "Hi one too many" },
        headers: { authorization: "Bearer rate-test-key" },
      });
      expect(res.statusCode).toBe(429);
      expect(res.json().error).toBe("Rate limit exceeded");
      expect(res.headers["retry-after"]).toBeDefined();
    });
  });
});
