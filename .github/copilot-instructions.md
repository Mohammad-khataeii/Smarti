# AI Agent Instructions for Smarti Project

## Architecture Overview

Smarti is a full-stack application for industrial test data analysis with machine learning capabilities:

- **Frontend** (`/client`): React application with:
  - Authentication flow (`/components/Login.jsx`, `/components/Register.jsx`)
  - Data visualization with Chart.js (`/components/Dashboard.jsx`)
  - i18n support (`/src/i18n.js`, locales in `/src/locales/`)
  - ML model interaction (`/pages/MlRunDetail.jsx`)

- **Backend** (`/server`): Node.js/Express server with:
  - SQLite database for user data and test results (`~/.smarti_data/test_results.db`)
  - Python ML pipeline for random forest model (`train_random_forest.py`, `predict_random_forest.py`)
  - Authentication with Passport.js (`auth.mjs`, `passport-setup.js`)
  - REST APIs for data analysis (`controlChartRoute.mjs`, `normalDistributionRoute.mjs`, etc.)

## Key Development Workflows

1. **Setup & Running**:
   ```bash
   # Backend
   cd server
   npm install
   npm run dev  # Runs on port 3001

   # Frontend
   cd client
   npm install
   npm start    # Runs on port 3000
   ```

2. **ML Pipeline**:
   - Models are trained and run via `/api/ml/run` endpoint
   - Results stored in `/predictions` with unique run IDs
   - Check `mlRunner.mjs` for environment variables configuration

3. **Authentication**:
   - Uses session-based auth with SQLite store
   - Protected routes require valid session
   - Role-based access (`normal` vs `admin` users)

## Project Conventions

1. **File Structure**:
   - Route handlers in separate files with `.mjs` extension
   - React components follow feature-based organization
   - ML artifacts stored in versioned run directories

2. **API Patterns**:
   - All routes prefixed with `/api`
   - Consistent response format: `{ ok: boolean, data/error: any }`
   - ML endpoints under `/api/ml/*`

3. **Error Handling**:
   - Backend uses try-catch with specific status codes
   - Frontend shows user-friendly error messages via toasts/modals

## Integration Points

1. **ML Model Integration**:
   - Python scripts communicate via JSON files
   - Results stored in timestamped directories
   - Frontend fetches and visualizes results via `/api/ml/runs/:runId/files/*`

2. **Database**:
   - SQLite schema defined in `uploadRoute.mjs`
   - Tables: users, global_metadata, test_data, ucl_lcl_calculations

3. **External Services**:
   - i18n translations (English/Italian)
   - Static file serving from `/public`

## Common Tasks

1. **Adding New Routes**:
   - Create route file in `/server`
   - Import and attach in `server.mjs`
   - Update frontend API client

2. **ML Model Updates**:
   - Modify Python scripts in `/server`
   - Update schema in `ml_artifacts/features_schema.json`
   - Regenerate predictions via API

3. **Authentication Changes**:
   - Update auth routes in `authRoutes.mjs`
   - Modify session handling in `server.mjs`
   - Update protected route logic in frontend

Remember to handle both development (localhost:3000/3001) and production (single server) environments appropriately.