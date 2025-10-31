#!/usr/bin/env node
import { spawnSync, spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import open from "open"; // <-- auto open browser
import fetch from "node-fetch"; // to wait until backend is live

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run(cmd, args, cwd) {
  console.log(`📦 ${cmd} ${args.join(" ")} (${cwd})`);
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: true });
  if (res.status !== 0) {
    console.error(`❌ Failed: ${cmd} ${args.join(" ")} (${cwd})`);
    process.exit(res.status);
  }
}

// 🧹 Kill anything already using a port (Mac/Linux)
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
    // ignore errors
  }
}

// --------------------------------------------------------
// 1️⃣ Install & Build Client
// --------------------------------------------------------
const clientPath = path.join(__dirname, "client");
console.log("🚀 Setting up Smarti client...");

if (!fs.existsSync(path.join(clientPath, "node_modules"))) {
  if (fs.existsSync(path.join(clientPath, "package-lock.json"))) {
    const res = spawnSync("npm", ["ci", "--legacy-peer-deps", "--silent"], {
      cwd: clientPath,
      stdio: "inherit",
      shell: true,
    });
    if (res.status !== 0) {
      console.log("⚠️  npm ci failed, falling back to npm install --legacy-peer-deps");
      run("npm", ["install", "--legacy-peer-deps", "--silent"], clientPath);
    }
  } else {
    run("npm", ["install", "--legacy-peer-deps", "--silent"], clientPath);
  }
} else {
  console.log("✅ Client dependencies already installed, skipping npm install.");
}

run("npm", ["run", "build", "--silent"], clientPath);

// --------------------------------------------------------
// 2️⃣ Install Server
// --------------------------------------------------------
const serverPath = path.join(__dirname, "server");
console.log("🚀 Setting up Smarti server...");

if (!fs.existsSync(path.join(serverPath, "node_modules"))) {
  if (fs.existsSync(path.join(serverPath, "package-lock.json"))) {
    const res = spawnSync("npm", ["ci", "--silent"], {
      cwd: serverPath,
      stdio: "inherit",
      shell: true,
    });
    if (res.status !== 0) {
      console.log("⚠️  npm ci failed, falling back to npm install");
      run("npm", ["install", "--silent"], serverPath);
    }
  } else {
    run("npm", ["install", "--silent"], serverPath);
  }
} else {
  console.log("✅ Server dependencies already installed, skipping npm install.");
}

// --------------------------------------------------------
// 3️⃣ Kill port 3001 if busy
// --------------------------------------------------------
killPort(3001);

// --------------------------------------------------------
// 4️⃣ Launch backend silently + open browser
// --------------------------------------------------------
process.env.NODE_ENV = "production";
process.env.SILENT = "1";

console.log("🚀 Starting Smarti backend (production mode)...");

// start backend in background
const backend = spawn("node", ["server/server.mjs"], {
  cwd: __dirname,
  stdio: "inherit",
  shell: true,
});

// --------------------------------------------------------
// 5️⃣ Wait for backend to become reachable, then open browser
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
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error("⚠️ Server did not respond in time. Please open manually:", url);
}

waitForServerAndOpen("http://localhost:3001");
