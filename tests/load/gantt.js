/**
 * P5-T4: Load Test — Gantt / Tasks endpoint
 *
 * Seeds a project with 200 tasks and 50 dependency pairs, then hammers
 * GET /api/projects/:id/tasks with 50 VUs × 10 iterations.
 * Target SLA: p95 response time < 800ms.
 *
 * Run: k6 run tests/load/gantt.js
 * Requires: k6 installed (https://k6.io/docs/get-started/installation/)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const PROJECT_ID = __ENV.PROJECT_ID || "1"; // Override via -e PROJECT_ID=X

const p95Trend = new Trend("gantt_p95");
const errorRate = new Rate("gantt_error_rate");

export const options = {
  vus: 50,
  iterations: 500, // 50 VUs × 10 iterations each
  thresholds: {
    http_req_duration: ["p(95)<800"],
    gantt_error_rate: ["rate<0.01"],
  },
};

const HEADERS = {
  "X-User-Role": "admin",
  "Content-Type": "application/json",
};

// ── Setup — seed 200 tasks into the test project ──────────────────────────────

export function setup() {
  // Seed tasks
  const tasks = [];
  for (let i = 0; i < 200; i++) {
    const res = http.post(
      `${BASE_URL}/api/tasks`,
      JSON.stringify({
        projectId: parseInt(PROJECT_ID),
        name: `Load Test Task ${i + 1}`,
        status: "not_started",
        priority: "medium",
        durationDays: Math.floor(Math.random() * 10) + 1,
      }),
      { headers: HEADERS }
    );
    if (res.status === 201) {
      tasks.push(res.json("id"));
    }
  }

  // Seed 50 dependency pairs
  for (let i = 0; i < 50 && i + 1 < tasks.length; i++) {
    http.post(
      `${BASE_URL}/api/tasks/${tasks[i + 1]}/dependencies`,
      JSON.stringify({ predecessorId: tasks[i] }),
      { headers: HEADERS }
    );
  }

  return { projectId: PROJECT_ID, taskIds: tasks };
}

// ── Test ──────────────────────────────────────────────────────────────────────

export default function (data) {
  const start = Date.now();

  const res = http.get(`${BASE_URL}/api/tasks?projectId=${data.projectId}`, {
    headers: HEADERS,
  });

  const duration = Date.now() - start;
  p95Trend.add(duration);

  const ok = check(res, {
    "status 200": (r) => r.status === 200,
    "response is array": (r) => {
      try {
        const d = JSON.parse(r.body);
        return Array.isArray(d);
      } catch {
        return false;
      }
    },
    "p95 < 800ms": () => duration < 800,
  });

  errorRate.add(!ok);
  sleep(0.1);
}

// ── Teardown — clean up seeded tasks ─────────────────────────────────────────

export function teardown(data) {
  for (const id of data.taskIds ?? []) {
    http.del(`${BASE_URL}/api/tasks/${id}`, null, { headers: HEADERS });
  }
}
