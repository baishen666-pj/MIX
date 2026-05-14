import http from "k6/http";
import { check } from "k6";
import { BASE_URL_ENGINE, makeHeaders, engineOptions } from "../lib/config.js";

export const options = engineOptions({
  stages: [
    { duration: "10s", target: 20 },
    { duration: "25s", target: 20 },
    { duration: "5s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(50)<50", "p(90)<150", "p(99)<400"],
    http_req_failed: ["rate<0.005"],
  },
});

const QUERIES = [
  "performance testing", "memory search", "conversation history",
  "project context", "user preferences", "task results",
  "debug logs", "api responses", "configuration", "agent state",
];

export default function () {
  const query = QUERIES[(__VU * 7 + __ITER) % QUERIES.length];
  const payload = JSON.stringify({ query, limit: 10 });
  const res = http.post(`${BASE_URL_ENGINE}/api/memory/search`, payload, {
    headers: makeHeaders(),
  });
  check(res, {
    "status 200": (r) => r.status === 200,
    "has results": (r) => Array.isArray(r.json("results")),
  });
}
