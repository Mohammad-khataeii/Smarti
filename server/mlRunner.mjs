// mlRunner.mjs (ESM)
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import os from "os";

const ROOT = process.env.PREDICTIONS_ROOT || "./predictions";
const RUN_INDEX = path.join(ROOT, "ml_runs.json");

let _isRunning = false; // simple lock

function nowIso() { return new Date().toISOString(); }
function tsId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
async function ensureDir(p) { await fsp.mkdir(p, { recursive: true }); }

async function appendRunIndex(meta) {
  await ensureDir(path.dirname(RUN_INDEX));
  let arr = [];
  try {
    const raw = await fsp.readFile(RUN_INDEX, "utf-8");
    arr = JSON.parse(raw);
  } catch { /* first time */ }
  arr.unshift(meta); // newest first
  await fsp.writeFile(RUN_INDEX, JSON.stringify(arr, null, 2));
}

function spawnLogged(cmd, args, opts, logFile) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(logFile, { flags: "a" });
    const child = spawn(cmd, args, { ...opts, shell: false });

    child.stdout.on("data", (d) => { process.stdout.write(d); out.write(d); });
    child.stderr.on("data", (d) => { process.stderr.write(d); out.write(d); });

    child.on("error", (err) => { out.end(); reject(err); });
    child.on("close", (code) => { out.end(); code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)); });
  });
}

export async function runTrainAndPredict() {
  if (_isRunning) throw new Error("An ML run is already in progress");
  _isRunning = true;

  const python = process.env.PYTHON_BIN || "python";
  const TRAIN = process.env.TRAIN_SCRIPT || "train_random_forest.py";
  const PRED  = process.env.PREDICT_SCRIPT || "predict_random_forest.py";

  const DB = process.env.DB_PATH || path.join(os.homedir(), ".smarti_data", "test_results.db");
  const ART   = process.env.ARTIFACTS_DIR || "./ml_artifacts";
  const SCHEMA = process.env.FEATURES_SCHEMA || path.join(ART, "features_schema.json");

  const runId  = `run-${tsId()}-${randomUUID().slice(0, 8)}`;
  const runDir = path.join(ROOT, runId);
  const logsDir = path.join(runDir, "logs");
  await ensureDir(logsDir);

  const startedAt = nowIso();
  const meta = {
    runId,
    startedAt,
    status: "running",
    dbPath: path.resolve(DB),
    artifactsDir: path.resolve(ART),
    predictionsDir: path.resolve(runDir),
    trainArgs: {
      target: process.env.MODEL_TARGET || "pass_binary",
      bigram_top_k: Number(process.env.BIGRAM_TOP_K || 50)
    },
    predictArgs: {
      cooc_top_k: Number(process.env.COOC_TOP_K || 50),
      bigram_top_k: Number(process.env.BIGRAM_TOP_K_PRED || 100)
    },
    pinned: false
  };

  try {
    // 1) TRAIN
    const trainLog = path.join(logsDir, "train.log");
    const trainArgs = [
      TRAIN, "--db", DB, "--outdir", ART,
      "--target", meta.trainArgs.target,
      "--bigram_top_k", String(meta.trainArgs.bigram_top_k)
    ];
    await spawnLogged(python, trainArgs, { cwd: process.cwd(), env: process.env }, trainLog);

    // 2) PREDICT
    const predictLog = path.join(logsDir, "predict.log");
    const modelPath = path.join(ART, `random_forest_${meta.trainArgs.target}.joblib`);
    const predictArgs = [
      PRED,
      "--db", DB,
      "--model", modelPath,
      "--schema", SCHEMA,
      "--out", runDir,
      "--cooc_top_k", String(meta.predictArgs.cooc_top_k),
      "--bigram_top_k", String(meta.predictArgs.bigram_top_k)
    ];
    await spawnLogged(python, predictArgs, { cwd: process.cwd(), env: process.env }, predictLog);

    // 3) Finalize metadata
    meta.status = "success";
    meta.endedAt = nowIso();
    meta.durationSec = Math.round((new Date(meta.endedAt) - new Date(startedAt)) / 1000);
    meta.logs = {
      train: path.relative(process.cwd(), trainLog),
      predict: path.relative(process.cwd(), predictLog)
    };
    const files = await fsp.readdir(runDir);
    meta.files = files.filter(f => f !== "logs");

    await appendRunIndex(meta);
    return meta;
  } catch (err) {
    meta.status = "error";
    meta.error = String((err && err.message) || err);
    meta.endedAt = nowIso();
    meta.durationSec = Math.round((new Date(meta.endedAt) - new Date(startedAt)) / 1000);
    await appendRunIndex(meta);
    throw err;
  } finally {
    _isRunning = false;
  }
}

// Helpers
export async function listRuns() {
  try {
    const raw = await fsp.readFile(RUN_INDEX, "utf-8");
    return JSON.parse(raw);
  } catch { return []; }
}

export async function listRunFiles(runId) {
  const dir = path.join(ROOT, runId);
  const all = await fsp.readdir(dir);
  return all.filter(f => f !== "logs");
}

export async function getRunFilePath(runId, name) {
  const p = path.join(ROOT, runId, name);
  await fsp.access(p);
  return p;
}

export async function updateRun(runId, patch) {
  const runs = await listRuns();
  const idx = runs.findIndex(r => r.runId === runId);
  if (idx === -1) throw new Error("Run not found");
  runs[idx] = { ...runs[idx], ...patch };
  await fsp.writeFile(RUN_INDEX, JSON.stringify(runs, null, 2));
  return runs[idx];
}
