import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import styles from './Dashboard.module.css';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import Modal from 'react-modal';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";  // To include the default styles
import MlRunDetail from '../pages/MlRunDetail';
Modal.setAppElement('#root');

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);


const Dashboard = ({ onLogout }) => {
    const navigate = useNavigate();
    const { i18n, t } = useTranslation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());
    const [uniqueSerialCount, setUniqueSerialCount] = useState(0);
    const [language, setLanguage] = useState(i18n.language);
    const [pieChartData, setPieChartData] = useState(null);
    const [paretoChartData, setParetoChartData] = useState(null);
    const [timeFilter, setTimeFilter] = useState('monthly'); // Default to 'monthly'
    const [totalProduction, setTotalProduction] = useState(0); 
    const [isHelpOpen, setIsHelpOpen] = useState(false); 
    const openHelp = () => setIsHelpOpen(true); 
    const closeHelp = () => setIsHelpOpen(false);

    // 🆕 Update modal state
    

    const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
    const [zoomMessage, setZoomMessage] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [errorMessage, setErrorMessage] = useState(""); // For handling errors
    const [failureRateData, setFailureRateData] = useState([]);
    const [productionGoal, setProductionGoal] = useState(() => {
        const savedGoal = localStorage.getItem('productionGoal');
        return savedGoal ? parseInt(savedGoal, 10) : 50; // Default to 50 if no value is saved
    });
    

    //fetch failure rate chart data
    useEffect(() => {
        const fetchFailureRateData = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/failure-rate-monthly', {
                    params: {
                        startDate: startDate ? startDate.toISOString().split('T')[0] : '',
                        endDate: endDate ? endDate.toISOString().split('T')[0] : '',
                    },
                });
                setFailureRateData(response.data);
            } catch (err) {
                console.error("Error fetching failure rate data:", err);
            }
        };
    
        if (startDate && endDate) {
            fetchFailureRateData();
        }
    }, [startDate, endDate]);
    
    
    useEffect(() => {
        // Function to fetch unique serial count
        const fetchUniqueSerialCount = async (filter) => {
            try {
                const response = await axios.get('http://localhost:3001/api/pareto-failure-analysis', {
                    params: { filter } // Pass the time filter
                });
                setUniqueSerialCount(response.data.uniqueSerialCount || 0);
    
                // Fetch total production with the time filter
                const totalResponse = await axios.get('http://localhost:3001/api/total-production', {
                    params: { filter } // Pass the time filter
                });
                setTotalProduction(totalResponse.data.totalProduction); // Set total production
                
            } catch (err) {
                console.error("Error fetching unique serial count:", err);
            }
        };
    
        // Function to fetch pie chart data
        const fetchPieChartData = async (filter) => {
            try {
                const response = await axios.get('http://localhost:3001/api/uut-status-count', {
                    params: { filter } // Pass the time filter
                });
                setPieChartData(response.data);
            } catch (err) {
                console.error("Error fetching pie chart data:", err);
            }
        };
    
        // Function to fetch pareto chart data
        const fetchParetoChartData = async (filter) => {
            try {
                const response = await axios.get('http://localhost:3001/api/pareto-failure-analysis', {
                    params: { filter } // Pass the time filter
                });
                setParetoChartData(response.data);
            } catch (err) {
                console.error("Error fetching pareto chart data:", err);
            }
        };
    
        // Fetch all data based on the current time filter
        fetchUniqueSerialCount(timeFilter);
        fetchPieChartData(timeFilter);
        fetchParetoChartData(timeFilter);
    
        // Set up a timer for the current date/time
        const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, [timeFilter]); // Run the effect whenever the timeFilter changes
    

    const handleProductionGoalChange = (e) => {
        const newGoal = parseInt(e.target.value, 10);
        if (newGoal > 0) { // Validate the input to ensure it's a positive number
            setProductionGoal(newGoal);
            localStorage.setItem('productionGoal', newGoal);
        }
    };

    const handleTimeFilterChange = (filter) => {
    setTimeFilter(filter); // Update the time filter state
    };


    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const toggleLanguage = (lang) => {
        i18n.changeLanguage(lang);
        setLanguage(lang);
    };

    useEffect(() => {
        const fetchUniqueSerialCount = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/unique-serial-count');
                setUniqueSerialCount(response.data.uniqueSerialCount || 0);
            } catch (err) {
                console.error("Error fetching unique serial count:", err);
            }
        };

        fetchUniqueSerialCount();

        const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

useEffect(() => {
  const detectZoom = () => {
    const zoom = window.devicePixelRatio || 1;

    const messageEN = `
Your screen appears to be zoomed ${zoom > 1 ? 'in' : zoom < 1 ? 'out' : 'normally'}.
If elements look too big or too small:
• On Mac: use Command (+) or Command (−)
• On Windows: use Ctrl (+) or Ctrl (−)
to adjust zoom level.
`;

    const messageIT = `
Lo schermo sembra essere ${zoom > 1 ? 'ingrandito' : zoom < 1 ? 'rimpicciolito' : 'normale'}.
Se gli elementi sembrano troppo grandi o troppo piccoli:
• Su Mac: usa Comando (+) o Comando (−)
• Su Windows: usa Ctrl (+) o Ctrl (−)
per regolare il livello di zoom.
`;

    // Combine both languages
    const combinedMessage = `${messageEN}\n-----------------------------\n${messageIT}`;

    if (zoom !== 1) {
      setZoomMessage(combinedMessage);
      setIsZoomModalOpen(true);
    }
  };

  detectZoom();

  // Optional: listen for zoom changes dynamically
  window.addEventListener('resize', detectZoom);
  return () => window.removeEventListener('resize', detectZoom);
}, []);



    //preparing the fail rate chart data
    // Utility function to fill missing months
    const fillMissingMonths = (data, start, end) => {
        const months = [];
        const startDate = new Date(start);
        const endDate = new Date(end);
    
        // Generate all months between start and end dates
        while (startDate <= endDate) {
            const yearMonth = startDate.toISOString().slice(0, 7); // Format YYYY-MM
            months.push(yearMonth);
            startDate.setMonth(startDate.getMonth() + 1); // Increment by 1 month
        }
    
        // Merge the existing data with the full range of months
        const filteredData = data.filter(item => item.month !== "Unknown"); // Exclude "Unknown"
        const filledData = months.map(month => {
            const found = filteredData.find(item => item.month === month);
            return found || { month, failureRate: "0.00" }; // Default to 0.00 if missing
        });
    
        return filledData;
    };
    
    


console.log('Original Failure Rate Data:', failureRateData);

// Fill missing months
const filledFailureRateData = fillMissingMonths(failureRateData, startDate, endDate);

const failureRateChartData = {
    labels: filledFailureRateData.map(item => {
        const [year, month] = item.month.split('-');
        const date = new Date(year, month - 1); // Convert to Date object
        return date.toLocaleString('default', { month: 'short', year: 'numeric' }); // Format as "MMM YYYY"
    }),
    datasets: [
        {
            label: 'Failure Rate (%)',
            data: filledFailureRateData.map(item => parseFloat(item.failureRate)), // Failure rate values
            borderColor: 'rgba(255, 99, 132, 1)', // Line color
            backgroundColor: 'rgba(255, 99, 132, 0.2)', // Fill color
            fill: true, // Enable area fill under the line
            tension: 0.3, // Smooth curve
        },
    ],
};



    const pieData = pieChartData ? {
        labels: ['Pass(%)', 'Fail(%)'],
        datasets: [
            {
                data: [pieChartData.PASS, pieChartData.FAIL],
                backgroundColor: ['#4CAF50', '#F44336'],
                hoverBackgroundColor: ['#66BB6A', '#E57373'],
            },
        ],
    } : null;
    
    const paretoData = paretoChartData ? {
        labels: paretoChartData.map(item => item.stepNumber),
        datasets: [
            {
                label: 'Fail Count',
                data: paretoChartData.map(item => item.failCount),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                type: 'bar',
            },
            {
                label: 'Cumulative Fail Percentage',
                data: paretoChartData.map(item => item.cumulativePercentage),
                borderColor: 'rgba(54, 162, 235, 0.8)',
                type: 'line',
                fill: false,
            },
        ],
    } : null;

    //useEffect to setDate on the Dashboard Navbar
    useEffect(() => {
        // Calculate the last 12 months' dates
        const calculateLastTwelveMonths = () => {
            const today = new Date();
            const start = new Date(today);
            start.setMonth(today.getMonth() - 12);  // Subtract 12 months from the current date
            setStartDate(start);
            setEndDate(today);  // Set the end date to today
        };

        // Initialize the dates when the component is mounted
        calculateLastTwelveMonths();
    }, []);  // Empty dependency array to run only on mount

    // Function to validate dates
    const isValidDateRange = (start, end) => {
        if (!start || !end) return false; // Check if both dates are set
        if (start > end) return false; // Start date should be before end date
        return true;
    };

    // Apply the filter to fetch data based on selected dates
    const applyDateFilter = async () => {
        try {
            // Check for valid date range
            if (!isValidDateRange(startDate, endDate)) {
                setErrorMessage("Please choose a valid date range."); // Set error message
                return; // Stop further execution if dates are invalid
            }

            const start = startDate ? startDate.toISOString().split('T')[0] : '';
            const end = endDate ? endDate.toISOString().split('T')[0] : '';

            // Fetch Pie Chart Data with the date range
            const fetchPieChartData = async () => {
                try {
                    const response = await axios.get('http://localhost:3001/api/uut-status-count', {
                        params: { startDate: start, endDate: end },
                    });
                    setPieChartData(response.data);
                } catch (err) {
                    console.error("Error fetching pie chart data:", err);
                }
            };

            // Fetch Pareto Chart Data with the date range
            const fetchParetoChartData = async () => {
                try {
                    const response = await axios.get('http://localhost:3001/api/pareto-failure-analysis', {
                        params: { startDate: start, endDate: end },
                    });
                    setParetoChartData(response.data);
                } catch (err) {
                    console.error("Error fetching pareto chart data:", err);
                }
            };

            // Fetch Total Production with the date range
            const fetchTotalProduction = async () => {
                try {
                    const response = await axios.get('http://localhost:3001/api/total-production', {
                        params: { startDate: start, endDate: end },
                    });
                    setTotalProduction(response.data.totalProduction);
                } catch (err) {
                    console.error("Error fetching total production data:", err);
                }
            };

            // Apply filters and update charts and stats
            await fetchPieChartData();
            await fetchParetoChartData();
            await fetchTotalProduction();
        } catch (err) {
            console.error("Error applying date filter:", err);
        }
    };

    // Trigger the filter automatically when the dates are set
    useEffect(() => {
        if (startDate && endDate) {
            applyDateFilter();
        }
    }, [startDate, endDate]);  // Trigger the effect whenever the dates change

    
    
    const progressPercentage = productionGoal > 0 
    ? (totalProduction / productionGoal) * 100 
    : 0;


    return (
        <div className={styles.containerFluid}>
    
            {/* Sidebar */}
            <div className={`${styles.dashboardSidebar} ${isSidebarOpen ? '' : styles.closed} ${styles.sidebarAnimation}`}>
                <div className={styles.sidebarMenu}>
                     

                    {/* Language Toggle */}
                    <div className={styles.languageToggle}>
                        <span 
                            onClick={() => toggleLanguage('en')}
                            className={language === 'en' ? styles.active : ''}
                        >
                            ENGLISH
                        </span>
                        <span> | </span>
                        <span 
                            onClick={() => toggleLanguage('it')}
                            className={language === 'it' ? styles.active : ''}
                        >
                            ITALIAN
                        </span>
                    </div>
    
                    <button onClick={() => navigate('/dashboard')} className={`${styles.menuItem} ${styles.active}`}>{t('Dashboard')}</button>
                    <button onClick={() => navigate('/upload')} className={styles.menuItem}>{t('Upload New Files')}</button>
                    <button onClick={() => navigate('/file-table')} className={styles.menuItem}>{t('View All Files')}</button>
                    <button onClick={() => navigate('/pie-chart')} className={styles.menuItem}>{t('Pie Chart Analysis')}</button>
                    <button onClick={() => navigate('/pareto-chart')} className={styles.menuItem}>{t('Pareto Chart Analysis')}</button>
                    <button onClick={() => navigate('/control-chart')} className={styles.menuItem}>{t('Control Chart Analysis')}</button>
                    <button onClick={() => navigate('/uut-status-summary')} className={styles.menuItem}>{t('UUT Status Summary')}</button>
                    <button onClick={() => navigate('/root-cause-prediction')} className={styles.menuItem}>{t('Root Cause Analyzer')}</button>
                    <button onClick={() => navigate('/step-frequency')} className={styles.menuItem}>{t('Step Frequency Analyzer')}</button>
                    <button onClick={() => navigate('/ml-run-detail')} className={styles.menuItem}>{t('ML Run Detail')}</button>
                    {/* <button onClick={() => navigate('/predictive-analysis')} className={styles.menuItem}>{t('Predictive Analysis')}</button> */}
                    <button onClick={() => navigate('/normal-distribution')} className={styles.menuItem}>{t('Process Capability Report')}</button>
                    <button onClick={onLogout} className={styles.Logout}>{t('Logout')}</button>
                                    
                </div>
            </div>
    
            {/* Main content */}
            <div className={`${styles.col} ${isSidebarOpen ? styles.dashboardContent : styles.expandedDashboardContent} ${styles.contentAnimation}`}>
    {/* Date Time Filter Section */}
    <div className={styles.dateFilterSection}>
    <div className={styles.systemHealthContainer}>
        <div className={styles.systemHealth}>
            <div className={styles.greenLight}></div>
            <p className={styles.systemHealthText}>System Health: <strong>Healthy</strong></p>
        </div>
        <div className={styles.currentDateTime}>
            <p className={styles.systemHealthText}>Current Date & Time: <strong>{new Date().toLocaleString()}</strong></p>
        </div>
    </div>
    <h3 className={styles.dateFilterTitle}>Date Filter:</h3>
    <div className={styles.dateFilterContent}>
        <div className={styles.inlineFilter}>
            <div className={styles.filterItem}>
                <label htmlFor="startDate" className={styles.filterLabel}>Start Date:</label>
                <input
                    id="startDate"
                    type="date"
                    value={startDate ? startDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => setStartDate(new Date(e.target.value))}
                    className={styles.dateInput}
                />
            </div>
            <div className={styles.filterItem}>
                <label htmlFor="endDate" className={styles.filterLabel}>End Date:</label>
                <input
                    id="endDate"
                    type="date"
                    value={endDate ? endDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => setEndDate(new Date(e.target.value))}
                    className={styles.dateInput}
                />
            </div>
            <button onClick={applyDateFilter} className={styles.applyButton}>Apply</button>
        </div>
        <button
            className={styles.alarmButton}
            onClick={() => navigate('/root-cause-alarms')}
            aria-label="Root Cause Alarms"
        >
            🚨 
        </button>
    </div>
    {errorMessage && (
        <div className={styles.errorMessage}>
            <p>{errorMessage}</p>
        </div>
    )}
</div>


    


    {/* Charts Section */}
    <div className={styles.dashboardCharts}>
        <div className={`${styles.chartContainer} ${styles.pieChartContainer} ${styles.chartAnimation}`}>
            <h4>{t('Pie Chart')}</h4>
            {pieData ? (
                <Pie
                    data={pieData}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                    }}
                    width={300}
                    height={300}
                />
            ) : (
                <div className={styles.placeholderContent}>{t('Loading Pie Chart...')}</div>
            )}
        </div>

        <div className={`${styles.chartContainer} ${styles.paretoChartContainer} ${styles.chartAnimation}`}>
            <h3>{t('Pareto Chart Analysis')}</h3>
            {paretoData ? (
                <Bar
                    data={paretoData}
                    options={{
                        scales: {
                            y: { title: { display: true, text: 'Fail Count' } },
                            y1: {
                                title: { display: true, text: 'Cumulative Percentage' },
                                position: 'right',
                                grid: { drawOnChartArea: false },
                            },
                        },
                        plugins: { legend: { display: true, position: 'top' } },
                    }}
                />
            ) : (
                <div className={styles.placeholderContent}>{t('Loading Pareto Chart...')}</div>
            )}
        </div>
    </div>

    {/* Stats Section */}
    <div className={styles.dashboardStats}>
    {/* Total Successful Production */}
    <div className={styles.statCard}>
    <h3>{t('Total Successful Production')}:</h3>
    <p>{totalProduction} pcs.</p>
    <label>
    {t('Set Production Goal')}:
    <input
        type="number"
        value={productionGoal}
        onChange={handleProductionGoalChange}
        min="1"
        className={styles.productionGoalInput}
    />
