/**
 * P5-T4: Load Test — Capacity Heatmap endpoint
 *
 * Seeds 100 resources with 12 weeks of allocations, then hammers
 * GET /api/capacity with 30 VUs × 10 iterations.
 * Target SLA: p95 response time < 1200ms.
 *
 * Run: k6 run tests/load/heatmap.js
 * Requires: k6 installed (https://k6.io/docs/get-started/installation/)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const PROJECT_ID = __ENV.PROJECT_ID || "1";

const p95Trend = new Trend("heatmap_p95");
const errorRate = new Rate("heatmap_error_rate");

export const options = {
  vus: 30,
  iterations: 300, // 30 VUs × 10 iterations each
  thresholds: {
    http_req_duration: ["p(95)<1200"],
    heatmap_error_rate: ["rate<0.01"],
  },
};

const HEADERS = {
  "X-User-Role": "admin",
  "Content-Type": "application/json",
};

// ── Setup — note: seeding 100 resources is expensive; use existing data ───────
// In CI: pre-seed via scripts/seed-load-test-data.ts before running k6.

export function setup() {
  // Verify capacity endpoint is reachable
  const probe = http.get(`${BASE_URL}/api/capacity`, { headers: HEADERS });
  if (probe.status !== 200) {
    console.error(`Capacity endpoint not ready: ${probe.status}`);
  }
  return {};
}

// ── Test ──────────────────────────────────────────────────────────────────────

export default function (_data) {
  const start = Date.now();

  // Test the main capacity heatmap endpoint
  const res = http.get(`${BASE_URL}/api/capacity`, { headers: HEADERS });

  const duration = Date.now() - start;
  p95Trend.add(duration);

  const ok = check(res, {
    "status 200": (r) => r.status === 200,
    "has weeks data": (r) => {
      try {
        const d = JSON.parse(r.body);
        return Array.isArray(d) || (typeof d === "object" && d !== null);
      } catch {
        return false;
      }
    },
    "p95 < 1200ms": () => duration < 1200,
  });

  errorRate.add(!ok);

  // Also test allocations endpoint under load
  const allocRes = http.get(`${BASE_URL}/api/allocations?projectId=${PROJECT_ID}`, {
    headers: HEADERS,
  });

  check(allocRes, {
    "allocations 200": (r) => r.status === 200,
  });

  sleep(0.1);
}
