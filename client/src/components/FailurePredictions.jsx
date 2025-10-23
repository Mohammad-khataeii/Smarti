// StepFailurePrediction.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import GoToDashboardButton from '../components/GoToDashboardButton';

const StepFailurePrediction = () => {
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPredictions = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/step-failure-predictions');
                setPredictions(response.data);
            } catch (err) {
                console.error('Error fetching predictions:', err);
                setError('Failed to load predictions. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchPredictions();
    }, []);

    if (loading) return <p>Loading...</p>;
    if (error) return <p>{error}</p>;

    return (
        <div>
            <h2>Step Failure Predictions</h2>
            <GoToDashboardButton />
            <table>
                <thead>
                    <tr>
                        <th>Step Number</th>
                        <th>Failure Probability (%)</th>
                    </tr>
                </thead>
                <tbody>
                    {predictions.map((prediction, index) => (
                        <tr key={index}>
                            <td>{prediction.stepNumber}</td>
                            <td>{prediction.probability}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default StepFailurePrediction;
