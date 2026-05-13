import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer } from "../server";
import { ApiKeyAuth } from "../security/api-key";

describe("WebSocket Auth — ApiKeyAuth methods", () => {
  it("isEnabled returns false when no keys configured", () => {
    const auth = new ApiKeyAuth({});
    expect(auth.isEnabled()).toBe(false);
  });

  it("isEnabled returns true when keys configured", () => {
    const auth = new ApiKeyAuth({ API_KEYS: "key1,key2" });
    expect(auth.isEnabled()).toBe(true);
  });

  it("validateKey returns true for valid key", () => {
    const auth = new ApiKeyAuth({ API_KEYS: "my-secret" });
    expect(auth.validateKey("my-secret")).toBe(true);
  });

  it("validateKey returns false for invalid key", () => {
    const auth = new ApiKeyAuth({ API_KEYS: "my-secret" });
    expect(auth.validateKey("wrong")).toBe(false);
  });
});

describe("WebSocket Auth — WS route auth bypass", () => {
  const originalEnv = { ...process.env };
  let app: Awaited<ReturnType<typeof createServer>>["app"];

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.DISCORD_BOT_TOKEN;
    delete process.env.SLACK_BOT_TOKEN;
  });

  afterEach(async () => {
    process.env = originalEnv;
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    if (app) await app.close();
  });

  async function setupServer(opts: { apiKey?: string } = {}) {
    if (opts.apiKey) {
      process.env.API_KEYS = opts.apiKey;
    } else {
      delete process.env.API_KEYS;
    }

    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await createServer({ host: "127.0.0.1", port: 18789, engine: { host: "127.0.0.1", port: 18700 } });
    app = result.app;
    return app;
  }

  it("WS upgrade bypasses preHandler auth — no API key needed at HTTP level", async () => {
    const server = await setupServer({ apiKey: "test-secret-key" });
    // WS routes skip the preHandler auth hook; auth is handled inside the WS handler
    const res = await server.inject({
      method: "GET",
      url: "/ws/chat",
      headers: { upgrade: "websocket", connection: "Upgrade" },
    });
    // 101 = upgrade accepted, 426 = upgrade required, 404 = WS-only route via inject
    // All mean the preHandler auth hook was bypassed (not 401)
    expect(res.statusCode).not.toBe(401);
  });

  it("non-WS routes still require API key", async () => {
    const server = await setupServer({ apiKey: "test-secret-key" });
    const res = await server.inject({
      method: "GET",
      url: "/api/sessions",
    });
    expect(res.statusCode).toBe(401);
  });
});
