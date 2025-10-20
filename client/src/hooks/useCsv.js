// src/hooks/useCsv.js
import { useEffect, useMemo, useState } from "react";
import { getMlRunFileText } from "../api/ml";
import { parseCsv } from "../utils/csv";

/**
 * Fetch + parse a CSV from /api/ml/runs/:runId/files/:name
 * Returns { rows, loading, error, reload }
 */
export function useCsv(runId, fileName, { parseOptions } = {}) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(runId && fileName));
  const key = useMemo(() => `${runId}::${fileName}`, [runId, fileName]);

  async function load() {
    if (!runId || !fileName) return;
    setLoading(true);
    setError(null);
    try {
      const text = await getMlRunFileText(runId, fileName);
      const parsed = parseCsv(text, parseOptions);
      setRows(parsed);
    } catch (e) {
      setError(e);
      setRows(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);

  return { rows, loading, error, reload: load };
}
