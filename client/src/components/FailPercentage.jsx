import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import styles from './StepFrequencyFailureChart.module.css';
import GoToDashboardButton from '../components/GoToDashboardButton';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const StepFrequencyFailureChart = () => {
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStepFrequencyData = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/step-frequency-failure');
                const data = response.data;

                // Process data for chart
                const labels = data.map(item => `Step ${item.stepNumber}`);
                const totalFrequencyData = data.map(item => item.totalFrequency);
                const failCountData = data.map(item => item.failCount);

                setChartData({
                    labels,
                    datasets: [
                        {
                            label: 'Total Frequency',
                            data: totalFrequencyData,
                            backgroundColor: 'rgba(75, 192, 192, 0.6)', // Green for total frequency
                        },
                        {
                            label: 'Fail Count',
                            data: failCountData,
                            backgroundColor: 'rgba(255, 99, 132, 0.6)', // Red for failures
                        },
                    ],
                });
            } catch (err) {
                console.error('Error fetching step frequency data:', err);
                setError('Failed to load data. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchStepFrequencyData();
    }, []);

    if (loading) return <p>Loading...</p>;
    if (error) return <p>{error}</p>;

    return (
        <div className={styles.chartContainer}>
            <GoToDashboardButton />
            <h2>Step Frequency and Failure Count</h2>
            <Bar
                data={chartData}
                options={{
                    responsive: true,
                    plugins: {
                        legend: { position: 'top' },
                        title: {
                            display: true,
                            text: 'Total Frequency and Fail Count per Step (Descending)',
                        },
                    },
                    scales: {
                        x: {
                            title: { display: true, text: 'Step Number' },
                        },
                        y: {
                            title: { display: true, text: 'Count' },
                        },
                    },
                }}
            />
        </div>
    );
};

export default StepFrequencyFailureChart;