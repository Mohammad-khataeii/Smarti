import { app, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// 🪄 ESM fix: define __dirname manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverProcess;

function startServer() {
  const serverPath = path.join(__dirname, 'server', 'index.mjs');
  console.log('Starting backend server:', serverPath);

  serverProcess = spawn('node', [serverPath], { stdio: 'inherit' });

  serverProcess.on('close', (code) => {
    console.log(`Server exited with code ${code}`);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  // Load your React app
  win.loadURL('http://localhost:3001');
  // OR: win.loadFile(path.join(__dirname, 'client', 'build', 'index.html'));

  // 🧩 Set default zoom factor (80%)
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(0.8);
  });

  // Optional: open dev tools for debugging
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  startServer();
  // Give backend a moment to start, then open window
  setTimeout(createWindow, 1000);
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') app.quit();
});
