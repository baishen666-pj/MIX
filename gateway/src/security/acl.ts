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

  generatePairingCode(channel: string, userId: string): string {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
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
    const now = Date.now();
    const active: PairingRequest[] = [];
    for (const [, req] of this.pendingRequests) {
      if (now < req.expiresAt) {
        active.push(req);
      }
    }
    return active;
  }
}
