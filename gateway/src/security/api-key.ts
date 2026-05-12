import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";
import { logger } from "../utils/logger.js";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class ApiKeyAuth {
  private readonly validKeys: Set<string>;
  private readonly enabled: boolean;
  private readonly rateLimitPerMinute: number;
  private readonly rateLimitMap: Map<string, RateLimitEntry>;

  constructor(env: Record<string, string | undefined>) {
    const apiKeyRaw = env.API_KEYS;
    if (apiKeyRaw) {
      this.validKeys = new Set(
        apiKeyRaw.split(",").map((k) => k.trim()).filter(Boolean)
      );
      this.enabled = this.validKeys.size > 0;
    } else {
      this.validKeys = new Set();
      this.enabled = false;
    }

    const rateLimitRaw = env.RATE_LIMIT_PER_KEY;
    this.rateLimitPerMinute = rateLimitRaw
      ? parseInt(rateLimitRaw, 10)
      : 100;

    this.rateLimitMap = new Map();

    if (this.enabled) {
      logger.info(`API key auth enabled with ${this.validKeys.size} key(s)`);
    } else {
      logger.info("API key auth disabled (no API_KEYS configured)");
    }
  }

  extractKey(request: FastifyRequest): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        return parts[1];
      }
    }

    return undefined;
  }

  authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ): void {
    if (!this.enabled) {
      done();
      return;
    }

    const key = this.extractKey(request);
    if (!key) {
      reply.code(401);
      reply.send({ error: "Missing API key", details: "Provide api_key via Authorization: Bearer <key>" });
      return;
    }

    if (!this.validKeys.has(key)) {
      logger.warn(`Invalid API key attempt from ${request.ip}`);
      reply.code(401);
      reply.send({ error: "Invalid API key" });
      return;
    }

    done();
  }

  rateLimit(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ): void {
    if (!this.enabled) {
      done();
      return;
    }

    const key = this.extractKey(request);
    if (!key) {
      done();
      return;
    }

    const now = Date.now();
    const entry = this.rateLimitMap.get(key);

    if (!entry || now >= entry.resetAt) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetAt: now + 60_000,
      });
      done();
      return;
    }

    entry.count += 1;

    if (entry.count > this.rateLimitPerMinute) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      reply.header("Retry-After", String(retryAfter));
      reply.code(429);
      reply.send({ error: "Rate limit exceeded", retryAfter });
      return;
    }

    done();
  }
}
