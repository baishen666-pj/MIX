import http from "k6/http";
import { check } from "k6";
import { BASE_URL_ENGINE, makeHeaders, engineOptions } from "../lib/config.js";

export const options = engineOptions({
  stages: [
    { duration: "10s", target: 30 },
    { duration: "25s", target: 30 },
    { duration: "5s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(50)<30", "p(90)<100", "p(99)<300"],
    http_req_failed: ["rate<0.005"],
  },
});

const QUERIES = ["weather", "code", "data", "automation", "api", "test", "web"];

export default function () {
  const query = QUERIES[__ITER % QUERIES.length];

  const res1 = http.get(`${BASE_URL_ENGINE}/api/plugins/marketplace`, { headers: makeHeaders() });
  check(res1, { "list ok": (r) => r.status === 200 });

  const res2 = http.get(`${BASE_URL_ENGINE}/api/plugins/marketplace?category=developer`, { headers: makeHeaders() });
  check(res2, { "category ok": (r) => r.status === 200 });

  const res3 = http.get(`${BASE_URL_ENGINE}/api/plugins/marketplace?q=${query}`, { headers: makeHeaders() });
  check(res3, { "search ok": (r) => r.status === 200 });
}
