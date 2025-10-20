// src/api/ml.js
import http from "./http";

// Backend base URL (in this order of precedence):
// 1) window.__API_BASE__  (you can inject this at runtime from index.html)
// 2) REACT_APP_API_BASE   (set in .env for CRA builds)
// 3) default: http://localhost:3001
const API_BASE =
  (typeof window !== "undefined" && window.__API_BASE__) ||
  process.env.REACT_APP_API_BASE ||
  "http://localhost:3001";

// Helpful in dev to confirm where requests go
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.log("[API_BASE]", API_BASE);
}

export async function runMlModel() {
  return http(`${API_BASE}/api/ml/run`, { method: "POST" });
}

export async function listMlRuns() {
  return http(`${API_BASE}/api/ml/runs`, { method: "GET" });
}

export async function getMlRun(runId) {
  return http(`${API_BASE}/api/ml/runs/${encodeURIComponent(runId)}`, {
    method: "GET",
  });
}

export async function listMlRunFiles(runId) {
  return http(`${API_BASE}/api/ml/runs/${encodeURIComponent(runId)}/files`, {
    method: "GET",
  });
}

export async function getMlRunFileText(runId, fileName) {
  return http(
    `${API_BASE}/api/ml/runs/${encodeURIComponent(runId)}/files/${encodeURIComponent(fileName)}`,
    { method: "GET", responseType: "text" }
  );
}

export async function getMlLog(runId, kind /* "train" | "predict" */) {
  return http(
    `${API_BASE}/api/ml/runs/${encodeURIComponent(runId)}/logs/${encodeURIComponent(kind)}`,
    { method: "GET", responseType: "text" }
  );
}

export async function pinMlRun(runId, pinned) {
  return http(`${API_BASE}/api/ml/runs/${encodeURIComponent(runId)}`, {
    method: "PATCH",
    body: JSON.stringify({ pinned: !!pinned }),
  });
}

export async function listRunIds() {
  return http(`${API_BASE}/api/ml/run-ids`, { method: "GET" });
}

export async function getMlRunSummary(runId) {
  return http(`${API_BASE}/api/ml/runs/${encodeURIComponent(runId)}/summary`, { method: "GET" });
}
