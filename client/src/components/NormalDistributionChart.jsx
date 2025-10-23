import React, { useState, useEffect } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Line } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Modal from 'react-modal';
import axios from 'axios';
import styles from './NormalDistributionChartWithDropdown.module.css';
import GoToDashboardButton from '../components/GoToDashboardButton';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, annotationPlugin);

// Set the modal app element for accessibility
Modal.setAppElement('#root');

const NormalDistributionChartWithDropdown = () => {
    const [stepNumbers, setStepNumbers] = useState([]);
    const [selectedStepNumber, setSelectedStepNumber] = useState('');
    const [ateSwVersions, setAteSwVersions] = useState([]);
    const [testspecs, setTestspecs] = useState([]);
    const [selectedAteSwVersion, setSelectedAteSwVersion] = useState('');
    const [selectedTestspec, setSelectedTestspec] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [normalDistData, setNormalDistData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [lsl, setLsl] = useState(0); // Default value of 0
    const [usl, setUsl] = useState(0); // Default value of 0

    const [isHelpOpen, setIsHelpOpen] = useState(false);

const openHelp = () => setIsHelpOpen(true);
const closeHelp = () => setIsHelpOpen(false);



    // Fetch distinct step numbers, ateSwVersions, and testspecs
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [stepNumbersResponse, ateSwVersionsResponse, testspecsResponse] = await Promise.all([
                    axios.get('http://localhost:3001/api/distinct-step-numbers'),
                    axios.get('http://localhost:3001/api/ate-sw-versions'),
                    axios.get('http://localhost:3001/api/testspecs'),
                ]);

                setStepNumbers(stepNumbersResponse.data);
                setAteSwVersions(ateSwVersionsResponse.data.map(item => item.AteSwVersion));
                setTestspecs(testspecsResponse.data.map(item => item.Testspec));
            } catch (err) {
                setError('Failed to fetch filters.');
            }
        };

        fetchFilters();
    }, []);

    const fetchNormalDistributionData = async () => {
        if (!selectedStepNumber) return;
    
        try {
            setLoading(true);
    
            const response = await axios.get('http://localhost:3001/api/normal-distribution', {
                params: {
                    stepNumber: selectedStepNumber,
                    startDate: startDate ? startDate.toISOString() : undefined,
                    endDate: endDate ? endDate.toISOString() : undefined,
                    ateSwVersion: selectedAteSwVersion || undefined,
                    lsl,
                    usl,
                },
            });
    
            const {
                histogramData,
                fittedNormalCurve,
                omega,
                ...rest // Destructure the remaining properties for convenience
            } = response.data;
    
            // Normalize histogram data
            const normalizedHistogramData = histogramData.map((bin) => ({
                x: bin.x,
                y: bin.y / omega, // Normalize frequency to density
            }));
    
            setNormalDistData({
                ...rest,
                normalizedHistogramData, // Store normalized histogram data
                fittedNormalCurve,
                omega,
            });
        } catch (err) {
            console.error('Error fetching normal distribution data:', err);
            setError('Failed to fetch data.');
        } finally {
            setLoading(false);
        }
    };
    
    
        const handleApplyFilters = () => {
        fetchNormalDistributionData();
    };

    const handleResetFilters = () => {
        setSelectedStepNumber('');
        setSelectedAteSwVersion('');
        setSelectedTestspec('');
        setStartDate(null);
        setEndDate(null);
        setNormalDistData(null); // Clear chart data
        setError(null);
    };

    const openModal = () => {
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    const generateChartData = () => {
        if (!normalDistData || !normalDistData.normalizedHistogramData || !normalDistData.fittedNormalCurve) {
            console.error('Missing or invalid normalDistData:', normalDistData);
            return {
                labels: [],
                datasets: [],
            };
        }
    
        const { normalizedHistogramData, fittedNormalCurve } = normalDistData;
    
        // Format labels to show bin ranges
        const labels = normalizedHistogramData.map((bin, index) => {
            const start = bin.x;
            const end = bin.x + normalDistData.omega; // Use omega to determine the bin range
            return `[${start.toFixed(2)}, ${end.toFixed(2)}]`; // Example format: "[10.00, 20.00]"
        });
    
        return {
            labels, // Use formatted bin range labels
            datasets: [
                {
                    type: 'bar',
                    label: 'Histogram (Normalized Frequency)',
                    data: normalizedHistogramData.map((bin) => bin.y),
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                },
                {
                    type: 'line',
                    label: 'Fitted Normal Distribution',
                    data: fittedNormalCurve.map((point) => point.y),
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.3,
                },
            ],
        };
    };
    
    
    
    
    
    
    const generateChartOptions = () => {
        if (!normalDistData) return {};
    
        const { lsl, usl, xBar } = normalDistData;
    
        return {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    title: { display: true, text: 'Measurement Values (Bin Ranges)' },
                    ticks: {
                        callback: function (value, index, values) {
                            return this.getLabelForValue(value); // Ensure proper formatting for large labels
                        },
                    },
                },
                y: {
                    title: { display: true, text: 'Frequency / Probability Density' },
                    ticks: { beginAtZero: true },
                },
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (tooltipItem) => {
                            const datasetLabel = tooltipItem.dataset.label;
                            const value = tooltipItem.raw;
                            return `${datasetLabel}: ${value.toFixed(3)}`;
                        },
                    },
                },
                annotation: {
                    annotations: {
                        lsl: {
                            type: 'line',
                            xMin: lsl,
                            xMax: lsl,
                            borderColor: 'red',
                            borderWidth: 2,
                            label: {
                                content: `LSL (${lsl.toFixed(2)})`,
                                enabled: true,
                                position: 'top',
                                backgroundColor: 'rgba(255, 0, 0, 0.8)',
                                color: '#fff',
                            },
                        },
                        usl: {
                            type: 'line',
                            xMin: usl,
                            xMax: usl,
                            borderColor: 'blue',
                            borderWidth: 2,
                            label: {
                                content: `USL (${usl.toFixed(2)})`,
                                enabled: true,
                                position: 'top',
                                backgroundColor: 'rgba(0, 0, 255, 0.8)',
                                color: '#fff',
                            },
                        },
                        mean: {
                            type: 'line',
                            xMin: xBar,
                            xMax: xBar,
                            borderColor: 'green',
                            borderWidth: 2,
                            label: {
                                content: `Mean (${xBar.toFixed(2)})`,
                                enabled: true,
                                position: 'top',
                                backgroundColor: 'rgba(0, 255, 0, 0.8)',
                                color: '#fff',
                            },
                        },
                    },
                },
            },
        };
    };
    
    
    
    
    return (
        <div className={styles.container}>
            <h2>Normal Distribution Chart</h2>
            <GoToDashboardButton />
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.filters}>
                {/* Step Number Filter */}
                <select value={selectedStepNumber} onChange={(e) => setSelectedStepNumber(e.target.value)}>
                    <option value="" disabled>Select Step Number</option>
                    {stepNumbers.map((step) => (
                        <option key={step} value={step}>{step}</option>
                    ))}
                </select>
    
                {/* AteSwVersion Filter */}
                <select value={selectedAteSwVersion} onChange={(e) => setSelectedAteSwVersion(e.target.value)}>
                    <option value="">All Versions</option>
                    {ateSwVersions.map((version) => (
                        <option key={version} value={version}>{version}</option>
                    ))}
                </select>
    
                {/* Test Spec Filter */}
                <select value={selectedTestspec} onChange={(e) => setSelectedTestspec(e.target.value)}>
                    <option value="">All Testspecs</option>
                    {testspecs.map((spec) => (
                        <option key={spec} value={spec}>{spec}</option>
                    ))}
                </select>
    
                {/* Date Pickers */}
                <div className={styles.datePickers}>
                    <label>Start Date:</label>
                    <DatePicker
                        selected={startDate}
                        onChange={(date) => setStartDate(date)}
                        dateFormat="yyyy-MM-dd"
                        placeholderText="Select Start Date"
                    />
                    <label>End Date:</label>
                    <DatePicker
                        selected={endDate}
                        onChange={(date) => setEndDate(date)}
                        dateFormat="yyyy-MM-dd"
                        placeholderText="Select End Date"
                    />
                </div>
            </div>
    
            {/* Buttons */}
            <div className={styles.buttons}>
                <button onClick={handleApplyFilters} className={styles.applyButton}>Apply Filters</button>
                <button onClick={handleResetFilters} className={styles.resetButton}>Reset</button>
                {normalDistData && (
                    <button onClick={openModal} className={styles.enlargeButton}>Enlarge Chart</button>
                )}
            </div>
    
            {/* Loading Indicator */}
            {loading && <p>Loading...</p>}
    
            {/* Chart and Metrics */}
            {normalDistData && (
                <>
                    <div className={styles.chartContainer}>
                        {/* Render Chart */}
                        <Line data={generateChartData()} options={generateChartOptions()} />
                    </div>
    
                    {/* Metrics for Cp and Cpk */}
                    <div className={styles.metrics}>
                    <p><strong>Cp:</strong> {normalDistData.cp !== null ? normalDistData.cp.toFixed(2) : 'N/A'}</p>
                    <p><strong>Cpk:</strong> {normalDistData.cpk !== null ? normalDistData.cpk.toFixed(2) : 'N/A'}</p>
                    <p><strong>Bin Width (Omega):</strong> {normalDistData.omega ? normalDistData.omega.toFixed(2) : 'N/A'}</p>
                    </div>

                </>
            )}
    
            {/* Modal for Enlarged Chart */}
            <Modal
    isOpen={isModalOpen}
    onRequestClose={closeModal}
    contentLabel="Expanded Chart"
    className={styles.modal}
    overlayClassName={styles.overlay}
