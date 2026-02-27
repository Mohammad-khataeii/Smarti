````md
# Smarti

Smarti is a full-stack application composed of:

- **Server**: Node.js + Express (API, auth, ML runner, database)
- **Client**: React (Create React App)
- Optional packaging/build workflows (see CI)

This guide explains how to run Smarti on **Windows** in a clean and reproducible way.

---

# Requirements

- **Node.js 20.x** (required)
- Git
- (Optional) Python if you use ML training/prediction features

> The project is pinned to **Node 20** (see CI and engines field).  
> Do NOT use Node 18 or Node 22 unless you know what you are doing.

---

# 1. Install Node 20 (Windows)

## Option A — Recommended (nvm-windows)

1. Install **nvm-windows**
2. Open PowerShell:

```powershell
nvm install 20
nvm use 20
node -v
````

You should see something like:

```
v20.x.x
```

---

## Option B — Official Installer

Download and install **Node.js 20 LTS** from:
[https://nodejs.org](https://nodejs.org)

Then verify:

```powershell
node -v
```

---

# 2. Clone the Repository

```powershell
git clone <REPO_URL>
cd Smarti
```

---

# 3. Install All Dependencies

From the root of the project:

```powershell
npm run install:all
```

This installs:

* Root dependencies
* Server dependencies
* Client dependencies

---

# 4. Configure Environment Variables (Server)

Create the environment file:

```powershell
copy server\.env.example server\.env
notepad server\.env
```

Edit `server\.env` and set at least:

```
SECRET_KEY=your_long_random_secret_here
```

Other variables are optional and have defaults in the code.

---

# 5. Run the Application

You need **two terminals**.

---

## Terminal 1 — Start the Server

```powershell
npm run dev
```

This runs:

```
nodemon server.mjs
```

The server will start on the configured port (check `.env` or console output).

---

## Terminal 2 — Start the Client (React)

```powershell
npm run client
```

This runs:

```
react-scripts start
```

The React app will open automatically in your browser (usually at `http://localhost:3000`).

---

# Production Mode

## Start server (production mode)

```powershell
npm start
```

## Build client for production

```powershell
npm run build:client
```

This creates an optimized production build inside:

```
client/build
```

---

# Project Structure

```
Smarti/
│
├── server/        # Express backend
│   ├── index.cjs
│   ├── server.mjs
│   ├── .env
│   └── package.json
│
├── client/        # React frontend (CRA)
│   └── package.json
│
├── package.json   # Root orchestrator
├── .nvmrc         # Node version (20)
└── setup.ps1      # Optional Windows setup helper
```

---

# ML Features (Optional)

The server supports optional ML training and prediction features.

Environment variables related to ML:

```
PREDICTIONS_ROOT
PYTHON_BIN
TRAIN_SCRIPT
PREDICT_SCRIPT
DB_PATH
ARTIFACTS_DIR
FEATURES_SCHEMA
MODEL_TARGET
BIGRAM_TOP_K
COOC_TOP_K
BIGRAM_TOP_K_PRED
```

If not provided, defaults defined in the code are used.

If you use ML features, ensure:

* Python is installed
* Required Python scripts exist
* Correct paths are configured

---

# Common Issues

## 1. Node Version Problems

If you see strange runtime or native module errors:

```powershell
node -v
```

Must be **v20.x.x**.

If not:

```powershell
nvm use 20
```

---

## 2. sqlite3 or bcrypt Install Errors

These are native modules.

If installation fails with `node-gyp` errors:

* Install Visual Studio Build Tools
* Re-run:

```powershell
npm run install:all
```

---

## 3. Port Already in Use

If the server fails to start:

* Change `PORT` in `server\.env`
* Or stop the process using that port

---

# CI / Release

The GitHub workflow builds using:

```
node-version: 20
npm ci
npm run publish
```

Ensure Node 20 is always used when building or packaging.

---

# Quick Start Summary

```powershell
nvm install 20
nvm use 20

git clone <REPO_URL>
cd Smarti

npm run install:all
copy server\.env.example server\.env

# Terminal 1
npm run dev

# Terminal 2
npm run client
```

Smarti should now be running locally.

```

