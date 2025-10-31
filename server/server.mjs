// server.mjs
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import SQLiteStoreFactory from 'connect-sqlite3';
import passport from './passport-setup.js';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';


// ============================================================
// 🔇 Silent mode for production
// ============================================================
const SILENT = process.env.SILENT === "1" || process.env.NODE_ENV === "production";
if (SILENT) {
  console.log = console.info = console.debug = console.warn = console.trace = () => {};
}

// ===== Utility to get __dirname in ESM =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// ===== Initialize App =====
const app = express();
const SQLiteStore = SQLiteStoreFactory(session);

// ===== Middleware =====
app.use(cors({
  origin: 'http://localhost:3000', // Your React dev server
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Ensure preflight requests are handled
app.options('*', cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// ===== Session Setup =====
app.use(session({
  store: new SQLiteStore({
  db: 'sessions.db',
  dir: path.join(os.homedir(), '.smarti_data')
  }),
  secret: process.env.SESSION_SECRET || 'default_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// ===== Passport Auth =====
app.use(passport.initialize());
app.use(passport.session());

// ===== Routes =====
import uploadRoute from './uploadRoute.mjs';
import authRoutes from './authRoutes.mjs';
import fileManagementRoutes from './fileManagementRoutes.mjs';
import paretoRoute from './paretoRoute.mjs';
import controlChartRoute from './controlChartRoute.mjs';
import productionRoute from './productionRoute.mjs';
import uutStatusSummaryRoute from './uutStatusSummaryRoute.mjs';
import predictiveAnalysis from './predictiveAnalysis.mjs';
import rootCauseAlarms from './root-cause-alarms.mjs';
import rootCausePredictionRoute from './rootCausePredictionRoute.mjs';
import stepFrequencyRoute from './stepFrequencyRoute.mjs';
import normalDistributionRoute from './normalDistributionRoute.mjs';
import mlRoutes from "./routes/ml.mjs";

//  protected route
app.get('/check-auth', (req, res) => {
  if (req.session.user) {
    return res.status(200).json({ authenticated: true, user: req.session.user });
  }
  res.status(401).json({ authenticated: false });
});

// Attach routes
app.use('/auth', authRoutes);
app.use('/api', uploadRoute);
app.use('/api', fileManagementRoutes);
app.use('/api', paretoRoute);
app.use('/api', uutStatusSummaryRoute);
app.use('/api', controlChartRoute);
app.use('/api', productionRoute);
app.use('/api', predictiveAnalysis);
app.use('/api', rootCausePredictionRoute);
app.use('/api', stepFrequencyRoute);
app.use('/api', normalDistributionRoute);
app.use('/api', rootCauseAlarms);
app.use("/api/ml", mlRoutes);

// ===== Serve React build =====
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== Start Server =====
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  if (!SILENT) console.log(`✅ Server running on http://localhost:${PORT}`);
});

