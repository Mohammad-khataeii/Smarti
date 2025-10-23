import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './GoToDashboardButton.module.css';

const GoToDashboardButton = () => {
  const navigate = useNavigate();

  const handleRedirect = () => {
    navigate('/dashboard');
  };

  return (
    <button onClick={handleRedirect} className={styles.dashboardButton}>
      🏠 Go to Dashboard
    </button>
  );
};

export default GoToDashboardButton;
