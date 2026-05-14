import http from "k6/http";
import { check } from "k6";
import { BASE_URL_ENGINE, makeHeaders, engineOptions } from "../lib/config.js";

export const options = engineOptions({
  stages: [
    { duration: "10s", target: 50 },
    { duration: "20s", target: 50 },
    { duration: "5s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(50)<10", "p(90)<20", "p(99)<100"],
    http_req_failed: ["rate<0.001"],
  },
});

export default function () {
  const res = http.get(`${BASE_URL_ENGINE}/api/health`, { headers: makeHeaders() });
  check(res, {
    "status 200": (r) => r.status === 200,
    "has status ok": (r) => r.json("status") === "ok",
  });
}
