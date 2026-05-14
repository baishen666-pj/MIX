import http from "k6/http";
import { check } from "k6";

export const BASE_URL_ENGINE = __ENV.ENGINE_URL || "http://127.0.0.1:18700";
export const BASE_URL_GATEWAY = __ENV.GATEWAY_URL || "http://127.0.0.1:18789";
export const API_KEY = __ENV.PERF_API_KEY || "";

export function makeHeaders() {
  const h = { "Content-Type": "application/json" };
  if (API_KEY) h["Authorization"] = `Bearer ${API_KEY}`;
  return h;
}

export function engineOptions(scenarioConfig) {
  return {
    scenarios: {
      default: {
        executor: "ramping-vus",
        startVUs: 0,
        stages: scenarioConfig.stages,
        gracefulRampDown: "5s",
      },
    },
    thresholds: scenarioConfig.thresholds,
  };
}
