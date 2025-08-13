import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Pie, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title
} from 'chart.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Dashboard.css';
import PassFailTrend from './PassFailTrend';

ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title
);

const Dashboard = () => {
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());
    const [passPercentage, setPassPercentage] = useState(0);
    const [failPercentage, setFailPercentage] = useState(0);
    const [passCount, setPassCount] = useState(0);
    const [failCount, setFailCount] = useState(0);
    const [testFails, setTestFails] = useState([]);
    const chartRef = useRef(null);
    const [troubleshootingSuggestions, setTroubleshootingSuggestions] = useState([]);
    const [error, setError] = useState(null);
    const [troubleshootingTips, setTroubleshootingTips] = useState([]);
    const [uniqueSerialCount, setUniqueSerialCount] = useState(0);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    useEffect(() => {
        const fetchPassFailCounts = async () => {
            try {
                const response = await axios.get('http://localhost:5001/api/pass-fail-percentage');
                setPassCount(response.data.passCount);
                setFailCount(response.data.failCount);
            } catch (err) {
                console.error('Error fetching pass/fail counts:', err);
            }
        };

        fetchPassFailCounts();
    }, []);

    useEffect(() => {
        const fetchTroubleshootingTips = async () => {
            try {
                const response = await axios.get('http://localhost:5001/api/troubleshooting-tips');
                setTroubleshootingTips(response.data);
            } catch (err) {
                console.error('Error fetching troubleshooting tips:', err);
            }
        };
    
        fetchTroubleshootingTips();
    }, []);

    useEffect(() => {
        const fetchUniqueSerialCount = async () => {
            try {
                const response = await axios.get('http://localhost:5001/api/unique-serial-count');
                setUniqueSerialCount(response.data.uniqueSerialCount);
            } catch (err) {
                console.error("Error fetching unique serial count:", err);
                setError(err.message);
            }
        };

        fetchUniqueSerialCount();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchPassFailPercentage = async () => {
            try {
                const response = await axios.get('http://localhost:5001/api/pass-fail-percentage');
                setPassPercentage(response.data.passPercentage);
                setFailPercentage(response.data.failPercentage);
            } catch (err) {
                console.error('Error fetching pass/fail percentages:', err);
            }
        };

        const fetchMostFailingTests = async () => {
            try {
                const response = await axios.get('http://localhost:5001/api/most-fail-tests');
                setTestFails(response.data);
            } catch (err) {
                console.error('Error fetching most failing tests:', err);
            }
        };

        fetchPassFailPercentage();
        fetchMostFailingTests();
    }, []);

    useEffect(() => {
        const suggestions = [];

        const topFailingTest = testFails.length > 0 ? testFails[0] : null;
        if (topFailingTest && topFailingTest.percentage > 20) {
            suggestions.push(
                `Consider investigating "${topFailingTest.testName}" as it has a high fail rate of ${topFailingTest.percentage.toFixed(2)}%.`
            );
        }

        if (passPercentage < 70) {
            suggestions.push(
                "Overall pass rate is below 70%. Review testing procedures and configurations."
            );
        }

        const highFailTests = testFails.filter(test => test.percentage > 20);
        if (highFailTests.length > 1) {
            suggestions.push(
                `Multiple tests (${highFailTests.map(test => test.testName).join(', ')}) have high failure rates. Prioritize these for troubleshooting.`
            );
        }

        setTroubleshootingSuggestions(suggestions);
    }, [passPercentage, testFails]);

    const passFailChartData = {
        labels: ['Pass', 'Fail'],
        datasets: [
            {
                data: [passCount, failCount],
                backgroundColor: ['#4caf50', '#ff4d4d'],
                hoverBackgroundColor: ['#66bb6a', '#ff6b6b'],
            },
        ],
    };

    const paretoChartData = {
        labels: testFails.map(test => test.testName),
        datasets: [
            {
                label: 'Fail Count',
                data: testFails.map(test => test.failCount),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                yAxisID: 'y',
                type: 'bar',
            },
            {
                label: 'Cumulative Fail Count',
                data: testFails.map(test => test.cumulativePercentage),
                type: 'line',
                fill: false,
                borderColor: 'rgba(54, 162, 235, 0.8)',
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                yAxisID: 'y1',
                tension: 0.4,
            },
        ],
    };
    

    return (
        <div className="container-fluid">
            <div className="row">
                <button onClick={toggleSidebar} className="sidebar-toggle">
                    <div className="hamburger-icon"></div>
                </button>

                {/* Sidebar */}
                <div className={`dashboard-sidebar ${isSidebarOpen ? '' : 'closed'}`}>
                    <div className="sidebar-menu">
                        <button onClick={() => navigate('/dashboard')} className="menu-item active">Dashboard</button>
                        <button onClick={() => navigate('/file-upload')} className="menu-item">File Upload</button>
                        <button onClick={() => navigate('/files')} className="menu-item">View All Files</button>
                        <button onClick={() => navigate('/most-failing-tests')} className="menu-item">Most Failing Tests</button>
                        <button onClick={() => navigate('/test-summary')} className="menu-item">Test Summary</button>
                        <button onClick={() => navigate('/most-fails-table')} className="menu-item">Most Fails Table</button>
                        <button onClick={() => navigate('/dashboard-table')} className="menu-item">Dashboard Table</button>
                        <button onClick={() => navigate('/pass-fail-percentage')} className="menu-item">Pass/Fail Percentage</button>
                        <button onClick={() => navigate('/control-chart')} className="menu-item">Control Chart</button>
                    </div>
                </div>

                {/* Main content */}
                <div className={`col ${isSidebarOpen ? 'dashboard-content' : 'dashboard-content expanded'}`}>
                    <div className="date-time-container">
                        <h2 className="date-time">{currentDateTime.toLocaleDateString()} - {currentDateTime.toLocaleTimeString()}</h2>
                        <h2 className="dashboard-heading">Dashboard Overview</h2>
                        <div className="system-health">
                            <span className="health-indicator"></span>
                            <span className="health-status">No errors in system</span>
                        </div>
                    </div>
                    
                    <div className="dashboard-charts">
                        <div className="chart-container overall-section">
                        <h3>Overall Pass/Fail Counts</h3>
            <div className="small-chart-wrapper">
                <Pie data={passFailChartData} options={{ responsive: true }} />
            </div>

            {/* Display pass and fail counts */}
            <div className="count-details">
                <p>Pass Count: {passCount}</p>
                <p>Fail Count: {failCount}</p>
            </div>
                        </div>

                        <div className="chart-container most-fails-section">
                            <h3>Most Fails Pareto Chart</h3>
                            <div className="large-chart-wrapper">
                                <Bar
                                    ref={chartRef}
                                    data={paretoChartData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        scales: {
                                            y: {
                                                beginAtZero: true,
                                                title: { display: true, text: 'Fail Count' },
                                            },
                                            y1: {
                                                beginAtZero: true,
                                                position: 'right',
                                                grid: { drawOnChartArea: false },
                                                title: { display: true, text: 'Cumulative Percentage' },
                                            },
                                        },
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                    

                    <div className="dashboard-stats">
                        <div className="stat-card">
                            <h3>Total Production</h3>
                            <p>{uniqueSerialCount} pcs.</p>
                        </div>
                        <div className="stat-card">
                            <h3>Tests</h3>
                            <p>tests</p>
                        </div>
                        <div className="stat-card">
                            <h3>Troubleshooting</h3>
                            <ul className="troubleshooting-list">
                                {troubleshootingTips.map((tip, index) => (
                                    <li key={index} className="troubleshooting-item">
                                        <p><strong>{tip.testName}</strong> - Fail Rate: {tip.failRate}</p>
                                        <p>{tip.suggestion}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {error && <p className="error-message">Error: {error}</p>}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
