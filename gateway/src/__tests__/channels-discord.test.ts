import { describe, it, expect, vi } from "vitest";
import { DiscordChannel } from "../channels/discord";

function makeDiscord(config = { botToken: "test-token" }) {
  return new DiscordChannel(config, vi.fn());
}

describe("DiscordChannel", () => {
  it("has correct name", () => {
    expect(makeDiscord().name).toBe("discord");
  });

  it("registers handler on construction", () => {
    const handler = vi.fn();
    new DiscordChannel({ botToken: "tok" }, handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it("send resolves safely without connection", async () => {
    const ch = makeDiscord();
    await expect(ch.send({ content: "hi", metadata: { discordChannelId: "ch1" } })).resolves.toBeUndefined();
  });

  it("send resolves safely without metadata", async () => {
    const ch = makeDiscord();
    await expect(ch.send({ content: "hi", metadata: {} })).resolves.toBeUndefined();
  });

  it("stop does not throw", () => {
    const ch = makeDiscord();
    expect(() => ch.stop()).not.toThrow();
  });
});
