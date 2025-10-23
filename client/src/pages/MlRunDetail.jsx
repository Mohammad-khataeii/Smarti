import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import CsvFetcher from "../components/CsvFetcher";
import PredProbaHistogram from "../components/PredProbaHistogram";
import GoToDashboardButton from '../components/GoToDashboardButton';
import styles from "./MLRunDetail.module.css";

export default function MLRunDetail() {
  const navigate = useNavigate();
  const { runId } = useParams();

  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [counts, setCounts] = useState({ total: 0, passCount: 0, failCount: 0 });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [isRerunning, setIsRerunning] = useState(false);

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const resp = await axios.get(`http://localhost:3001/api/ml/run-ids`);
        if (resp.data.ok) setRuns(resp.data.runs);
      } catch (err) {
        console.error("Error fetching run list:", err);
      } finally {
        setRunsLoading(false);
      }
    };
    fetchRuns();
  }, []);

  useEffect(() => {
    if (!runsLoading && !runId && runs.length > 0) {
      navigate(`/ml-run-detail/${runs[0].runId}`, { replace: true });
    }
  }, [runsLoading, runId, runs, navigate]);

  useEffect(() => {
    if (!runId) return;
    const fetchSummary = async () => {
      try {
        const resp = await axios.get(`http://localhost:3001/api/ml/runs/${runId}/summary`);
        if (resp.data.ok) setCounts(resp.data.counts);
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
    if (selectedId && selectedId !== runId) navigate(`/ml-run-detail/${selectedId}`);
  };

  return (
    <section className={styles.container}>
      

      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>ML Run Details</h3>
        <div className={styles.controls}>
          {runsLoading ? (
            <span>Loading runs...</span>
          ) : (
            <select
              className={styles.selectRun}
              value={runId || ""}
              onChange={handleRunSelect}
            >
              {runs.map((r) => (
                <option key={r.runId} value={r.runId}>
                  {r.runId} {r.pinned ? "📌" : ""}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleRerun}
            disabled={isRerunning}
            className={styles.rerunButton}
          >
            {isRerunning ? "Rerunning..." : "🔄 Rerun"}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className={styles.summary}>
        {loadingCounts ? (
          <div>Loading summary...</div>
        ) : (
          <>
            <div className={styles.summaryBox}>
              <div className={styles.summaryBoxTitle}>Total Sessions</div>
              <div className={styles.summaryBoxValue}>{counts.total}</div>
            </div>
            <div className={styles.summaryBox}>
              <div className={styles.summaryBoxTitle}>Predicted PASS</div>
              <div className={styles.summaryBoxValue}>{counts.passCount}</div>
            </div>
            <div className={styles.summaryBox}>
              <div className={styles.summaryBoxTitle}>Predicted FAIL</div>
              <div className={styles.summaryBoxValue}>{counts.failCount}</div>
            </div>
          </>
        )}
      </div>

      {/* Histogram */}
      {runId && (
        <div className={styles.histogram}>
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
              <ul className={styles.failList}>
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
    <div className={styles.emptyMessage}>
      <div className={styles.emptyTitle}>
        No predicted FAIL sessions in this run.
      </div>
      <ul>
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
