import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; // npm install node-fetch
import pkg from 'electron-updater';
const { autoUpdater } = pkg;


// --- Path setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverProcess;
let mainWindow;

// --- Start backend (server/server.mjs) ---
function startBackend() {
  const serverPath = path.join(__dirname, 'server', 'server.mjs');
  console.log('🚀 Starting backend:', serverPath);

  serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    cwd: path.join(__dirname, 'server'), // ensure working dir = /server
  });

  serverProcess.on('close', (code) => {
    console.log(`🛑 Backend stopped with code ${code}`);
  });
}

// --- Wait for backend to be reachable ---
async function waitForBackend(url, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('❌ Backend did not start in time');
}

// --- Create Electron window ---
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.removeMenu();
  mainWindow.center();

  // 🧭 React build location
  const frontendPath = path.join(__dirname, 'client', 'build', 'index.html');
  const backendUrl = 'http://localhost:3001';

  // Clear cached assets
  await mainWindow.webContents.session.clearCache();

  // Load the local React build
  console.log('🧭 Loading frontend from:', frontendPath);
  mainWindow.loadFile(frontendPath);

  // Optional: Wait for backend availability before API calls
  waitForBackend(backendUrl)
    .then(() => console.log('✅ Backend ready on 3001'))
    .catch(() => console.error('⚠️ Backend not responding in time'));

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(0.8);
  });
}

// --- Auto-updater setup ---
function setupAutoUpdater() {
  autoUpdater.autoDownload = true; // downloads automatically
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('⬇️ Update available:', info.version);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available. It will download in the background.`,
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('✅ No new update found');
    dialog.showMessageBox({
      type: 'info',
      title: 'Up to Date',
      message: 'Smarti is already on the latest version.',
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('❌ Update error:', err);
    dialog.showMessageBox({
      type: 'error',
      title: 'Update Error',
      message: 'An error occurred while checking for updates.',
      detail: err == null ? '' : err.toString(),
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded:', info.version);
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version has been downloaded. Restart Smarti to install now?',
        buttons: ['Restart', 'Later'],
      })
      .then((result) => {
        if (result.response === 0) autoUpdater.quitAndInstall();
      });
  });
}

// --- IPC handler for manual “Check for Updates” button ---
ipcMain.on('check-for-updates', () => {
  console.log('🖱️ Manual update check triggered');
  autoUpdater.checkForUpdatesAndNotify();
});

// --- Electron app lifecycle ---
app.whenReady().then(async () => {
  startBackend();
  await createWindow();

  setupAutoUpdater();
  autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) await createWindow();
});
