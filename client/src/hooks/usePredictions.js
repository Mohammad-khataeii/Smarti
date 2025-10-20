import { useEffect, useState } from "react";
import { getMlRunFileText } from "../api/ml";

export function usePredictions(runId) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(Boolean(runId));
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!runId) return;
      setLoading(true);
      setError(null);
      try {
        const txt = await getMlRunFileText(runId, "predictions.json");
        console.log("🔍 Raw predictions.json text:", txt);
        const data = JSON.parse(txt);
        console.log("📊 Parsed predictions data:", data);
        if (!cancelled) {
          setRows(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("❌ Error fetching predictions.json:", e);
        if (!cancelled) {
          setError(e);
          setRows(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [runId]);

  // Quick summary
  let total = 0, passCount = 0, failCount = 0;
  if (Array.isArray(rows)) {
    total = rows.length;
    failCount = rows.filter(r => Number(r.pred_label) === 0).length; // FAIL=0
    passCount = total - failCount;
  }

  console.log("📈 Computed summary:", { total, passCount, failCount });

  return { rows, loading, error, total, passCount, failCount };
}
