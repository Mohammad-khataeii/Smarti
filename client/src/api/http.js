// src/api/http.js
const API_BASE =
  process.env.REACT_APP_API_BASE ||
  "http://localhost:3001"; // default to backend dev server

function buildUrl(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

export default async function http(
  path,
  {
    method = "GET",
    headers,
    body,
    responseType = "json", // "json" | "text"
    signal
  } = {}
) {
  const res = await fetch(buildUrl(path), {
    method,
    credentials: "include", // send cookies/session
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body,
    signal
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      message = isJson ? (await res.json()).error || message : await res.text();
    } catch (_) {}
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  if (responseType === "text") return res.text();
  if (responseType === "json") {
    if (isJson) return res.json();
    // fallback: try parse, else return raw text
    const t = await res.text();
    try {
      return JSON.parse(t);
    } catch {
      return t;
    }
  }
  return res.text();
}
