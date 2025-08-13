import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Login.module.css';

const Login = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:3001/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: password,
                }),
            });

            if (!response.ok) {
                throw new Error('Login failed');
            }

            const data = await response.json();
            console.log('Login successful:', data);

            onLogin(); // Call onLogin prop to update authentication state
            navigate('/dashboard'); // Redirect to the dashboard
        } catch (error) {
            console.error('Login error:', error);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.leftSection}>
                <h1 className={styles.title}>Data Analyzer by BRAKELYSTS</h1>
                <p className={styles.subtitle}>Sign in to your account</p>
                <form onSubmit={handleLogin} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            placeholder="Enter your username"
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Enter your password"
                            className={styles.input}
                        />
                    </div>
                    <button type="submit" className={styles.submitButton}>Login</button>
                    <p className={styles.registerLink}>
                        Don’t have an account? <span onClick={() => navigate('/register')} className={styles.link}>Create one here</span>
                    </p>
                </form>
            </div>
            <div className={styles.rightSection}>
                <div className={styles.card}>
                    <h3 className={styles.cardTitle}>Unlock Insights</h3>
                    <p className={styles.cardValue}>Data-Driven Precision</p>
                    <p className={styles.cardText}>
                        Make confident, data-backed decisions with instant access to deep analytics. 
                        Transform raw data into actionable insights and stay ahead of your competition.
                    </p>
                </div>
                <div className={styles.card}>
                    <h3 className={styles.cardTitle}>Elevate Performance</h3>
                    <p className={styles.cardValue}>+ Efficiency, + Profit</p>
                    <p className={styles.cardText}>
                        Our system analyzes and optimizes, saving you time and resources. 
                        Focus on what matters most while we handle the details.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
