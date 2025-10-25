import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

// ------------------------------------------------------------
// 1. Resolve __dirname safely (for both node & electron)
// ------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------------------------------------------
// 2. Define source & target paths
// ------------------------------------------------------------
const sourceDbPath = path.resolve(__dirname, 'test_results.db');
const appDataDir = path.resolve(os.homedir(), '.smarti_data');
const targetDbPath = path.resolve(appDataDir, 'test_results.db');

// ------------------------------------------------------------
// 3. Log paths for debugging
// ------------------------------------------------------------
console.log('🧭 DB source path  :', sourceDbPath);
console.log('🧭 DB target path  :', targetDbPath);
console.log('🧭 AppData exists? :', fs.existsSync(appDataDir));

// ------------------------------------------------------------
// 4. Ensure the appData directory exists and is writable
// ------------------------------------------------------------
try {
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
    console.log('📁 Created app data directory at', appDataDir);
  }
} catch (err) {
  console.error('❌ Cannot create writable directory:', err);
}

// ------------------------------------------------------------
// 5. Copy template DB or create a blank one if missing
// ------------------------------------------------------------
if (!fs.existsSync(targetDbPath)) {
  try {
    if (fs.existsSync(sourceDbPath)) {
      console.log(`📂 Copying DB template → ${targetDbPath}`);
      fs.copyFileSync(sourceDbPath, targetDbPath);
    } else {
      console.warn('⚠️ No template DB found; creating empty file.');
      fs.writeFileSync(targetDbPath, '');
    }
  } catch (err) {
    console.error('❌ Failed to prepare DB file:', err);
  }
}

// ------------------------------------------------------------
// 6. Connect to SQLite (auto-create if missing)
// ------------------------------------------------------------
const db = new sqlite3.Database(
  targetDbPath,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error('❌ Failed to open/create DB:', err.message);
    } else {
      console.log('✅ Connected to SQLite database at', targetDbPath);
    }
  }
);

// ------------------------------------------------------------
// 7. Runtime error listener (helps debugging queries)
// ------------------------------------------------------------
db.on('error', (err) => {
  console.error('🧨 SQLite runtime error:', err);
  console.trace();
});

// ------------------------------------------------------------
// 8. Export the single shared DB connection
// ------------------------------------------------------------
export default db;
