import http from "k6/http";
import { check } from "k6";
import { BASE_URL_ENGINE, BASE_URL_GATEWAY, makeHeaders } from "../lib/config.js";

export const options = {
  scenarios: {
    engine: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 10 },
        { duration: "30s", target: 10 },
        { duration: "5s", target: 0 },
      ],
      tags: { target: "engine" },
      gracefulRampDown: "5s",
    },
    gateway: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 10 },
        { duration: "30s", target: 10 },
        { duration: "5s", target: 0 },
      ],
      tags: { target: "gateway" },
      gracefulRampDown: "5s",
    },
  },
  thresholds: {
    http_req_duration: ["p(90)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const target = __ENV.K6_SCENARIO_NAME || "engine";
  const baseUrl = target === "gateway" ? BASE_URL_GATEWAY : BASE_URL_ENGINE;

  const res = http.get(`${baseUrl}/api/health`, {
    headers: makeHeaders(),
    tags: { target },
  });
  check(res, { "health ok": (r) => r.status === 200 });

  const payload = JSON.stringify({ message: "overhead test", session_id: `ovh-${__VU}` });
  const chatRes = http.post(`${baseUrl}/api/chat`, payload, {
    headers: makeHeaders(),
    tags: { target },
  });
  check(chatRes, { "chat ok": (r) => r.status === 200 });

  const mktRes = http.get(`${baseUrl}/api/plugins/marketplace`, {
    headers: makeHeaders(),
    tags: { target },
  });
  check(mktRes, { "marketplace ok": (r) => r.status === 200 });
}