</label>

    <div className={styles.progressBarContainer}>
        <div
            className={styles.progressBar}
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
        ></div>
    </div>
    <p className={styles.progressText}>
        {t('Progress')}: {Math.round(progressPercentage)}%
    </p>
</div>




    {/* Monthly Failure Rate Chart */}
    <div className={`${styles.statCard} ${styles.chartCard}`}>
    <h3>{t('Monthly Failure Rate')}</h3>
    <div className={styles.chartContainer}>
        {filledFailureRateData.length > 0 ? (
            <Line
            data={failureRateChartData}
            options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Failure Rate: ${context.raw.toFixed(2)}%`,
                        },
                    },
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Month',
                            font: { size: 14 },
                        },
                        ticks: {
                            autoSkip: true, // Ensure all labels are displayed
                            maxRotation: 0,
                            minRotation: 0,
                        },
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Failure Rate (%)',
                            font: { size: 14 },
                        },
                        ticks: {
                            callback: (value) => `${value}%`, // Add % to y-axis labels
                        },
                    },
                },
            }}
        />
        
        
        ) : (
            <p>{t('Loading Chart...')}</p>
        )}
    </div>
</div>

</div>


    <Modal
  isOpen={isZoomModalOpen}
  onRequestClose={() => setIsZoomModalOpen(false)}
  className={styles.zoomModalContent}
  overlayClassName={styles.zoomModalOverlay}
  contentLabel="Zoom Information"
>
  <h2>{language === 'it' ? 'Avviso Zoom' : 'Zoom Warning'}</h2>
  <pre style={{ whiteSpace: 'pre-wrap' }}>{zoomMessage}</pre>
  <button
    onClick={() => setIsZoomModalOpen(false)}
    className={styles.closeZoomButton}
  >
    {language === 'it' ? 'Chiudi' : 'Close'}
  </button>
</Modal>

</div>

            
            {/* Help button and modal */}
            <button className={styles.helpButton} onClick={openHelp} aria-label="Help">?</button>
            <Modal
    isOpen={isHelpOpen}
    onRequestClose={closeHelp}
    className={styles.helpModalContent}
    overlayClassName={styles.helpModalOverlay}
    contentLabel="Help Information"
>
    <button onClick={closeHelp} className={styles.closeHelpButton}>Close</button>
    <div className={styles.helpText}>
        <h2>About this Dashboard</h2>
        <p>
            This dashboard provides an overview of system performance, production data, and failure analysis to help you monitor and evaluate testing processes effectively. Below are the main features and functionalities:
        </p>

        <h3>Key Features</h3>
        <ul>
            <li>
                <strong>System Overview:</strong> Displays real-time system health, including test success rates and failure counts.
            </li>
            <li>
                <strong>Performance Metrics:</strong> Provides detailed charts showing system performance over different periods, including success rates, failure trends, and overall system efficiency.
            </li>
            <li>
                <strong>Failure Analysis:</strong> Identifies critical areas and test steps where failures are most frequent, helping prioritize troubleshooting efforts.
            </li>
            <li>
                <strong>Interactive Charts:</strong> Includes various visualizations (bar charts, pie charts, Pareto charts) to highlight insights into system health and performance.
            </li>
        </ul>

        <h3>Filters</h3>
        <p>
            Customize the data displayed using the following filters:
        </p>
        <ul>
            <li>
                <strong>Date Range Filter:</strong> Customize the displayed data by selecting a specific time period (e.g., daily, monthly, quarterly).
            </li>
            <li>
                <strong>Version Filter:</strong> Filter performance data based on specific versions of the testing software (ATE SW Version).
            </li>
            <li>
                <strong>Serial Numbers Filter:</strong> Analyze test results for specific hardware units by filtering serial numbers.
            </li>
        </ul>

        <h3>Data Visualization</h3>
        <p>
            The dashboard provides a variety of visual elements to analyze test data:
        </p>
        <ul>
            <li>
                <strong>Pie Chart:</strong> Displays the distribution of PASS and FAIL test results, offering a quick summary of test outcomes.
            </li>
            <li>
                <strong>Pareto Chart:</strong> Visualizes failure counts and cumulative failure percentages by step, highlighting critical areas for improvement.
            </li>
            <li>
                <strong>Production Totals:</strong> Offers a summary of total successful tests and production output.
            </li>
            <li>
                <strong>Monthly Failure Rate:</strong> 
                The Monthly Failure Rate chart shows the percentage of failed tests grouped by month over the selected time period. 
                This visualization highlights trends in test failures, helping to identify patterns or periods of higher failure rates.
                You can use the date filter to customize the displayed range and pinpoint specific periods for analysis.
            </li>
        </ul>

        <h3>Alarm System Button</h3>
        <p>
            The <strong>Root Cause Alarm</strong> button, located beside the help button, provides direct access to the <strong>Root Cause Alarm System</strong>. This page highlights high-priority failure relationships with 100% probability and offers troubleshooting tips for critical test steps.
        </p>
        <ul>
            <li>
                <strong>Flashing Red Button:</strong> The alarm button flashes red to indicate the presence of high-priority failures requiring immediate attention.
            </li>
            <li>
                <strong>Root Cause Analysis:</strong> Provides a list of test steps and their related failures with actionable troubleshooting insights.
            </li>
        </ul>

        <h3>System Health Status</h3>
        <p>
            The system health section displays the current state of the system:
        </p>
        <ul>
            <li>
                <strong>Green Indicator:</strong> A green light shows the system is functioning smoothly.
            </li>
            <li>
                <strong>Yellow Indicator:</strong> A yellow light indicates minor warnings that do not significantly impact performance.
            </li>
            <li>
                <strong>Red Indicator:</strong> A red light signals critical issues that need immediate resolution.
            </li>
        </ul>

        <h3>Navigation</h3>
        <p>
            Use the navigation panel to access other sections of the dashboard:
        </p>
        <ul>
            <li>
                <strong>File Upload:</strong> Upload new test data for analysis.
            </li>
            <li>
                <strong>File Management:</strong> Manage and review uploaded files with options for editing or deleting.
            </li>
            <li>
                <strong>Charts and Graphs:</strong> Explore detailed visualizations of system performance, trends, and failure analysis.
            </li>
        </ul>

        <p>
            This dashboard is designed to help you monitor production outcomes, troubleshoot failures, and improve overall system performance efficiently.
        </p>
        <p>Made in IRAN 🇮🇷</p>
    </div>
</Modal>
        </div>
    );
    
};

export default Dashboard;
