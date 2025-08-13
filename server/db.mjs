import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbPath = path.join(__dirname, 'test_results.db');

// If running inside pkg (packaged .exe)
if (process.pkg) {
    const destDir = path.join(os.homedir(), '.myapp'); // writable folder in home
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir);
    }

    const destPath = path.join(destDir, 'test_results.db');

    // Copy DB if it doesn't exist yet
    if (!fs.existsSync(destPath)) {
        fs.copyFileSync(path.join(path.dirname(process.execPath), 'test_results.db'), destPath);
    }

    dbPath = destPath;
}

// Enable verbose mode for SQLite
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database at', dbPath);
    }
});

// Export the db instance
export default db;
