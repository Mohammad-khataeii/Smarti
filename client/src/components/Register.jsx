import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Register.module.css';

const Register = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('normal');
    const [secretKey, setSecretKey] = useState('');
    const [message, setMessage] = useState('');

    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();

        const userData = {
            username,
            password,
            role,
            secretKey,
        };

        try {
            const response = await fetch('http://localhost:3001/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });

            const result = await response.text();

            if (response.ok) {
                setMessage(`✅ Success: ${result}`);
            } else {
                setMessage(`❌ Error: ${result}`);
            }
        } catch (error) {
            console.error('Error during registration:', error);
            setMessage('❌ Error during registration. Please try again.');
        }
    };

    const handleGoToLogin = () => {
        navigate('/login');
    };

    return (
        <div className={styles.container}>
            <div className={styles.leftSection}>
                <h1 className={styles.title}>Register for Data Analyzer</h1>
                <p className={styles.subtitle}>Create a new account</p>

                <form onSubmit={handleRegister} className={styles.form}>
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

                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            required
                            className={styles.select}
                        >
                            <option value="normal">Normal User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Secret Key</label>
                        <input
                            type="text"
                            value={secretKey}
                            onChange={(e) => setSecretKey(e.target.value)}
                            required
                            placeholder="Enter the secret key"
                            className={styles.input}
                        />
                    </div>

                    <button type="submit" className={styles.submitButton}>
                        Register
                    </button>

                    {message && <p className={styles.message}>{message}</p>}
                </form>

                <button onClick={handleGoToLogin} className={styles.loginRedirectButton}>
                    Go to Login
                </button>
            </div>

            <div className={styles.rightSection}>
                <div className={styles.card}>
                    <h3 className={styles.cardTitle}>ACCESS LEVELS</h3>
                    <p className={styles.cardValue}>Admin & User</p>
                </div>
                <div className={styles.card}>
                    <h3 className={styles.cardTitle}>SECURE SIGNUP</h3>
                    <p className={styles.cardText}>Your data is safe with us</p>
                </div>
            </div>
        </div>
    );
};

export default Register;
