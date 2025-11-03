// server.mjs
import express from "express";
import cors from "cors";
import session from "express-session";
import SQLiteStoreFactory from "connect-sqlite3";
import passport from "./passport-setup.js";
import "dotenv/config";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

// ============================================================
// 🔇 Silent mode for production
// ============================================================
const SILENT = process.env.SILENT === "1" || process.env.NODE_ENV === "production";
if (SILENT) {
  console.log = console.info = console.debug = console.warn = console.trace = () => {};
}

// ===== Resolve paths =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Utilities =====
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// ===== Writable Data Root & Database =====
// When packaged (e.g., into .exe via nexe), the app itself is read-only.
// Store all persistent data inside the user’s home folder (~/.smarti_data).
const dataRoot = path.join(os.homedir(), ".smarti_data");
ensureDir(dataRoot);

// Define database path
const dbPath = path.join(dataRoot, "test_results.db");

// Copy seed database from /server if missing
if (!fs.existsSync(dbPath)) {
  const seedDb = path.join(__dirname, "test_results.db");
  if (fs.existsSync(seedDb)) {
    fs.copyFileSync(seedDb, dbPath);
    console.log("📦 Copied initial database to:", dbPath);
  } else {
    console.log("🆕 No seed DB found — new one will be created at:", dbPath);
  }
}

// Make DB path available globally
process.env.DB_PATH = dbPath;

// ===== Detect static React build =====
function detectStaticRoot() {
  const clientBuild = path.join(__dirname, "..", "client", "build");
  if (fs.existsSync(path.join(clientBuild, "index.html"))) return clientBuild;
  console.warn("⚠️ No client build found in ../client/build — serving API only.");
  return null;
}

// ============================================================
// 1️⃣ Initialize App
// ============================================================
const app = express();
const SQLiteStore = SQLiteStoreFactory(session);

// ============================================================
// 2️⃣ Middleware
// ============================================================

// ---- CORS setup ----
const CORS_WHITELIST = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  process.env.CORS_ORIGIN || "",
]);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || CORS_WHITELIST.has(origin)) return cb(null, true);
      return cb(null, false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Handle preflight
app.options("*", cors());

// ---- JSON / form parsing ----
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ---- Session store ----
app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: dataRoot,
    }),
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

// ---- Passport ----
app.use(passport.initialize());
app.use(passport.session());

// ============================================================
// 3️⃣ Health & Auth
// ============================================================
app.get("/healthz", (_, res) => res.status(200).json({ ok: true, ts: Date.now() }));

app.get("/check-auth", (req, res) => {
  if (req.session?.user) return res.status(200).json({ authenticated: true, user: req.session.user });
  res.status(401).json({ authenticated: false });
});

// ============================================================
// 4️⃣ Routes
// ============================================================
import uploadRoute from "./uploadRoute.mjs";
import authRoutes from "./authRoutes.mjs";
import fileManagementRoutes from "./fileManagementRoutes.mjs";
import paretoRoute from "./paretoRoute.mjs";
import controlChartRoute from "./controlChartRoute.mjs";
import productionRoute from "./productionRoute.mjs";
import uutStatusSummaryRoute from "./uutStatusSummaryRoute.mjs";
import predictiveAnalysis from "./predictiveAnalysis.mjs";
import rootCauseAlarms from "./root-cause-alarms.mjs";
import rootCausePredictionRoute from "./rootCausePredictionRoute.mjs";
import stepFrequencyRoute from "./stepFrequencyRoute.mjs";
import normalDistributionRoute from "./normalDistributionRoute.mjs";
import mlRoutes from "./routes/ml.mjs";

app.use("/auth", authRoutes);
app.use("/api", uploadRoute);
app.use("/api", fileManagementRoutes);
app.use("/api", paretoRoute);
app.use("/api", uutStatusSummaryRoute);
app.use("/api", controlChartRoute);
app.use("/api", productionRoute);
app.use("/api", predictiveAnalysis);
app.use("/api", rootCausePredictionRoute);
app.use("/api", stepFrequencyRoute);
app.use("/api", normalDistributionRoute);
app.use("/api", rootCauseAlarms);
app.use("/api/ml", mlRoutes);

// ============================================================
// 5️⃣ Serve React build
// ============================================================
const staticRoot = detectStaticRoot();
if (staticRoot) {
  app.use(express.static(staticRoot));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/auth") || req.path.startsWith("/healthz"))
      return next();
    res.sendFile(path.join(staticRoot, "index.html"));
  });
} else if (!SILENT) {
  console.log("ℹ️ No static client build found. Running API-only mode.");
}

// ============================================================
// 6️⃣ Start server
// ============================================================
const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  if (!SILENT) console.log(`✅ Smarti server running on http://localhost:${PORT}`);
});

export default app;
