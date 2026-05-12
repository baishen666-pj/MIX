import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../utils/config.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MIX_GATEWAY_HOST;
    delete process.env.MIX_GATEWAY_PORT;
    delete process.env.MIX_ENGINE_HOST;
    delete process.env.MIX_ENGINE_PORT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns defaults when no env vars set", () => {
    const config = loadConfig();
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(18789);
    expect(config.engine.host).toBe("127.0.0.1");
    expect(config.engine.port).toBe(18700);
  });

  it("overrides host from MIX_GATEWAY_HOST", () => {
    process.env.MIX_GATEWAY_HOST = "0.0.0.0";
    const config = loadConfig();
    expect(config.host).toBe("0.0.0.0");
  });

  it("overrides port from MIX_GATEWAY_PORT", () => {
    process.env.MIX_GATEWAY_PORT = "3000";
    const config = loadConfig();
    expect(config.port).toBe(3000);
  });

  it("overrides engine host from MIX_ENGINE_HOST", () => {
    process.env.MIX_ENGINE_HOST = "10.0.0.1";
    const config = loadConfig();
    expect(config.engine.host).toBe("10.0.0.1");
  });

  it("overrides engine port from MIX_ENGINE_PORT", () => {
    process.env.MIX_ENGINE_PORT = "8080";
    const config = loadConfig();
    expect(config.engine.port).toBe(8080);
  });

  it("parses port from string to number", () => {
    process.env.MIX_GATEWAY_PORT = "9999";
    const config = loadConfig();
    expect(typeof config.port).toBe("number");
    expect(config.port).toBe(9999);
  });
});
