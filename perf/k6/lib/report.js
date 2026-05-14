#!/usr/bin/env node
/**
 * Parse k6 JSON output and generate a summary report.
 * Usage: node report.js < results.json
 */

const fs = require("fs");

function parseK6Json(input) {
  const lines = input.trim().split("\n").filter(Boolean);
  const metrics = {};

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type === "Point" && entry.metric) {
        if (!metrics[entry.metric]) metrics[entry.metric] = [];
        metrics[entry.metric].push(entry.data.value);
      }
    } catch {}
  }
  return metrics;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function analyzeMetric(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p99: percentile(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
  };
}

function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}us`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function main() {
  const input = fs.readFileSync("/dev/stdin", "utf8");
  if (!input.trim()) {
    console.error("No input data");
    process.exit(1);
  }

  const metrics = parseK6Json(input);

  const httpDurations = metrics["http_req_duration"] || [];
  const httpReqs = metrics["http_reqs"] || [];
  const httpFailed = metrics["http_req_failed"] || [];

  if (httpDurations.length === 0) {
    console.error("No HTTP request data found");
    process.exit(1);
  }

  const duration = analyzeMetric(httpDurations);
  const totalReqs = httpReqs.length;
  const failedReqs = httpFailed.filter((v) => v === 1).length;
  const errorRate = totalReqs > 0 ? (failedReqs / httpReqs.length) * 100 : 0;
  const testDuration = metrics["iteration_duration"]
    ? analyzeMetric(metrics["iteration_duration"])
    : null;

  console.log("\n" + "=".repeat(70));
  console.log("MIX Performance Test Report");
  console.log("=".repeat(70));
  console.log(`Requests:  ${totalReqs}`);
  console.log(`Errors:    ${failedReqs} (${errorRate.toFixed(2)}%)`);
  console.log(`Duration:  p50=${formatMs(duration.p50)} p90=${formatMs(duration.p90)} p99=${formatMs(duration.p99)}`);
  console.log(`Throughput: ~${(totalReqs / (duration.max / 1000 || 1)).toFixed(0)} RPS (approx)`);
  console.log("=".repeat(70) + "\n");

  const report = {
    timestamp: new Date().toISOString(),
    requests: totalReqs,
    errors: failedReqs,
    error_rate: errorRate,
    latency: duration,
  };

  const outDir = process.env.REPORT_DIR || "perf/results";
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = `${outDir}/report-${ts}.json`;
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`Report saved to ${outPath}`);
  } catch (e) {
    console.error(`Failed to save report: ${e.message}`);
  }

  process.exit(errorRate > 5 ? 1 : 0);
}

main();
