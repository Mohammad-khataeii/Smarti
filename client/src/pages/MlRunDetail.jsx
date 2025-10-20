// src/pages/MLRunDetail.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import CsvFetcher from "../components/CsvFetcher";
import PredProbaHistogram from "../components/PredProbaHistogram";

export default function MLRunDetail() {
  const navigate = useNavigate();
  const { runId } = useParams();

  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [counts, setCounts] = useState({ total: 0, passCount: 0, failCount: 0 });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [isRerunning, setIsRerunning] = useState(false);

  // Fetch all run IDs for dropdown
  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const resp = await axios.get(`http://localhost:3001/api/ml/run-ids`);
        if (resp.data.ok) {
          setRuns(resp.data.runs);
        } else {
          console.error("Run list API error:", resp.data.error);
        }
      } catch (err) {
        console.error("Error fetching run list:", err);
      } finally {
        setRunsLoading(false);
      }
    };
    fetchRuns();
  }, []);

  // Navigate to latest run if none in URL
  useEffect(() => {
    if (!runsLoading && !runId && runs.length > 0) {
      navigate(`/ml-run-detail/${runs[0].runId}`, { replace: true });
    }
  }, [runsLoading, runId, runs, navigate]);

  // Fetch summary for current run
  useEffect(() => {
    if (!runId) return;
    const fetchSummary = async () => {
      try {
        const resp = await axios.get(`http://localhost:3001/api/ml/runs/${runId}/summary`);
        if (resp.data.ok) {
          setCounts(resp.data.counts);
        } else {
          console.error("Summary API error:", resp.data.error);
        }
      } catch (err) {
        console.error("Error fetching summary:", err);
      } finally {
        setLoadingCounts(false);
      }
    };
    setLoadingCounts(true);
    fetchSummary();
  }, [runId]);

  const handleRerun = async () => {
    setIsRerunning(true);
    try {
      const response = await axios.post(`http://localhost:3001/api/ml/run`);
      const data = response.data;
      if (data.ok && data.run?.runId) {
        navigate(`/ml-run-detail/${data.run.runId}`);
      } else {
        alert("ML rerun failed: " + (data.error || "Unknown error"));
        setIsRerunning(false);
      }
    } catch (error) {
      console.error("Error triggering ML rerun:", error);
      alert("Error triggering ML rerun");
      setIsRerunning(false);
    }
  };

  const handleRunSelect = (e) => {
    const selectedId = e.target.value;
    if (selectedId && selectedId !== runId) {
      navigate(`/ml-run-detail/${selectedId}`);
    }
  };

  return (
    <section>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>ML Run Details</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Dropdown */}
          {runsLoading ? (
            <span>Loading runs...</span>
          ) : (
            <select value={runId || ""} onChange={handleRunSelect}>
              {runs.map((r) => (
                <option key={r.runId} value={r.runId}>
                  {r.runId} {r.pinned ? "📌" : ""}
                </option>
              ))}
            </select>
          )}
          {/* Rerun button */}
          <button
            onClick={handleRerun}
            disabled={isRerunning}
            style={{
              padding: "6px 12px",
              background: isRerunning ? "#ccc" : "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: isRerunning ? "not-allowed" : "pointer",
            }}
          >
            {isRerunning ? "Rerunning..." : "🔄 Rerun"}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ marginTop: 16 }}>
        {loadingCounts ? (
          <div>Loading summary...</div>
        ) : (
          <div>
            <div>Total Sessions: {counts.total}</div>
            <div>Predicted PASS: {counts.passCount}</div>
            <div>Predicted FAIL: {counts.failCount}</div>
          </div>
        )}
      </div>

      {/* Histogram */}
      {runId && (
        <div style={{ marginTop: 16 }}>
          <PredProbaHistogram runId={runId} />
        </div>
      )}

      {/* Fail patterns */}
      {runId &&
        (counts.failCount === 0 ? (
          <EmptyMessage />
        ) : (
          <CsvFetcher runId={runId} fileName="predicted_fail_step_patterns.csv">
            {({ rows }) => (
              <ul>
                {rows.slice(0, 20).map((r, idx) => (
                  <li key={`${r.stepName}-${idx}`}>
                    {r.stepName}: {r.fail_count}
                  </li>
                ))}
              </ul>
            )}
          </CsvFetcher>
        ))}
    </section>
  );
}

function EmptyMessage() {
  return (
    <div style={{ marginTop: 16, padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        No predicted FAIL sessions in this run.
      </div>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        <li>The model may be confident most sessions pass (see the probability histogram above).</li>
        <li>
          If you want stricter mining, consider retraining or adding a threshold option server-side
          (e.g., treat <code>pred_proba_pass &lt; 0.6</code> as FAIL when mining).
        </li>
        <li>You can also compare another run with different data.</li>
      </ul>
    </div>
  );
}
