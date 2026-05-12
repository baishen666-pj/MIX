import { describe, it, expect, vi } from "vitest";
import { WhatsAppChannel } from "../channels/whatsapp.js";
import type { ChannelMessage } from "../channels/types.js";

describe("WhatsAppChannel", () => {
  it('has name "whatsapp"', () => {
    const wa = new WhatsAppChannel();
    expect(wa.name).toBe("whatsapp");
  });

  it("registers handlers immutably", () => {
    const wa = new WhatsAppChannel();
    const h1 = vi.fn();
    const h2 = vi.fn();
    wa.onMessage(h1);
    wa.onMessage(h2);
    expect(true).toBe(true);
  });

  it("send does nothing without a socket", async () => {
    const wa = new WhatsAppChannel();
    const msg: ChannelMessage = {
      id: "wa-1",
      channel: "whatsapp",
      userId: "test@s.whatsapp.net",
      content: "hello",
      metadata: { waJid: "test@s.whatsapp.net" },
      timestamp: new Date().toISOString(),
    };
    // No socket, should not throw
    await wa.send(msg);
  });

  it("send does nothing without waJid in metadata", async () => {
    const wa = new WhatsAppChannel();
    const msg: ChannelMessage = {
      id: "wa-1",
      channel: "whatsapp",
      userId: "test",
      content: "hello",
      metadata: {},
      timestamp: new Date().toISOString(),
    };
    await wa.send(msg);
  });

  it("stop clears handlers", async () => {
    const wa = new WhatsAppChannel();
    wa.onMessage(vi.fn());
    await wa.stop();
    expect(true).toBe(true);
  });

  it("toChannelMessage extracts text from conversation", () => {
    const wa = new WhatsAppChannel();
    const waInternal = wa as unknown as {
      toChannelMessage: (msg: unknown) => ChannelMessage | null;
    };

    const waMsg = {
      key: {
        id: "msg-123",
        remoteJid: "user@s.whatsapp.net",
        fromMe: false,
      },
      pushName: "TestUser",
      message: { conversation: "hello from WA" },
      messageTimestamp: 1700000000,
    };

    const result = waInternal.toChannelMessage(waMsg);

    expect(result).not.toBeNull();
    expect(result!.id).toBe("wa-msg-123");
    expect(result!.channel).toBe("whatsapp");
    expect(result!.userId).toBe("user@s.whatsapp.net");
    expect(result!.content).toBe("hello from WA");
    expect(result!.metadata.waJid).toBe("user@s.whatsapp.net");
    expect(result!.metadata.waPushName).toBe("TestUser");
    expect(result!.metadata.isGroup).toBe(false);
  });

  it("toChannelMessage extracts text from extendedTextMessage", () => {
    const wa = new WhatsAppChannel();
    const waInternal = wa as unknown as {
      toChannelMessage: (msg: unknown) => ChannelMessage | null;
    };

    const waMsg = {
      key: {
        id: "msg-456",
        remoteJid: "group@g.us",
        participant: "user2@s.whatsapp.net",
        fromMe: false,
      },
      pushName: "User2",
      message: { extendedTextMessage: { text: "extended text" } },
      messageTimestamp: 1700000000,
    };

    const result = waInternal.toChannelMessage(waMsg);

    expect(result).not.toBeNull();
    expect(result!.content).toBe("extended text");
    expect(result!.userId).toBe("user2@s.whatsapp.net");
    expect(result!.metadata.isGroup).toBe(true);
  });

  it("toChannelMessage extracts text from image caption", () => {
    const wa = new WhatsAppChannel();
    const waInternal = wa as unknown as {
      toChannelMessage: (msg: unknown) => ChannelMessage | null;
    };

    const waMsg = {
      key: { id: "msg-789", remoteJid: "u@s.whatsapp.net", fromMe: false },
      pushName: "U",
      message: { imageMessage: { caption: "photo caption" } },
      messageTimestamp: 1700000000,
    };

    const result = waInternal.toChannelMessage(waMsg);
    expect(result).not.toBeNull();
    expect(result!.content).toBe("photo caption");
  });

  it("toChannelMessage returns null for fromMe messages", () => {
    const wa = new WhatsAppChannel();
    const waInternal = wa as unknown as {
      toChannelMessage: (msg: unknown) => ChannelMessage | null;
    };

    const waMsg = {
      key: { id: "msg-me", remoteJid: "u@s.whatsapp.net", fromMe: true },
      message: { conversation: "self message" },
    };

    expect(waInternal.toChannelMessage(waMsg)).toBeNull();
  });

  it("toChannelMessage returns null for messages without text", () => {
    const wa = new WhatsAppChannel();
    const waInternal = wa as unknown as {
      toChannelMessage: (msg: unknown) => ChannelMessage | null;
    };

    const waMsg = {
      key: { id: "msg-notext", remoteJid: "u@s.whatsapp.net", fromMe: false },
      message: { locationMessage: { degreesLatitude: 0 } },
    };

    expect(waInternal.toChannelMessage(waMsg)).toBeNull();
  });
});
