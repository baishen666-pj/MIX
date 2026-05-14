import type { FastifyInstance, FastifyRequest } from "fastify";
import type { EngineBridge } from "../bridge.js";

export interface RouteContext {
  app: FastifyInstance;
  bridge: EngineBridge;
  corsOrigins: string[];
}

export type ProxyMethod = "get" | "post" | "put" | "delete";

export function proxyRoute(
  bridge: EngineBridge,
  app: FastifyInstance,
  method: ProxyMethod,
  path: string,
  enginePathFn?: (req: FastifyRequest) => string,
  errorFallback?: unknown,
): void {
  const methodNames: Record<ProxyMethod, keyof EngineBridge> = {
    get: "proxyGet",
    post: "proxyPost",
    put: "proxyPut",
    delete: "proxyDelete",
  };

  app[method](path, async (request, reply) => {
    try {
      const bridgeFn = bridge[methodNames[method]].bind(bridge);
      const targetPath = enginePathFn ? enginePathFn(request) : path;

      let res: Response;
      if (method === "post" || method === "put") {
        res = await (bridgeFn as (p: string, b: unknown) => Promise<Response>)(targetPath, request.body);
      } else {
        res = await (bridgeFn as (p: string) => Promise<Response>)(targetPath);
      }

      if (res.status === 204) {
        reply.code(204);
        return;
      }
      return await res.json();
    } catch (err) {
      if (errorFallback !== undefined) return errorFallback;
      reply.code(502);
      return { error: "Engine unreachable" };
    }
  });
}
