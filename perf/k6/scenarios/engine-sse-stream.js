import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL_ENGINE, makeHeaders, engineOptions } from "../lib/config.js";

export const options = engineOptions({
  stages: [
    { duration: "10s", target: 10 },
    { duration: "40s", target: 10 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(50)<500", "p(90)<800", "p(99)<2000"],
    http_req_failed: ["rate<0.01"],
  },
});

export default function () {
  const url = `${BASE_URL_ENGINE}/api/chat/stream?message=Stream+perf+${__VU}-${__ITER}&session_id=perf-stream-${__VU}`;
  const res = http.get(url, { headers: makeHeaders(), timeout: "30s" });
  check(res, {
    "status 200": (r) => r.status === 200,
    "is SSE": (r) => r.headers["Content-Type"]?.includes("text/event-stream") || r.body?.includes("data:"),
    "has DONE": (r) => r.body?.includes("[DONE]"),
  });
  sleep(0.5);
}
