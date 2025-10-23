import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';
import { jsPDF } from 'jspdf';
import Papa from 'papaparse';
import styles from './RootCauseAnalysis.module.css';
import ReactLoading from 'react-loading';  // Import the react-loading component
import Modal from 'react-modal';
import GoToDashboardButton from '../components/GoToDashboardButton';

const RootCauseAnalysis = () => {
    const [analysisData, setAnalysisData] = useState([]);
    const [stepNumbers, setStepNumbers] = useState([]);
    const [selectedStepNumber, setSelectedStepNumber] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [ateSwVersions, setAteSwVersions] = useState([]);
    const [ateSwVersion, setAteSwVersion] = useState('');
    const [serialNumbers, setSerialNumbers] = useState([]);
    const [selectedSerialNumbers, setSelectedSerialNumbers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [isHelpOpen, setIsHelpOpen] = useState(false);

const openHelp = () => setIsHelpOpen(true);
const closeHelp = () => setIsHelpOpen(false);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalDetails, setModalDetails] = useState(null);

    // State for controlling visibility of the probability section
    const [showProbabilities, setShowProbabilities] = useState(true);

    // Fetch distinct step numbers
    useEffect(() => {
        const fetchStepNumbers = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/distinct-step-numbers');
                setStepNumbers(response.data);
            } catch (err) {
                console.error('Error fetching step numbers:', err);
            }
        };
        fetchStepNumbers();
    }, []);

    // Fetch serial numbers and ATE SW versions
    useEffect(() => {
        const fetchSerialNumbers = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/distinct-serial-numbers');
                setSerialNumbers(response.data.map(sn => ({ value: sn, label: sn })));
            } catch (error) {
                console.error('Error fetching serial numbers:', error);
            }
        };

        const fetchAteSwVersions = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/ate-sw-versions');
                setAteSwVersions(response.data.map(ver => ({ value: ver.AteSwVersion, label: ver.AteSwVersion })));
            } catch (error) {
                console.error('Error fetching ATE SW Versions:', error);
            }
        };

        fetchSerialNumbers();
        fetchAteSwVersions();
    }, []);

    const fetchAnalysisData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get('http://localhost:3001/api/root-cause-analysis', {
                params: {
                    stepNumber: selectedStepNumber,
                    startDate: startDate ? startDate.toISOString().split('T')[0] : null,
                    endDate: endDate ? endDate.toISOString().split('T')[0] : null,
                    ateSwVersion: ateSwVersion || null,
                    serialNumbers: selectedSerialNumbers.map(sn => sn.value).join(','),
                },
            });
    
            // Simulate a 5-second delay before updating the loading state
            setTimeout(() => {
                setAnalysisData(response.data);
                setLoading(false); // Stop loading after 5 seconds
            }, 5000);
            
        } catch (err) {
            console.error('Error fetching analysis data:', err);
            setError('Failed to load data. Please try again later.');
            setLoading(false); // In case of an error, stop loading
        }
    };
    

    const handleApplyFilters = () => fetchAnalysisData();

    const resetFilters = () => {
        setSelectedStepNumber('');
        setStartDate(null);
        setEndDate(null);
        setAteSwVersion('');
        setSelectedSerialNumbers([]);
        fetchAnalysisData();
    };

    const chartData = {
        labels: analysisData.map(item => `Step ${item.relatedStep}`),
        datasets: [
            {
                label: `Root Cause Probability (%)`,
                data: analysisData.map(item => item.probability),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
            },
        ],
    };

    // Group steps by probability
    const groupedByProbability = analysisData.reduce((acc, analysis) => {
        if (!acc[analysis.probability]) {
            acc[analysis.probability] = [];
        }
        acc[analysis.probability].push(analysis);
        return acc;
    }, {});

    // Handle showing the modal with details
    const handleClick = (probability) => {
        setModalDetails(groupedByProbability[probability]);
        setShowModal(true);
    };

    // Close modal
    const closeModal = () => setShowModal(false);

    // Toggle visibility of the probability section
    const toggleProbabilities = () => setShowProbabilities(prevState => !prevState);

    // Export Chart as PNG
    const exportChartAsPNG = () => {
        const chart = document.getElementById('chartjs-chart');
        const canvas = chart.querySelector('canvas');
        const image = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
        const link = document.createElement('a');
        link.href = image;
        link.download = 'chart.png';
        link.click();
    };

    // Export Probabilities to PDF
    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text('Root Cause Analysis - Probability Data', 10, 10);
        let yOffset = 20;

        Object.keys(groupedByProbability).forEach((probability) => {
            doc.text(`Root Cause Probability: ${probability}%`, 10, yOffset);
            yOffset += 10;
            groupedByProbability[probability].forEach((step) => {
                doc.text(`Step ${step.relatedStep}: ${step.probability}%`, 20, yOffset);
                yOffset += 10;
            });
            yOffset += 10; // Add extra space between different probability groups
        });

        doc.save('probabilities.pdf');
    };

    // Export Probabilities to CSV
    const exportToCSV = () => {
        const data = [];

        Object.keys(groupedByProbability).forEach((probability) => {
            groupedByProbability[probability].forEach((step) => {
                data.push({
                    Probability: `${probability}%`,
                    Step: `Step ${step.relatedStep}`,
                    ProbabilityValue: `${step.probability}%`,
                });
            });
        });

        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'probabilities.csv';
        link.click();
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Root Cause Analysis</h2>
            <GoToDashboardButton />
            {/* Filter Cards */}
            <div className={styles.filterContainer}>
                <div className={styles.filterField}>
                    <div className={styles.card}>
                        <h3 className={styles.cardHeader}>Select Dates</h3>
                        <DatePicker
                            selected={startDate}
                            onChange={setStartDate}
                            placeholderText="Start Date"
                            className={styles.filterInput}
                        />
                        <DatePicker
                            selected={endDate}
                            onChange={setEndDate}
                            placeholderText="End Date"
                            className={styles.filterInput}
                        />
                    </div>
                </div>

                <div className={styles.filterField}>
                    <div className={styles.card}>
                        <h3 className={styles.cardHeader}>Select ATE SW Version</h3>
                        <select
                            value={ateSwVersion}
                            onChange={(e) => setAteSwVersion(e.target.value)}
                            className={styles.dropdown}
                        >
                            <option value="">Select ATE SW Version</option>
                            {ateSwVersions.map((ver) => (
                                <option key={ver.value} value={ver.value}>
                                    {ver.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className={styles.filterField}>
                    <div className={styles.card}>
                        <h3 className={styles.cardHeader}>Select Serial Numbers</h3>
                        <Select
                            isMulti
                            options={serialNumbers}
                            value={selectedSerialNumbers}
                            onChange={setSelectedSerialNumbers}
                            placeholder="Select Serial Numbers"
                            className={styles.multiSelect}
                        />
                    </div>
                </div>

                <div className={styles.filterField}>
                    <div className={styles.card}>
                        <h3 className={styles.cardHeader}>Select Step Number</h3>
                        <select
                            value={selectedStepNumber}
                            onChange={(e) => setSelectedStepNumber(e.target.value)}
                            className={styles.dropdown}
                        >
                            <option value="">Select a Step</option>
                            {stepNumbers.map((step, index) => (
                                <option key={index} value={step}>
                                    {step}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className={styles.filterField}>
                    <button onClick={handleApplyFilters} className={styles.filterButton}>
                        Apply Filters
                    </button>
                    <button onClick={resetFilters} className={styles.filterButton}>
                        Reset Filters
                    </button>
                </div>
            </div>
            
            {loading && (
    <div className={styles.loadingContainer}>
        <ReactLoading type="spin" color="#000" height={100} width={100} />
        <img 
            src="/images/ai.gif"  // Relative path from the public directory
            alt="robot" 
            className={styles.robotImage} 
        />
    </div>
)}


            {/* Chart and Analysis Data */}
            {!loading && (
                <div className={styles.analysisCard}>
                    <Bar
                        data={chartData}
                        options={{
                            responsive: true,
                            plugins: {
                                legend: { position: 'top' },
                            },
                        }}
                    />
                    <button onClick={toggleProbabilities} className={styles.toggleButton}>
                        {showProbabilities ? 'Hide Probabilities' : 'Show Probabilities'}
                    </button>

                    {showProbabilities && (
                        <ul className={styles.probabilityList}>
                            {Object.entries(groupedByProbability)
                                .sort(([a], [b]) => b - a)
                                .map(([probability, steps]) => (
                                    <li
                                        key={probability}
                                        onClick={() => handleClick(probability)}
                                        className={probability === "100" ? styles.highlight : ""}
                                    >
                                        (Root cause Probability percentage: {probability}%)
                                    </li>
                                ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Export buttons */}
            <div className={styles.cardFooter}>
                <button onClick={exportChartAsPNG} className={styles.exportButton}>
                    Export Chart as PNG
                </button>
                <button onClick={exportToPDF} className={styles.exportButton}>
                    Export to PDF
                </button>
                <button onClick={exportToCSV} className={styles.exportButton}>
                    Export to CSV
                </button>
            </div>

            {/* Modal for displaying related steps */}
            {showModal && modalDetails && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <span className={styles.close} onClick={closeModal}>&times;</span>
                        <h3>Related Steps with {modalDetails[0].probability}% Probability</h3>
                        <ul>
                            {modalDetails.map((step, index) => (
                                <li key={index}>
                                    Step {step.relatedStep}: {step.probability}%
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
            <button
    className={styles.helpButton}
    onClick={openHelp}
    aria-label="Help"
>
    ?
</button>
<Modal
    isOpen={isHelpOpen}
    onRequestClose={closeHelp}
    className={styles.helpModalContent}
    overlayClassName={styles.helpModalOverlay}
    contentLabel="Help Information"
>
    <button onClick={closeHelp} className={styles.closeHelpButton}>
        Close
    </button>
    <div className={styles.helpText}>
        <h2>About Root Cause Analysis</h2>
        <p>
            This page performs a detailed <strong>Root Cause Analysis</strong> to identify the relationships between test steps and determine the likelihood of related failures. A machine learning module powered by a neural network (using <strong>Brain.js</strong>) is leveraged to analyze failure data and predict root cause probabilities.
        </p>
        <ul>
            <li>
                <strong>API Functionality:</strong> The API fetches failure data for a specific step and calculates related failure probabilities:
                <ul>
                    <li><strong>Primary Step:</strong> The test step being analyzed for failures.</li>
                    <li><strong>Related Steps:</strong> Steps most likely to have caused or been affected by failures in the primary step.</li>
                    <li><strong>Probabilities:</strong> The likelihood of each related step contributing to the failure, calculated as a percentage.</li>
                </ul>
            </li>
            <li>
                <strong>Machine Learning Integration:</strong>
                <ul>
                    <li>
                        A neural network model is built using <strong>Brain.js</strong>, which trains on the failure data to learn patterns and relationships between steps.
                    </li>
                    <li>
                        The model predicts root cause probabilities by analyzing the frequency of related failures and normalizing the probabilities to avoid exceeding 100%.
                    </li>
                </ul>
            </li>
            <li>
                <strong>Filters:</strong> Narrow down the analysis using the following options:
                <ul>
                    <li><strong>Step Number:</strong> Select the primary test step for analysis.</li>
                    <li><strong>Date Range:</strong> Filter by test start and stop dates (YYYY-MM-DD format).</li>
                    <li><strong>ATE SW Version:</strong> Include only data for a specific software version.</li>
                    <li><strong>Serial Numbers:</strong> Limit the analysis to specific hardware units.</li>
                </ul>
            </li>
            <li>
                <strong>Visualization:</strong> The bar chart displays:
                <ul>
                    <li><strong>Root Cause Probabilities:</strong> Bars represent the probability (%) of related failures for each step.</li>
                </ul>
            </li>
            <li>
                <strong>Export Options:</strong> Save and share your analysis results:
                <ul>
                    <li>Export the chart as a PNG image.</li>
                    <li>Export probability data as a PDF or CSV file for documentation.</li>
                </ul>
            </li>
        </ul>
        <p>
            This analysis is crucial for identifying failure patterns, improving testing processes, and mitigating root causes to enhance product quality.
        </p>
    </div>
</Modal>


        </div>
    );
};

export default RootCauseAnalysis;
