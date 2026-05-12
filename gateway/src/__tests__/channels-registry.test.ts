import { describe, it, expect, vi } from "vitest";
import { ChannelRegistry } from "../channels/registry.js";
import type { ChannelAdapter, ChannelMessage } from "../channels/types.js";

function createMockAdapter(name: string): ChannelAdapter & { _handlers: Array<(msg: ChannelMessage) => void> } {
  const handlers: Array<(msg: ChannelMessage) => void> = [];
  return {
    name: name as ChannelAdapter["name"],
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    onMessage: vi.fn((handler) => handlers.push(handler)),
    send: vi.fn().mockResolvedValue(undefined),
    _handlers: handlers,
  };
}

function emitMessage(adapter: ReturnType<typeof createMockAdapter>, msg: ChannelMessage) {
  for (const handler of adapter._handlers) {
    handler(msg);
  }
}

describe("ChannelRegistry", () => {
  it("registers an adapter and lists it", () => {
    const registry = new ChannelRegistry();
    const adapter = createMockAdapter("telegram");
    registry.register(adapter);
    expect(registry.listChannels()).toEqual(["telegram"]);
  });

  it("registers multiple adapters", () => {
    const registry = new ChannelRegistry();
    registry.register(createMockAdapter("telegram"));
    registry.register(createMockAdapter("discord"));
    expect(registry.listChannels()).toContain("telegram");
    expect(registry.listChannels()).toContain("discord");
  });

  it("dispatches messages from adapters to registered handlers", () => {
    const registry = new ChannelRegistry();
    const adapter = createMockAdapter("telegram");
    registry.register(adapter);

    const handler = vi.fn();
    registry.onMessage(handler);

    const msg: ChannelMessage = {
      id: "1",
      channel: "telegram",
      userId: "u1",
      content: "hi",
      metadata: {},
      timestamp: new Date().toISOString(),
    };
    emitMessage(adapter, msg);
    expect(handler).toHaveBeenCalledWith(msg);
  });

  it("routes send to the correct adapter", async () => {
    const registry = new ChannelRegistry();
    const telegram = createMockAdapter("telegram");
    const discord = createMockAdapter("discord");
    registry.register(telegram);
    registry.register(discord);

    const msg: ChannelMessage = {
      id: "1",
      channel: "telegram",
      userId: "u1",
      content: "hi",
      metadata: {},
      timestamp: new Date().toISOString(),
    };
    await registry.send(msg);
    expect(telegram.send).toHaveBeenCalledWith(msg);
    expect(discord.send).not.toHaveBeenCalled();
  });

  it("throws on send to unknown channel", async () => {
    const registry = new ChannelRegistry();
    const msg: ChannelMessage = {
      id: "1",
      channel: "webchat" as ChannelMessage["channel"],
      userId: "u1",
      content: "hi",
      metadata: {},
      timestamp: new Date().toISOString(),
    };
    const adapter = createMockAdapter("telegram");
    registry.register(adapter);
    msg.channel = "telegram";
    await registry.send(msg);
    await expect(registry.send({ ...msg, channel: "irc" as ChannelMessage["channel"] })).rejects.toThrow("Unknown channel");
  });

  it("calls start on all adapters", async () => {
    const registry = new ChannelRegistry();
    const a1 = createMockAdapter("telegram");
    const a2 = createMockAdapter("discord");
    registry.register(a1);
    registry.register(a2);
    await registry.startAll();
    expect(a1.start).toHaveBeenCalled();
    expect(a2.start).toHaveBeenCalled();
  });

  it("calls stop on all adapters", async () => {
    const registry = new ChannelRegistry();
    const a1 = createMockAdapter("telegram");
    const a2 = createMockAdapter("discord");
    registry.register(a1);
    registry.register(a2);
    await registry.stopAll();
    expect(a1.stop).toHaveBeenCalled();
    expect(a2.stop).toHaveBeenCalled();
  });

  it("returns adapter by name", () => {
    const registry = new ChannelRegistry();
    const adapter = createMockAdapter("telegram");
    registry.register(adapter);
    expect(registry.getAdapter("telegram")).toBe(adapter);
  });

  it("returns undefined for unknown adapter", () => {
    const registry = new ChannelRegistry();
    expect(registry.getAdapter("unknown")).toBeUndefined();
  });
});
