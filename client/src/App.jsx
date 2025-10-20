import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Login from './components/Login';
import Register from './components/Register';
import FileUpload from './components/FileUpload';
import SerialPassFailChart from './components/SerialPassFailChart';
import FileTable from './components/FileTable';
import ParetoChart from './components/ParetoChart';
import UUTStatusSummaryChart from './components/UUTStatusSummaryChart';
import ControlChart from './components/ControlChart';
import RootCausePrediction from './components/RootCausePrediction';
import PredictiveFailureAnalysis from './components/PredictiveFailureAnalysis';
import StepFrequencyChart from './components/StepFrequencyChart';
import NormalDistributionChart from './components/NormalDistributionChart';
import Dashboard from './components/Dashboard'; // Import the Dashboard component
import RootCauseAlarms from './components/RootCauseAlarms';
import LoadingScreen from './components/LoadingScreen'; // Import the LoadingScreen component
import './i18n'; // Import the i18n setup
import 'bootstrap/dist/css/bootstrap.min.css';
import NewControlChart from './components/NewControlChart';
import MlRunDetail from './pages/MlRunDetail'; // Import the MlRunDetail component form './pages/MlRunDetail'

const App = () => {
  // Load initial authentication state from localStorage
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });

  const { i18n } = useTranslation();

  // Function to handle login state change
  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('isAuthenticated', 'true'); // Persist to localStorage
  };

  // Logout function to clear authentication state
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated'); // Clear from localStorage
  };

  // Language toggle function
  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'it' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <Router>
      <Routes>
        {/* Main entry point */}
        <Route 
          path="/" 
          element={isAuthenticated ? <Navigate to="/loading" /> : <Login onLogin={handleLogin} />} 
        />

        {/* Route for Login page */}
        <Route 
          path="/login" 
          element={<Login onLogin={handleLogin} />} 
        />

        {/* Loading route */}
        <Route 
          path="/loading" 
          element={isAuthenticated ? <LoadingScreen /> : <Navigate to="/login" />} 
        />

        {/* After loading, redirect to Dashboard */}
        <Route 
          path="/dashboard" 
          element={
            isAuthenticated 
              ? <Dashboard onLogout={handleLogout} onToggleLanguage={toggleLanguage} /> 
              : <Navigate to="/login" />
          } 
        />

        {/* Other routes */}
        <Route
          path="/predictive-analysis"
          element={isAuthenticated ? <PredictiveFailureAnalysis /> : <Navigate to="/login" />}
        />
        <Route
  path="/ml-run-detail"
  element={isAuthenticated ? <MlRunDetail /> : <Navigate to="/login" />}
/>
<Route
  path="/ml-run-detail/:runId"
  element={isAuthenticated ? <MlRunDetail /> : <Navigate to="/login" />}
/>

        <Route
          path='/root-cause-alarms'
          element={isAuthenticated ? <RootCauseAlarms /> : <Navigate to="/login" />}
          />
        <Route
          path="/new-control-chart"
          element={isAuthenticated ? <NewControlChart /> : <Navigate to="/login" />}
          />
        <Route
          path="/step-frequency"
          element={isAuthenticated ? <StepFrequencyChart /> : <Navigate to="/login" />}
        />
        <Route
          path="/root-cause-prediction"
          element={isAuthenticated ? <RootCausePrediction /> : <Navigate to="/login" />}
        />
        {/* Additional Routes */}
        <Route 
          path="/register" 
          element={<Register />} 
        />
        <Route 
          path="/upload" 
          element={isAuthenticated ? <FileUpload /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/pie-chart" 
          element={isAuthenticated ? <SerialPassFailChart /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/file-table" 
          element={isAuthenticated ? <FileTable /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/pareto-chart" 
          element={isAuthenticated ? <ParetoChart /> : <Navigate to="/login" />} 
        />
        <Route
          path="/normal-distribution"
          element={isAuthenticated ? <NormalDistributionChart /> : <Navigate to="/login" />}
        />
        <Route 
          path="/uut-status-summary" 
          element={isAuthenticated ? <UUTStatusSummaryChart /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/control-chart" 
          element={isAuthenticated ? <ControlChart /> : <Navigate to="/login" />} 
        />

        {/* Catch-all route to redirect any unknown path to the dashboard or login */}
        <Route 
          path="*" 
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} 
        />
      </Routes>
    </Router>
  );
};

export default App;
