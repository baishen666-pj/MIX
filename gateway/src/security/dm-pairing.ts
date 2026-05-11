import type { ChannelMessage } from "../channels/types.js";
import { DmPairing } from "./acl.js";

export { DmPairing } from "./acl.js";
export type { DmPairingConfig } from "./acl.js";

export class DmSecurityFilter {
  private pairing: DmPairing;

  constructor(pairing: DmPairing) {
    this.pairing = pairing;
  }

  filter(msg: ChannelMessage): { allowed: boolean; response?: string } {
    const isDm = msg.metadata.isDm === true;
    if (!isDm) return { allowed: true };

    if (this.pairing.isAllowed(msg.channel, msg.userId)) {
      return { allowed: true };
    }

    if (this.pairing.isAllowed(msg.channel, msg.userId) === false) {
      const code = this.pairing.generatePairingCode(msg.channel, msg.userId);
      return {
        allowed: false,
        response: `To pair with this bot, send this code to the admin: ${code}`,
      };
    }

    return { allowed: false, response: "Access denied." };
  }
}
