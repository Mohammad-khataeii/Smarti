// routes/ml.mjs (ESM)
import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import {
  runTrainAndPredict,
  listRuns,
  listRunFiles,
  getRunFilePath,
  updateRun,
} from "../mlRunner.mjs";
import { parse } from "csv-parse/sync";

const router = express.Router();

/**
 * POST /api/ml/run
 * Kick off train -> predict and return the run metadata.
 */
router.post("/run", async (_req, res) => {
  try {
    const meta = await runTrainAndPredict();
    return res.status(200).json({ ok: true, run: meta });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: String((err && err.message) || err) });
  }
});

/**
 * GET /api/ml/runs
 * List all runs (newest first) from predictions/ml_runs.json.
 */
router.get("/runs", async (_req, res) => {
  try {
    const runs = await listRuns();
    return res.json({ ok: true, runs });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: String((err && err.message) || err) });
  }
});

router.get("/run-ids", async (_req, res) => {
  try {
    const runs = await listRuns(); // newest-first
    const out = runs.map((r) => ({
      runId: r.runId,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      pinned: !!r.pinned,
    }));
    return res.json({ ok: true, runs: out });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: String((err && err.message) || err) });
  }
});

/**
 * GET /api/ml/runs/latest
 * Get the latest run's metadata
 */
router.get("/runs/latest", async (_req, res) => {
  try {
    const runs = await listRuns();
    if (!runs.length) {
      return res.status(404).json({ ok: false, error: "No runs" });
    }
    return res.json({ ok: true, run: runs[0] });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: String((err && err.message) || err) });
  }
});

/**
 * GET /api/ml/runs/:runId
 * Get a single run's metadata + file list.
 */
router.get("/runs/:runId", async (req, res) => {
  try {
    const { runId } = req.params;
    const runs = await listRuns();
    const run = runs.find((r) => r.runId === runId);
    if (!run) return res.status(404).json({ ok: false, error: "Run not found" });

    const files = await listRunFiles(runId);
    return res.json({ ok: true, run: { ...run, files } });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: String((err && err.message) || err) });
  }
});

/**
 * GET /api/ml/runs/:runId/files
 * List files in a run (filenames only).
 */
router.get("/runs/:runId/files", async (req, res) => {
  try {
    const files = await listRunFiles(req.params.runId);
    return res.json({ ok: true, files });
  } catch (err) {
    return res
      .status(404)
      .json({ ok: false, error: String((err && err.message) || err) });
  }
});

/**
 * GET /api/ml/runs/:runId/files/:name
 * Stream a specific file (CSV/JSON/log). Safe against path traversal.
 * Use this URL directly from the React app to fetch/parse CSVs for charts.
 */
router.get("/runs/:runId/files/:name", async (req, res) => {
  try {
    const { runId } = req.params;
    const rawName = req.params.name;

    // prevent path traversal
    const safeName = path.basename(rawName);
    if (safeName !== rawName) {
      return res.status(400).json({ ok: false, error: "Invalid filename" });
    }

    const p = await getRunFilePath(runId, safeName);

    // very small content-type helper
    const ext = path.extname(safeName).toLowerCase();
    const type =
      ext === ".csv"
        ? "text/csv"
        : ext === ".json"
        ? "application/json"
        : ext === ".log"
        ? "text/plain"
        : "application/octet-stream";

    res.setHeader("Content-Type", type);
    // inline so the browser (or fetch) can read it directly
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    return res.sendFile(path.resolve(p));
  } catch (err) {
    return res
      .status(404)
      .json({ ok: false, error: String((err && err.message) || err) });
  }
});

/**
 * GET /api/ml/runs/:runId/logs/:kind
 * kind = "train" | "predict"
 * Returns the log text.
 */
router.get("/runs/:runId/logs/:kind", async (req, res) => {
  try {
    const { runId, kind } = req.params;
    const runs = await listRuns();
    const run = runs.find((r) => r.runId === runId);
    if (!run || !run.logs || !run.logs[kind]) {
      return res.status(404).json({ ok: false, error: "Log not found" });
    }
    const p = path.resolve(run.logs[kind]);
    const txt = await fs.readFile(p, "utf-8");
    res.type("text/plain").send(txt);
  } catch (err) {
    return res
      .status(404)
      .json({ ok: false, error: String((err && err.message) || err) });
  }
});

/**
 * PATCH /api/ml/runs/:runId
 * Update run metadata (e.g., pin/unpin).
 * Body: { pinned: boolean }
 */
router.patch("/runs/:runId", async (req, res) => {
  try {
    const { runId } = req.params;
    const { pinned } = req.body ?? {};
    const updated = await updateRun(runId, { pinned: !!pinned });
    return res.json({ ok: true, run: updated });
  } catch (err) {
    return res
      .status(404)
      .json({ ok: false, error: String((err && err.message) || err) });
  }
});

/* ------------------ SUMMARY ENDPOINT ------------------ */
/**
 * GET /api/ml/runs/:runId/summary
 * Optional query: ?threshold=0.6 to treat pred_proba_pass < threshold as FAIL
 * Returns:
 * {
 *   ok: true,
 *   runId,
 *   mode: "label" | "threshold",
 *   threshold?, // present if mode === "threshold"
 *   counts: { total, passCount, failCount }
 * }
 */
async function readPredictionsArray(runId) {
  // Get the path to predictions.csv instead of predictions.json
  const p = await getRunFilePath(runId, "predictions.csv");
  const txt = await fs.readFile(path.resolve(p), "utf-8");

  try {
    // Parse CSV with headers
    const records = parse(txt, { columns: true, skip_empty_lines: true });
    return records; // Each record will be an object: { global_id, pred_label, pred_proba_pass }
  } catch (e) {
    throw new Error(`Failed to parse predictions.csv: ${e.message}`);
  }
}


router.get("/runs/:runId/summary", async (req, res) => {
  try {
    const { runId } = req.params;
    const threshold =
      typeof req.query.threshold !== "undefined"
        ? Number(req.query.threshold)
        : null;

    const preds = await readPredictionsArray(runId);
    const total = preds.length;

    let failCount, passCount, mode;
    if (threshold !== null && !Number.isNaN(threshold)) {
      mode = "threshold";
      failCount = preds.filter(
        (r) => Number(r.pred_proba_pass) < threshold
      ).length;
      passCount = total - failCount;
    } else {
      mode = "label";
      // Our training uses PASS=1, FAIL=0
      failCount = preds.filter((r) => Number(r.pred_label) === 0).length;
      passCount = total - failCount;
    }

    // Log to server console so you can compare with the frontend
    console.log(
      `[ML Summary] runId=${runId} mode=${mode}${
        mode === "threshold" ? `(${threshold})` : ""
      } -> total=${total} pass=${passCount} fail=${failCount}`
    );

    return res.json({
      ok: true,
      runId,
      mode,
      threshold: mode === "threshold" ? threshold : undefined,
      counts: { total, passCount, failCount },
    });
  } catch (err) {
    return res
      .status(404)
      .json({ ok: false, error: String((err && err.message) || err) });
  }
});
/* ------------------------------------------------------ */

// List only the run IDs (plus minimal metadata)
/**
 * GET /api/ml/run-ids
 * List only the run IDs (plus minimal metadata)
 */



export default router;
