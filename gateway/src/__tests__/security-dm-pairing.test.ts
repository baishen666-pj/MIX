import { describe, it, expect, vi } from "vitest";
import { DmSecurityFilter } from "../security/dm-pairing.js";
import { DmPairing } from "../security/acl.js";
import type { ChannelMessage } from "../channels/types.js";

function makeMessage(overrides: Partial<ChannelMessage> & { metadata?: Record<string, unknown> }): ChannelMessage {
  return {
    id: "msg-1",
    channel: "telegram",
    userId: "user-1",
    content: "hello",
    metadata: { isDm: false, ...overrides.metadata },
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("DmSecurityFilter", () => {
  it("allows non-DM messages unconditionally", () => {
    const pairing = new DmPairing({ policy: "closed", allowedUsers: [] });
    const filter = new DmSecurityFilter(pairing);
    const msg = makeMessage({});
    expect(filter.filter(msg)).toEqual({ allowed: true });
  });

  it("allows DM from approved user with open policy", () => {
    const pairing = new DmPairing({ policy: "open", allowedUsers: [] });
    const filter = new DmSecurityFilter(pairing);
    const msg = makeMessage({ metadata: { isDm: true } });
    expect(filter.filter(msg).allowed).toBe(true);
  });

  it("blocks DM from unknown user and returns pairing code", () => {
    const pairing = new DmPairing({ policy: "pairing", allowedUsers: [] });
    const filter = new DmSecurityFilter(pairing);
    const msg = makeMessage({ metadata: { isDm: true } });
    const result = filter.filter(msg);
    expect(result.allowed).toBe(false);
    expect(result.response).toContain("pair");
    expect(result.response).toMatch(/[A-Z0-9]{6}/);
  });

  it("allows DM from pre-approved user", () => {
    const pairing = new DmPairing({ policy: "pairing", allowedUsers: ["telegram:user-1"] });
    const filter = new DmSecurityFilter(pairing);
    const msg = makeMessage({ metadata: { isDm: true } });
    expect(filter.filter(msg).allowed).toBe(true);
  });

  it("blocks DM with closed policy even for pre-approved users", () => {
    const pairing = new DmPairing({ policy: "closed", allowedUsers: ["telegram:user-1"] });
    const filter = new DmSecurityFilter(pairing);
    const msg = makeMessage({ metadata: { isDm: true } });
    const result = filter.filter(msg);
    expect(result.allowed).toBe(false);
    expect(result.response).toBe("Access denied.");
  });
});
