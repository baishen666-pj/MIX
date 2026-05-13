import { randomBytes } from "node:crypto";

export interface DmPairingConfig {
  policy: "pairing" | "open" | "closed";
  allowedUsers: string[];
}

interface PairingRequest {
  code: string;
  channel: string;
  userId: string;
  expiresAt: number;
}

export class DmPairing {
  private config: DmPairingConfig;
  private pendingRequests: Map<string, PairingRequest> = new Map();
  private approvedUsers: Map<string, Set<string>> = new Map(); // channel -> user ids

  constructor(config: DmPairingConfig) {
    this.config = config;
    for (const userId of config.allowedUsers) {
      const [channel, id] = userId.split(":");
      if (channel && id) {
        if (!this.approvedUsers.has(channel)) {
          this.approvedUsers.set(channel, new Set());
        }
        this.approvedUsers.get(channel)!.add(id);
      }
    }
  }

  isAllowed(channel: string, userId: string): boolean {
    if (this.config.policy === "open") return true;
    if (this.config.policy === "closed") return false;
    const allowed = this.approvedUsers.get(channel);
    return allowed?.has(userId) ?? false;
  }

  canPair(_channel: string, _userId: string): boolean {
    return this.config.policy === "pairing";
  }

  generatePairingCode(channel: string, userId: string): string {
    if (this.pendingRequests.size > 500) {
      this.cleanupExpiredPairings();
    }
    const code = randomBytes(4).toString("hex").toUpperCase().substring(0, 6);
    const key = `${channel}:${userId}`;
    this.pendingRequests.set(key, {
      code,
      channel,
      userId,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });
    return code;
  }

  approvePairing(channel: string, code: string): boolean {
    for (const [key, req] of this.pendingRequests) {
      if (req.channel === channel && req.code === code && Date.now() < req.expiresAt) {
        this.pendingRequests.delete(key);
        if (!this.approvedUsers.has(channel)) {
          this.approvedUsers.set(channel, new Set());
        }
        this.approvedUsers.get(channel)!.add(req.userId);
        return true;
      }
    }
    return false;
  }

  getPendingPairings(): PairingRequest[] {
    this.cleanupExpiredPairings();
    const now = Date.now();
    const active: PairingRequest[] = [];
    for (const [, req] of this.pendingRequests) {
      if (now < req.expiresAt) {
        active.push(req);
      }
    }
    return active;
  }

  private cleanupExpiredPairings(): void {
    const now = Date.now();
    for (const [key, req] of this.pendingRequests) {
      if (req.expiresAt < now) {
        this.pendingRequests.delete(key);
      }
    }
  }
}
