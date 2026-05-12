import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DmPairing } from "../security/acl.js";

describe("DmPairing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("parses allowed users from config", () => {
      const pairing = new DmPairing({
        policy: "pairing",
        allowedUsers: ["telegram:123", "discord:456"],
      });
      expect(pairing.isAllowed("telegram", "123")).toBe(true);
      expect(pairing.isAllowed("discord", "456")).toBe(true);
      expect(pairing.isAllowed("telegram", "999")).toBe(false);
    });

    it("handles empty allowed users", () => {
      const pairing = new DmPairing({ policy: "pairing", allowedUsers: [] });
      expect(pairing.isAllowed("telegram", "123")).toBe(false);
    });
  });

  describe("isAllowed", () => {
    it("returns true for open policy regardless of user", () => {
      const pairing = new DmPairing({ policy: "open", allowedUsers: [] });
      expect(pairing.isAllowed("telegram", "anyone")).toBe(true);
    });

    it("returns false for closed policy regardless of user", () => {
      const pairing = new DmPairing({ policy: "closed", allowedUsers: ["telegram:123"] });
      expect(pairing.isAllowed("telegram", "123")).toBe(false);
    });

    it("checks approved users for pairing policy", () => {
      const pairing = new DmPairing({ policy: "pairing", allowedUsers: ["telegram:123"] });
      expect(pairing.isAllowed("telegram", "123")).toBe(true);
      expect(pairing.isAllowed("telegram", "456")).toBe(false);
    });
  });

  describe("generatePairingCode", () => {
    it("returns a 6-char uppercase code", () => {
      const pairing = new DmPairing({ policy: "pairing", allowedUsers: [] });
      const code = pairing.generatePairingCode("telegram", "456");
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    });

    it("creates a pending request with 5-minute expiry", () => {
      const pairing = new DmPairing({ policy: "pairing", allowedUsers: [] });
      pairing.generatePairingCode("telegram", "456");
      const pending = pairing.getPendingPairings();
      expect(pending).toHaveLength(1);
      expect(pending[0].channel).toBe("telegram");
      expect(pending[0].userId).toBe("456");
    });
  });

  describe("approvePairing", () => {
    it("approves a valid code and adds user to approved list", () => {
      const pairing = new DmPairing({ policy: "pairing", allowedUsers: [] });
      const code = pairing.generatePairingCode("telegram", "456");
      const result = pairing.approvePairing("telegram", code);
      expect(result).toBe(true);
      expect(pairing.isAllowed("telegram", "456")).toBe(true);
    });

    it("rejects wrong channel", () => {
      const pairing = new DmPairing({ policy: "pairing", allowedUsers: [] });
      const code = pairing.generatePairingCode("telegram", "456");
      expect(pairing.approvePairing("discord", code)).toBe(false);
    });

    it("rejects wrong code", () => {
      const pairing = new DmPairing({ policy: "pairing", allowedUsers: [] });
      pairing.generatePairingCode("telegram", "456");
      expect(pairing.approvePairing("telegram", "WRONG!")).toBe(false);
    });

    it("rejects expired code", () => {
      const pairing = new DmPairing({ policy: "pairing", allowedUsers: [] });
      const code = pairing.generatePairingCode("telegram", "456");

      vi.advanceTimersByTime(6 * 60 * 1000);
      expect(pairing.approvePairing("telegram", code)).toBe(false);
    });

    it("rejects already-used code", () => {
      const pairing = new DmPairing({ policy: "pairing", allowedUsers: [] });
      const code = pairing.generatePairingCode("telegram", "456");
      expect(pairing.approvePairing("telegram", code)).toBe(true);
      expect(pairing.approvePairing("telegram", code)).toBe(false);
    });
  });

  describe("getPendingPairings", () => {
    it("returns only non-expired requests", () => {
      const pairing = new DmPairing({ policy: "pairing", allowedUsers: [] });
      pairing.generatePairingCode("telegram", "1");
      pairing.generatePairingCode("discord", "2");

      vi.advanceTimersByTime(6 * 60 * 1000);
      pairing.generatePairingCode("slack", "3");

      expect(pairing.getPendingPairings()).toHaveLength(1);
      expect(pairing.getPendingPairings()[0].channel).toBe("slack");
    });

    it("returns empty array when no pending requests", () => {
      const pairing = new DmPairing({ policy: "pairing", allowedUsers: [] });
      expect(pairing.getPendingPairings()).toHaveLength(0);
    });
  });
});
