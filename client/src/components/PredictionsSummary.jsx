import React from "react";
import { usePredictions } from "../hooks/usePredictions";
import GoToDashboardButton from '../components/GoToDashboardButton';

export default function PredictionsSummary({ runId }) {
  const { loading, error, total, passCount, failCount } = usePredictions(runId);

  if (loading) return <div>Loading predictions…</div>;
  if (error)   return <div style={{color:"crimson"}}>Failed to load predictions.json: {String(error.message || error)}</div>;

  return (
    <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12}}>
      <Card title="Total Sessions" value={total} />
      <Card title="Predicted PASS" value={passCount} />
      <Card title="Predicted FAIL" value={failCount} />
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div style={{border:"1px solid #eee", borderRadius:8, padding:12}}>
      <GoToDashboardButton />
      <div style={{fontSize:12, color:"#666"}}>{title}</div>
      <div style={{fontSize:24, fontWeight:600}}>{value}</div>
    </div>
  );
}
