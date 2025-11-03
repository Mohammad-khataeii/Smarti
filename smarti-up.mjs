#!/usr/bin/env node
import { spawnSync, spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import open from "open";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------------------------------
// 🔧 Utility helpers
// --------------------------------------------------------
function run(cmd, args, cwd, allowFail = false) {
  console.log(`📦 ${cmd} ${args.join(" ")} (${cwd})`);
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: true });
  if (res.status !== 0 && !allowFail) {
    console.error(`❌ Failed: ${cmd} ${args.join(" ")} (${cwd})`);
    process.exit(res.status);
  }
  return res.status;
}

function killPort(port) {
  try {
    const res = spawnSync("lsof", ["-ti", `:${port}`], { encoding: "utf8" });
    if (res.stdout) {
      res.stdout
        .split("\n")
        .filter(Boolean)
        .forEach((pid) => {
          console.log(`🧨 Killing process on port ${port} (PID: ${pid})`);
          spawnSync("kill", ["-9", pid]);
        });
    }
  } catch {
    console.warn("⚠️ Could not automatically kill port; continuing.");
  }
}

// --------------------------------------------------------
// 1️⃣  CLIENT SETUP & BUILD
// --------------------------------------------------------
const clientPath = path.join(__dirname, "client");
console.log("🚀 Setting up Smarti client...");

// ✅ Install dependencies if missing
if (!fs.existsSync(path.join(clientPath, "node_modules"))) {
  console.log("📦 Installing client dependencies...");
  run("npm", ["install", "--legacy-peer-deps"], clientPath);
} else {
  console.log("✅ Client dependencies already installed.");
}

// ✅ Build client
console.log("🏗️  Building Smarti client...");
let buildStatus = run("npm", ["run", "build"], clientPath);

if (buildStatus !== 0) {
  console.log("🧩 Build failed — attempting AJV compatibility fix...");
  const pkgFile = path.join(clientPath, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
  pkg.resolutions = { ...(pkg.resolutions || {}), ajv: "6.12.6", "ajv-keywords": "3.5.2" };
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2));
  run("npx", ["rimraf", "node_modules", "package-lock.json"], clientPath);
  run("npm", ["install", "--legacy-peer-deps"], clientPath);
  run("npm", ["run", "build"], clientPath);
}

// --------------------------------------------------------
// 2️⃣  SERVER SETUP
// --------------------------------------------------------
const serverPath = path.join(__dirname, "server");
console.log("🚀 Setting up Smarti server...");

if (!fs.existsSync(path.join(serverPath, "node_modules"))) {
  console.log("📦 Installing server dependencies...");
  run("npm", ["install"], serverPath);
} else {
  console.log("✅ Server dependencies already installed.");
}

// --------------------------------------------------------
// 3️⃣  PORT CLEANUP
// --------------------------------------------------------
killPort(3001);

// --------------------------------------------------------
// 4️⃣  LAUNCH BACKEND (web only, no Electron)
// --------------------------------------------------------
process.env.NODE_ENV = "production";
process.env.SILENT = "1";

console.log("🚀 Starting Smarti backend (production mode)...");
const backend = spawn("node", ["server/server.mjs"], {
  cwd: __dirname,
  stdio: "inherit",
  shell: true,
});

// --------------------------------------------------------
// 5️⃣  WAIT FOR SERVER & OPEN DASHBOARD
// --------------------------------------------------------
async function waitForServerAndOpen(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log("🌐 Smarti backend is live! Opening dashboard...");
        await open(url);
        return;
      }
    } catch {
      /* still starting */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error("⚠️ Server did not respond in time. Open manually:", url);
}

waitForServerAndOpen("http://localhost:3001");
