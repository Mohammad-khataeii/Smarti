// src/components/PredProbaHistogram.jsx
import React, { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { CategoryScale, LinearScale, BarElement, Tooltip, Legend, Chart as ChartJS } from "chart.js";
import { usePredictions } from "../hooks/usePredictions";
import GoToDashboardButton from '../components/GoToDashboardButton';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function makeHistogram(data, bins = 20) {
  const counts = new Array(bins).fill(0);
  for (const v of data) {
    if (Number.isFinite(v)) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor(v * bins)));
      counts[idx] += 1;
    }
  }
  const labels = counts.map((_, i) => {
    const lo = (i / bins).toFixed(2);
    const hi = ((i + 1) / bins).toFixed(2);
    return `${lo}–${hi}`;
  });
  return { labels, counts };
}

export default function PredProbaHistogram({ runId }) {
  const { rows, loading, error } = usePredictions(runId);

  // Call hooks unconditionally; derive safe defaults when data isn't ready
  const probs = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((r) => Number(r.pred_proba_pass))
      .filter((n) => Number.isFinite(n));
  }, [rows]);

  const { labels, counts } = useMemo(() => makeHistogram(probs, 20), [probs]);

  if (loading) return <div>Loading probabilities…</div>;
  if (error) return <div style={{ color: "crimson" }}>Failed to load predictions: {String(error.message || error)}</div>;
  if (!rows || rows.length === 0) return null;

  return (
    <div>
      <h4>Probability of PASS (distribution)</h4>
      <GoToDashboardButton />
      <Bar
        data={{
          labels,
          datasets: [{ label: "count", data: counts }]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } }
        }}
        height={240}
      />
    </div>
  );
}
