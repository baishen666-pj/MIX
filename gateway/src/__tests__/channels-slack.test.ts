import { describe, it, expect, vi } from "vitest";
import { SlackChannel } from "../channels/slack";
import type { ChannelMessage } from "../channels/types";

function makeSlack(config = { botToken: "xoxb-test-token" }) {
  const ch = new SlackChannel(config);
  ch.onMessage(vi.fn());
  return ch;
}

function makeMsg(overrides: Partial<ChannelMessage> = {}): ChannelMessage {
  return {
    id: "test-id",
    channel: "slack",
    userId: "test-user",
    content: "hi",
    metadata: { slackChannel: "C123" },
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("SlackChannel", () => {
  it("has correct name", () => {
    expect(makeSlack().name).toBe("slack");
  });

  it("registers handler on construction", () => {
    const handler = vi.fn();
    const ch = new SlackChannel({ botToken: "tok" });
    ch.onMessage(handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it("send resolves safely without connection", async () => {
    const ch = makeSlack();
    await expect(ch.send(makeMsg({ metadata: { slackChannel: "C123" } }))).resolves.toBeUndefined();
  });

  it("send resolves safely without metadata", async () => {
    const ch = makeSlack();
    await expect(ch.send(makeMsg({ metadata: {} }))).resolves.toBeUndefined();
  });

  it("stop does not throw", () => {
    const ch = makeSlack();
    expect(() => ch.stop()).not.toThrow();
  });
});
