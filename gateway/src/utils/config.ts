export interface GatewayConfig {
  host: string;
  port: number;
  engine: {
    host: string;
    port: number;
  };
}

const DEFAULT_CONFIG: GatewayConfig = {
  host: "127.0.0.1",
  port: 18789,
  engine: {
    host: "127.0.0.1",
    port: 18700,
  },
};

function parsePort(envVar: string | undefined, defaultPort: number): number {
  const raw = envVar ?? String(defaultPort);
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid port value: "${envVar}". Must be an integer between 1 and 65535.`);
  }
  return parsed;
}

export function loadConfig(): GatewayConfig {
  return {
    ...DEFAULT_CONFIG,
    host: process.env.MIX_GATEWAY_HOST ?? DEFAULT_CONFIG.host,
    port: parsePort(process.env.MIX_GATEWAY_PORT, DEFAULT_CONFIG.port),
    engine: {
      host: process.env.MIX_ENGINE_HOST ?? DEFAULT_CONFIG.engine.host,
      port: parsePort(process.env.MIX_ENGINE_PORT, DEFAULT_CONFIG.engine.port),
    },
  };
}
