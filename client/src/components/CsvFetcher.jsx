// src/components/CsvFetcher.jsx
import React from "react";
import { useCsv } from "../hooks/useCsv";

export default function CsvFetcher({ runId, fileName, children }) {
  const { rows, loading, error, reload } = useCsv(runId, fileName);
  if (loading) return <div>Loading {fileName}…</div>;
  if (error) return <div style={{ color: "crimson" }}>Failed to load: {String(error.message || error)}</div>;
  if (!rows || !rows.length) return <div>No data in {fileName}</div>;
  return children({ rows, reload });
}
