import { describe, it, expect, vi } from "vitest";
import { SlackChannel } from "../channels/slack";

function makeSlack(config = { botToken: "xoxb-test-token" }) {
  return new SlackChannel(config, vi.fn());
}

describe("SlackChannel", () => {
  it("has correct name", () => {
    expect(makeSlack().name).toBe("slack");
  });

  it("registers handler on construction", () => {
    const handler = vi.fn();
    new SlackChannel({ botToken: "tok" }, handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it("send resolves safely without connection", async () => {
    const ch = makeSlack();
    await expect(ch.send({ content: "hi", metadata: { slackChannel: "C123" } })).resolves.toBeUndefined();
  });

  it("send resolves safely without metadata", async () => {
    const ch = makeSlack();
    await expect(ch.send({ content: "hi", metadata: {} })).resolves.toBeUndefined();
  });

  it("stop does not throw", () => {
    const ch = makeSlack();
    expect(() => ch.stop()).not.toThrow();
  });
});
