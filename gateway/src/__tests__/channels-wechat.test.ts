import { describe, it, expect, vi } from "vitest";
import { WeChatChannel } from "../channels/wechat";

function makeWeChat(config = { webhookUrl: "https://example.com/webhook" }) {
  return new WeChatChannel(config, vi.fn());
}

describe("WeChatChannel", () => {
  it("has correct name", () => {
    expect(makeWeChat().name).toBe("wechat");
  });

  it("registers handler on construction", () => {
    const handler = vi.fn();
    new WeChatChannel({ webhookUrl: "url" }, handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it("send resolves safely without connection", async () => {
    const ch = makeWeChat();
    await expect(ch.send({ content: "hi", metadata: { wechatUserId: "user1" } })).resolves.toBeUndefined();
  });

  it("send resolves safely without metadata", async () => {
    const ch = makeWeChat();
    await expect(ch.send({ content: "hi", metadata: {} })).resolves.toBeUndefined();
  });

  it("stop does not throw", () => {
    const ch = makeWeChat();
    expect(() => ch.stop()).not.toThrow();
  });

  it("receiveWebhook does not throw on valid text message", () => {
    const ch = makeWeChat();
    expect(() => {
      ch.receiveWebhook({
        MsgType: "text",
        Content: "hello wechat",
        FromUserName: "user1",
        ToUserName: "bot",
      });
    }).not.toThrow();
  });

  it("receiveWebhook does not throw on non-text message", () => {
    const ch = makeWeChat();
    expect(() => {
      ch.receiveWebhook({
        MsgType: "image",
        PicUrl: "https://example.com/img.jpg",
        FromUserName: "user1",
      });
    }).not.toThrow();
  });
});
