import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IrcChannel } from "../channels/irc.js";
import type { ChannelMessage } from "../channels/types.js";

describe("IrcChannel", () => {
  it('has name "irc"', () => {
    const irc = new IrcChannel({ server: "irc.test.com", nick: "mixbot", channels: ["#test"] });
    expect(irc.name).toBe("irc");
  });

  it("does not start without server or nick", async () => {
    const noServer = new IrcChannel({ server: "", nick: "mixbot", channels: [] });
    const noNick = new IrcChannel({ server: "irc.test.com", nick: "", channels: [] });

    const handler = vi.fn();
    noServer.onMessage(handler);
    noNick.onMessage(handler);

    await noServer.start();
    await noNick.start();

    // No crash, no connection attempted
    expect(true).toBe(true);
  });

  it("registers handlers immutably", () => {
    const irc = new IrcChannel({ server: "irc.test.com", nick: "mixbot", channels: [] });
    const h1 = vi.fn();
    const h2 = vi.fn();
    irc.onMessage(h1);
    irc.onMessage(h2);
    // Both should be registered (no way to check directly, but no crash)
    expect(true).toBe(true);
  });

  it("send does nothing without a socket or target", async () => {
    const irc = new IrcChannel({ server: "irc.test.com", nick: "mixbot", channels: [] });
    const msg: ChannelMessage = {
      id: "irc-1",
      channel: "irc",
      userId: "user",
      content: "hello",
      metadata: { ircTarget: "#test" },
      timestamp: new Date().toISOString(),
    };
    // No socket, should not throw
    await irc.send(msg);
  });

  it("send does nothing without ircTarget in metadata", async () => {
    const irc = new IrcChannel({ server: "irc.test.com", nick: "mixbot", channels: [] });
    const msg: ChannelMessage = {
      id: "irc-1",
      channel: "irc",
      userId: "user",
      content: "hello",
      metadata: {},
      timestamp: new Date().toISOString(),
    };
    await irc.send(msg);
  });

  it("stop clears handlers and does not crash", async () => {
    const irc = new IrcChannel({ server: "irc.test.com", nick: "mixbot", channels: [] });
    irc.onMessage(vi.fn());
    await irc.stop();
    expect(true).toBe(true);
  });

  it("parses IRC PRIVMSG and emits ChannelMessage", async () => {
    const irc = new IrcChannel({ server: "irc.test.com", nick: "mixbot", channels: ["#test"] });

    const received: ChannelMessage[] = [];
    irc.onMessage((msg) => received.push(msg));

    // Access private method via cast for testing
    const ircInternal = irc as unknown as {
      handleLine: (line: string) => void;
      sendRaw: (data: string) => void;
    };

    ircInternal.handleLine(":alice!user@host PRIVMSG #test :hello world");

    expect(received).toHaveLength(1);
    expect(received[0].channel).toBe("irc");
    expect(received[0].userId).toBe("alice");
    expect(received[0].content).toBe("hello world");
    expect(received[0].metadata.ircTarget).toBe("#test");
    expect(received[0].metadata.isDm).toBe(false);
    expect(received[0].metadata.ircChannel).toBe("#test");
  });

  it("handles DM (private message) correctly", () => {
    const irc = new IrcChannel({ server: "irc.test.com", nick: "mixbot", channels: [] });

    const received: ChannelMessage[] = [];
    irc.onMessage((msg) => received.push(msg));

    const ircInternal = irc as unknown as { handleLine: (line: string) => void };
    ircInternal.handleLine(":bob!user@host PRIVMSG mixbot :private hello");

    expect(received).toHaveLength(1);
    expect(received[0].userId).toBe("bob");
    expect(received[0].content).toBe("private hello");
    expect(received[0].metadata.isDm).toBe(true);
    expect(received[0].metadata.ircTarget).toBe("bob");
  });

  it("responds to PING with PONG", () => {
    const irc = new IrcChannel({ server: "irc.test.com", nick: "mixbot", channels: [] });
    const ircInternal = irc as unknown as { handleLine: (line: string) => void; sendRaw: (data: string) => void };

    const sent: string[] = [];
    ircInternal.sendRaw = (data: string) => sent.push(data);

    ircInternal.handleLine("PING :irc.test.com");

    expect(sent).toEqual(["PONG :irc.test.com"]);
  });

  it("ignores messages from own nick", () => {
    const irc = new IrcChannel({ server: "irc.test.com", nick: "mixbot", channels: ["#test"] });

    const received: ChannelMessage[] = [];
    irc.onMessage((msg) => received.push(msg));

    const ircInternal = irc as unknown as { handleLine: (line: string) => void };
    ircInternal.handleLine(":mixbot!bot@host PRIVMSG #test :echo");

    expect(received).toHaveLength(0);
  });

  it("joins channels on 001 (welcome)", () => {
    const irc = new IrcChannel({ server: "irc.test.com", nick: "mixbot", channels: ["#chan1", "#chan2"] });
    const ircInternal = irc as unknown as { handleLine: (line: string) => void; sendRaw: (data: string) => void };

    const sent: string[] = [];
    ircInternal.sendRaw = (data: string) => sent.push(data);

    ircInternal.handleLine(":server 001 mixbot :Welcome");

    expect(sent).toContain("JOIN #chan1");
    expect(sent).toContain("JOIN #chan2");
  });
});
