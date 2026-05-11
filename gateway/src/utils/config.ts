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

export function loadConfig(): GatewayConfig {
  return {
    ...DEFAULT_CONFIG,
    host: process.env.MIX_GATEWAY_HOST ?? DEFAULT_CONFIG.host,
    port: parseInt(process.env.MIX_GATEWAY_PORT ?? String(DEFAULT_CONFIG.port), 10),
    engine: {
      host: process.env.MIX_ENGINE_HOST ?? DEFAULT_CONFIG.engine.host,
      port: parseInt(process.env.MIX_ENGINE_PORT ?? String(DEFAULT_CONFIG.engine.port), 10),
    },
  };
}
