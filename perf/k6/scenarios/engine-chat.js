import http from "k6/http";
import { check } from "k6";
import { BASE_URL_ENGINE, makeHeaders, engineOptions } from "../lib/config.js";

export const options = engineOptions({
  stages: [
    { duration: "10s", target: 20 },
    { duration: "40s", target: 20 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(50)<200", "p(90)<400", "p(99)<1000"],
    http_req_failed: ["rate<0.01"],
  },
});

export default function () {
  const payload = JSON.stringify({
    message: `Perf test message ${__VU}-${__ITER}`,
    session_id: `perf-${__VU}`,
  });
  const res = http.post(`${BASE_URL_ENGINE}/api/chat`, payload, {
    headers: makeHeaders(),
  });
  check(res, {
    "status 200": (r) => r.status === 200,
    "has response id": (r) => r.json("id") !== undefined,
    "has content": (r) => typeof r.json("content") === "string",
  });
}
