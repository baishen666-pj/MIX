import { describe, it, expect, vi } from "vitest";
import { DiscordChannel } from "../channels/discord";
import type { ChannelMessage } from "../channels/types";

function makeDiscord(config = { botToken: "test-token" }) {
  const ch = new DiscordChannel(config);
  ch.onMessage(vi.fn());
  return ch;
}

function makeMsg(overrides: Partial<ChannelMessage> = {}): ChannelMessage {
  return {
    id: "test-id",
    channel: "discord",
    userId: "test-user",
    content: "hi",
    metadata: { discordChannelId: "ch1" },
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("DiscordChannel", () => {
  it("has correct name", () => {
    expect(makeDiscord().name).toBe("discord");
  });

  it("registers handler on construction", () => {
    const handler = vi.fn();
    const ch = new DiscordChannel({ botToken: "tok" });
    ch.onMessage(handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it("send resolves safely without connection", async () => {
    const ch = makeDiscord();
    await expect(ch.send(makeMsg({ metadata: { discordChannelId: "ch1" } }))).resolves.toBeUndefined();
  });

  it("send resolves safely without metadata", async () => {
    const ch = makeDiscord();
    await expect(ch.send(makeMsg({ metadata: {} }))).resolves.toBeUndefined();
  });

  it("stop does not throw", () => {
    const ch = makeDiscord();
    expect(() => ch.stop()).not.toThrow();
  });
});
