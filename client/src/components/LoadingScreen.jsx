import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';  // For redirection after loading
import styles from './LoadingScreen.module.css';  // Import the CSS module styles

const LoadingScreen = () => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const navigate = useNavigate();  // Initialize the navigate function for redirection

  // List of loading messages
  const messages = [
    "Initializing the analysis engine... Please wait.",
    "Preparing the data for processing... Hang tight!",
    "Loading the necessary models for analysis...",
    "Gathering data insights... This may take a few seconds.",
    "Establishing connections with the analysis database...",
    "Setting up the analysis parameters... Almost ready!",
    "Configuring algorithms for accurate predictions...",
    "Running the preliminary checks... Please hold on.",
    "Initializing machine learning models... Getting everything in place.",
    "Starting the analysis process... This will take just a moment."
];


  useEffect(() => {
    // Change message every 2 seconds (for a total of 10 seconds)
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prevIndex) => (prevIndex + 1) % messages.length);
    }, 3000); // 2000 milliseconds = 3 seconds per message

    // After 10 seconds, redirect to the dashboard
    const redirectTimeout = setTimeout(() => {
      navigate('/dashboard');  // Redirect to the dashboard page
    }, 15000); // 10000 milliseconds = 15 seconds

    // Cleanup the interval and timeout when the component unmounts
    return () => {
      clearInterval(messageInterval);
      clearTimeout(redirectTimeout);
    };
  }, [navigate]);

  return (
    <div className={styles.loadingContainer}>
      <img
        src="/images/Loading.gif" // Path to your uploaded AI GIF
        alt="AI Icon"
        className={styles.aiIcon}
      />
      <p className={styles.loadingMessage}>{messages[currentMessageIndex]}</p>
      
      {/* Footer with GitHub link */}
      <footer className={styles.footer}>
    <p className={styles.footerText}>Designed and Implemented by Mohammad Khataei, Find me on </p>
    <div>
        <a
            href="https://github.com/Mohammad-khataeii"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.githubLink}
        >
            GitHub
        </a>
        <span className={styles.orText}> or </span>
        <a
            href="https://www.linkedin.com/in/seyedmohammad-khataei-pour-3241b0209/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.githubLink}
        >
            on LinkedIn
        </a>
    </div>
</footer>


    </div>
  );
};

export default LoadingScreen;
