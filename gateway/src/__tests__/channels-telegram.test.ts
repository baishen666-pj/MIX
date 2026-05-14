import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelegramChannel } from "../channels/telegram";

function makeTelegram(config = { botToken: "test-token" }) {
  return new TelegramChannel(config, vi.fn());
}

describe("TelegramChannel", () => {
  it("has correct name", () => {
    expect(makeTelegram().name).toBe("telegram");
  });

  it("registers handler on construction", () => {
    const handler = vi.fn();
    new TelegramChannel({ botToken: "tok" }, handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it("send resolves safely without connection", async () => {
    const ch = makeTelegram();
    await expect(ch.send({ content: "hi", metadata: { telegramChatId: "123" } })).resolves.toBeUndefined();
  });

  it("send resolves safely without metadata", async () => {
    const ch = makeTelegram();
    await expect(ch.send({ content: "hi", metadata: {} })).resolves.toBeUndefined();
  });

  it("stop does not throw", () => {
    const ch = makeTelegram();
    expect(() => ch.stop()).not.toThrow();
  });

  it("toChannelMessage extracts text from message update", () => {
    const ch = makeTelegram() as unknown as { toChannelMessage(update: Record<string, unknown>): unknown };
    const update = {
      update_id: 1,
      message: { message_id: 42, chat: { id: 999 }, from: { id: 111 }, text: "hello" },
    };
    const result = ch.toChannelMessage(update);
    expect(result).toMatchObject({ content: "hello", metadata: { telegramChatId: 999 } });
  });

  it("toChannelMessage returns null for non-message update", () => {
    const ch = makeTelegram() as unknown as { toChannelMessage(update: Record<string, unknown>): unknown };
    const result = ch.toChannelMessage({ update_id: 2, callback_query: { data: "x" } });
    expect(result).toBeNull();
  });
});
