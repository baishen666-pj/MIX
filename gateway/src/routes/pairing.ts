import type { RouteContext } from "./types.js";
import type { DmPairing } from "../security/dm-pairing.js";
import { validate, pairingApproveSchema } from "../schemas.js";

export function registerPairingRoutes(ctx: RouteContext, pairing: DmPairing): void {
  const { app } = ctx;

  app.post("/api/pairing/approve", async (request, reply) => {
    let body;
    try {
      body = validate(pairingApproveSchema, request.body);
    } catch (err) {
      reply.code(400);
      return { error: "Validation failed" };
    }
    const approved = pairing.approvePairing(body.channel, body.code);
    return { approved };
  });

  app.get("/api/pairing/pending", async () => {
    return { pending: pairing.getPendingPairings() };
  });
}