>
    <button onClick={closeModal} className={styles.closeButton}>Close</button>
    {normalDistData && (
        <div className={styles.expandedChartContainer}>
            <Line data={generateChartData()} options={generateChartOptions()} />
        </div>
    )}
</Modal>
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
        <h2>About This Page</h2>
        <p>
            This page provides a detailed visualization of the **Normal Distribution Analysis**, helping you compare your data to a theoretical normal distribution. 
        </p>
        <h3>Key Components</h3>
        <ul>
            <li>
                <strong>Histogram:</strong> The histogram divides the data into equal-sized bins using the following process:
                <ul>
                    <li><strong>Range of Data:</strong> Calculated as:
                        <pre>Range = Max Value - Min Value</pre>
                    </li>
                    <li><strong>Number of Bins (k):</strong> Determined using <strong>Rice's Rule:</strong>
                        <pre>k = 2 × (n<sup>1/3</sup>)</pre>
                        where <em>n</em> is the number of data points.
                    </li>
                    <li><strong>Bin Width (ω):</strong> Calculated using:
                        <pre>ω = Range / k</pre>
                    </li>
                    <li>Each bin's range is displayed on the X-axis, and the Y-axis shows the normalized frequency density.</li>
                </ul>
            </li>
            <li>
                <strong>Fitted Normal Curve:</strong> The normal curve is calculated using the mean (\(x̄\)) and standard deviation (\(σ\)) of the data:
                <ul>
                    <li>
                        <strong>Mean:</strong>
                        <pre>x̄ = (Σ Data Points) / n</pre>
                    </li>
                    <li>
                        <strong>Standard Deviation (σ):</strong>
                        <pre>σ = √[Σ (Data Point - x̄)<sup>2</sup> / n]</pre>
                    </li>
                    <li>The curve is overlaid to compare the actual data distribution with a theoretical normal distribution.</li>
                </ul>
            </li>
            <li>
                <strong>Control Limits:</strong> Calculated using the following formulas:
                <ul>
                    <li><strong>UCL (Upper Control Limit):</strong>
                        <pre>UCL = x̄ + 3 × (σ / 1.128)</pre>
                    </li>
                    <li><strong>LCL (Lower Control Limit):</strong>
                        <pre>LCL = x̄ - 3 × (σ / 1.128)</pre>
                    </li>
                </ul>
            </li>
            <li>
                <strong>Key Metrics:</strong> The page also calculates process capability metrics:
                <ul>
                    <li><strong>Cp:</strong> Measures process capability:
                        <pre>Cp = (USL - LSL) / (6 × σ)</pre>
                    </li>
                    <li><strong>Cpk:</strong> Accounts for process centering:
                        <pre>Cpk = min[(USL - x̄) / (3 × σ), (x̄ - LSL) / (3 × σ)]</pre>
                    </li>
                </ul>
            </li>
        </ul>
        <h3>How to Use</h3>
        <ul>
            <li><strong>Filters:</strong> Select a step number, date range, software version, and optional specification limits (LSL and USL) to analyze the data.</li>
            <li><strong>Histogram Interpretation:</strong> Review the bin ranges and frequency distribution of your data.</li>
            <li><strong>Normal Curve Comparison:</strong> Use the fitted normal curve to compare your data's distribution against the ideal normal distribution.</li>
            <li><strong>Metrics:</strong> Cp and Cpk provide insights into process performance relative to specification limits.</li>
        </ul>
        <p>
            Use this page to evaluate how well your data aligns with a normal distribution and identify any process variations or deviations.
        </p>
    </div>
</Modal>


        </div>
    );
    

};

export default NormalDistributionChartWithDropdown;
