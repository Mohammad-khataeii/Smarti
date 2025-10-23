import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

// ---------------------
// 1. Resolve __dirname
// ---------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------
// 2. Define source & target paths
// ---------------------
const sourceDbPath = path.join(__dirname, 'test_results.db');
const appDataDir = path.join(os.homedir(), '.smarti_data');

if (!fs.existsSync(appDataDir)) {
  fs.mkdirSync(appDataDir, { recursive: true });
}

const targetDbPath = path.join(appDataDir, 'test_results.db');

// ---------------------
// 3. Copy DB file if needed
// ---------------------
if (!fs.existsSync(targetDbPath)) {
  console.log(`📂 Copying database to writable location: ${targetDbPath}`);
  try {
    fs.copyFileSync(sourceDbPath, targetDbPath);
  } catch (err) {
    console.error('❌ Failed to copy database file:', err);
  }
}

// ---------------------
// 4. Connect to SQLite
// ---------------------
const db = new sqlite3.Database(targetDbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to database:', err);
  } else {
    console.log('✅ Connected to SQLite database at', targetDbPath);
  }
});

// ---------------------
// 5. Debugging errors at runtime
// ---------------------
db.on('error', (err) => {
  console.error('🧨 SQLite runtime error:', err);
  console.trace(); // <== shows which file/line triggered the error
});

// ---------------------
// 6. Export the single shared DB connection
// ---------------------
export default db;
