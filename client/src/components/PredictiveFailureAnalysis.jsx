import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import styles from './PredictiveFailureAnalysis.module.css';
import GoToDashboardButton from '../components/GoToDashboardButton';

const PredictiveFailure = () => {
    const [predictiveData, setPredictiveData] = useState([]);
    const [selectedPrimaryStep, setSelectedPrimaryStep] = useState('');
    const [primarySteps, setPrimarySteps] = useState([]);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch primary steps for the dropdown
    useEffect(() => {
        const fetchPrimarySteps = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/distinct-step-numbers');
                setPrimarySteps(response.data);
            } catch (err) {
                console.error('Error fetching primary steps:', err);
                setError('Failed to load primary steps. Please try again later.');
            }
        };

        fetchPrimarySteps();
    }, []);

    // Fetch predictive failure data
    const fetchPredictiveData = async () => {
        if (!selectedPrimaryStep) {
            setError('Please select a primary step.');
            return;
        }
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get('http://localhost:3001/api/predictive-analysis', {
                params: {
                    primaryStep: selectedPrimaryStep,
                    startDate: startDate ? startDate.toISOString().split('T')[0] : null,
                    endDate: endDate ? endDate.toISOString().split('T')[0] : null,
                },
            });

            setPredictiveData(response.data.historicalFailures);
            setPrediction(response.data.prediction);
        } catch (err) {
            console.error('Error fetching predictive failure data:', err);
            setError('Failed to load predictive failure data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const clearFilters = () => {
        setStartDate(null);
        setEndDate(null);
        setSelectedPrimaryStep('');
        setPredictiveData([]);
        setPrediction(null);
        setError(null);
    };

    // Prepare data for the chart
    const chartData = {
        labels: predictiveData.map(item => item.failureDate),
        datasets: [
            {
                label: 'Historical Failures',
                data: predictiveData.map(item => item.failureCount),
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                fill: true,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' },
            tooltip: {
                callbacks: {
                    label: context => `${context.raw}`,
                },
            },
        },
        scales: {
            x: {
                title: { display: true, text: 'Date' },
            },
            y: {
                beginAtZero: true,
                title: { display: true, text: 'Failure Count' },
            },
        },
    };

    return (
        <div className={styles.container}>
            <GoToDashboardButton />
            <h2 className={styles.pageTitle}>Predictive Failure Analysis</h2>
            <p>Select a primary step and optional date range to analyze predictive failure probabilities.</p>

            <div className={styles.dropdownContainer}>
                <label htmlFor="primaryStep">Primary Step:</label>
                <select
                    id="primaryStep"
                    value={selectedPrimaryStep}
                    onChange={(e) => setSelectedPrimaryStep(e.target.value)}
                    className={styles.dropdown}
                >
                    <option value="">Select Step</option>
                    {primarySteps.map((step, idx) => (
                        <option key={idx} value={step}>
                            {step}
                        </option>
                    ))}
                </select>
            </div>

            <div className={styles.datePickerContainer}>
                <label>Date Range:</label>
                <div>
                    <DatePicker
                        selected={startDate}
                        onChange={(date) => setStartDate(date)}
                        dateFormat="yyyy-MM-dd"
                        placeholderText="Start Date"
                        className={styles.datePicker}
                    />
                    <DatePicker
                        selected={endDate}
                        onChange={(date) => setEndDate(date)}
                        dateFormat="yyyy-MM-dd"
                        placeholderText="End Date"
                        className={styles.datePicker}
                    />
                </div>
            </div>

            <div className={styles.exportButtons}>
                <button onClick={fetchPredictiveData} className={styles.applyFilterButton}>
                    Apply Filters
                </button>
                <button onClick={clearFilters} className={styles.resetFilterButton}>
                    Clear Filters
                </button>
            </div>

            {loading && <p>Loading...</p>}
            {error && <p className={styles.errorText}>{error}</p>}

            {/* Display Chart */}
            {!loading && predictiveData.length > 0 && (
                <div className={styles.chartContainer}>
                    <Line data={chartData} options={chartOptions} />
                </div>
            )}

            {/* Display Prediction */}
            {!loading && prediction && (
                <div className={styles.predictionContainer}>
                    <h3>Prediction</h3>
                    <p>
                        Estimated Failures: <strong>{prediction.estimatedFailures}</strong>
                    </p>
                    <p>
                        Prediction Date: <strong>{prediction.predictionDate}</strong>
                    </p>
                </div>
            )}

            {!loading && predictiveData.length === 0 && prediction === null && selectedPrimaryStep && (
                <p>No data available for the selected filters.</p>
            )}
        </div>
    );
};

export default PredictiveFailure;
