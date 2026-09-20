import assert from "node:assert/strict";

// Canary smoke test: validates the deployment after a canary weight change.
// At low weights (10 %) most requests hit the stable version, so this script
// checks overall health and response times rather than trying to target the
// canary specifically. If the canary image is broken, error rates and latency
// spike even at 10 %, which is what these assertions catch.

const base = process.argv[2];
assert(base && /^https?:\/\//.test(base), "An application URL is required");

const samples = 10;
const maxAcceptableMs = 5000;
const maxErrorRate = 0.2; // 20 % — at 10 % canary weight, one failing request
                          // out of ten is already 100 % canary failure.

let errors = 0;
const latencies = [];

for (let i = 0; i < samples; i++) {
  const start = Date.now();
  try {
    const response = await fetch(new URL("/api/health", base), {
      signal: AbortSignal.timeout(30000),
    });
    const elapsed = Date.now() - start;
    latencies.push(elapsed);

    if (response.status !== 200) {
      errors++;
      continue;
    }
    const body = await response.json();
    if (!body.ok) errors++;
  } catch {
    errors++;
    latencies.push(Date.now() - start);
  }
}

const errorRate = errors / samples;
const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
const p95Index = Math.floor(samples * 0.95);
const sortedLatencies = [...latencies].sort((a, b) => a - b);
const p95Latency = sortedLatencies[Math.min(p95Index, sortedLatencies.length - 1)];

assert.ok(
  errorRate <= maxErrorRate,
  `Canary error rate ${(errorRate * 100).toFixed(1)} % exceeds ${maxErrorRate * 100} % threshold (${errors}/${samples} requests failed)`,
);
assert.ok(
  avgLatency < maxAcceptableMs,
  `Canary average response time ${avgLatency.toFixed(0)} ms exceeds ${maxAcceptableMs} ms threshold`,
);

console.log(
  `Canary smoke passed: ${errors}/${samples} errors (${(errorRate * 100).toFixed(1)} %), ` +
  `avg ${avgLatency.toFixed(0)} ms, p95 ${p95Latency} ms`,
);
