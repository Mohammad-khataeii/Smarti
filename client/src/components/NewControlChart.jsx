import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import html2canvas from 'html2canvas';
import Modal from 'react-modal';
import styles from './NewControlChart.module.css';
import GoToDashboardButton from '../components/GoToDashboardButton';

const NewControlChart = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const individualChartRef = useRef(null);
    const mrChartRef = useRef(null);
    const [expandedChart, setExpandedChart] = useState(null); // For managing expanded chart modal

    // State for custom LSL/USL
    const [customLsl, setCustomLsl] = useState(null);
    const [customUsl, setCustomUsl] = useState(null);
    const [currentLsl, setCurrentLsl] = useState(null);
    const [currentUsl, setCurrentUsl] = useState(null);

    const { results } = location.state || {};

    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const openHelp = () => setIsHelpOpen(true);
    const closeHelp = () => setIsHelpOpen(false);

    useEffect(() => {
        if (!results) {
            navigate('/');
        } else {
            // Initialize LSL and USL from results
            setCurrentLsl(results.lsl);
            setCurrentUsl(results.usl);
        }
    }, [results, navigate]);

    if (!results) {
        return null;
    }

    const {
        stepNumber,
        lsl,
        usl,
        passSerialNumbers = [],
        passMeasureValues = [],
        individualChart = {},
        mrChart = {},
    } = results;

    const ucl = individualChart?.ucl ?? 0;
    const lcl = individualChart?.lcl ?? 0;
    const mrUcl = mrChart?.ucl ?? 0;
    const mrLcl = mrChart?.lcl ?? 0;

    // Disable Apply button if LSL is greater than or equal to USL
    const isApplyDisabled = () => {
        const parsedLsl = parseFloat(customLsl);
        const parsedUsl = parseFloat(customUsl);
        return parsedLsl !== null && parsedUsl !== null && parsedLsl >= parsedUsl;
    };

    // Apply new LSL/USL
    const applyCustomLimits = () => {
        setCurrentLsl(customLsl !== null ? parseFloat(customLsl) : lsl);
        setCurrentUsl(customUsl !== null ? parseFloat(customUsl) : usl);
    };

    // Reset to default LSL/USL
    const resetLimits = () => {
        setCustomLsl(null);
        setCustomUsl(null);
        setCurrentLsl(lsl);
        setCurrentUsl(usl);
    };

    // Calculate moving ranges (MR)
    const movingRanges = passMeasureValues.length > 1
        ? passMeasureValues.slice(1).map((val, idx) => Math.abs(val - passMeasureValues[idx]))
        : []; 
    const mrBar = movingRanges.length
        ? movingRanges.reduce((sum, mr) => sum + mr, 0) / movingRanges.length
        : 0;

    // Chart Options
    const individualChartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
        },
        scales: {
            x: {
                ticks: {
                    maxRotation: 45,
                    minRotation: 0,
                    autoSkip: true,
                    callback: (value, index) => passSerialNumbers[index],
                },
            },
            y: {
                beginAtZero: true,
            },
        },
    };

    const mrChartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
        },
        scales: {
            x: {
                ticks: {
                    maxRotation: 45,
                    minRotation: 0,
                    autoSkip: true,
                    callback: (value, index) => passSerialNumbers[index + 1],
                },
            },
            y: {
                beginAtZero: true,
            },
        },
    };

    // Prepare data for Individual Chart
    const individualChartData = {
        labels: passSerialNumbers,
        datasets: [
            {
                label: 'Measure Values',
                data: passMeasureValues,
                borderColor: 'blue',
                borderWidth: 2,
                fill: false,
            },
            {
                label: 'UCL',
                data: Array(passMeasureValues.length).fill(ucl),
                borderColor: 'red',
                borderWidth: 1,
                borderDash: [5, 5],
            },
            {
                label: 'LCL',
                data: Array(passMeasureValues.length).fill(lcl),
                borderColor: 'green',
                borderWidth: 1,
                borderDash: [5, 5],
            },
            {
                label: 'USL (Specification Limit)',
                data: Array(passMeasureValues.length).fill(currentUsl),
                borderColor: 'orange',
                borderWidth: 1,
                borderDash: [10, 5],
            },
            {
                label: 'LSL (Specification Limit)',
                data: Array(passMeasureValues.length).fill(currentLsl),
                borderColor: 'purple',
                borderWidth: 1,
                borderDash: [10, 5],
            },
        ],
    };

    // Prepare data for MR Chart
    const mrChartData = {
        labels: passSerialNumbers.length > 1 ? passSerialNumbers.slice(1) : [],
        datasets: [
            {
                label: 'Moving Ranges',
                data: movingRanges,
                borderColor: 'purple',
                borderWidth: 2,
                fill: false,
            },
            {
                label: 'MR Bar',
                data: Array(movingRanges.length).fill(mrBar),
                borderColor: 'orange',
                borderWidth: 1,
                borderDash: [5, 5],
            },
            {
                label: 'UCL',
                data: Array(movingRanges.length).fill(mrUcl),
                borderColor: 'red',
                borderWidth: 1,
                borderDash: [5, 5],
            },
            {
                label: 'LCL',
                data: Array(movingRanges.length).fill(mrLcl),
                borderColor: 'green',
                borderWidth: 1,
                borderDash: [5, 5],
            },
            {
                label: 'USL (Specification Limit)',
                data: Array(movingRanges.length).fill(currentUsl),
                borderColor: 'orange',
                borderWidth: 1,
                borderDash: [10, 5],
            },
            {
                label: 'LSL (Specification Limit)',
                data: Array(movingRanges.length).fill(currentLsl),
                borderColor: 'purple',
                borderWidth: 1,
                borderDash: [10, 5],
            },
        ],
    };

    // Export chart as PNG
    const exportChartAsPNG = async (chartRef, filename) => {
        if (chartRef.current) {
            const canvas = await html2canvas(chartRef.current);
            const link = document.createElement('a');
            link.download = `${filename}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    };

    return (
        <div className={styles.container}>
            <GoToDashboardButton />
            {/* Display Calculated UCL and LCL */}
        <div className={styles.uclLclDisplay}>
            <div>
                <label>New calculated</label>
                <label>UCL:</label>
                    <span className={styles.uclValue}>{Number(ucl).toFixed(2)}</span>
            </div>
            <div>
                <label>LCL:</label>
                    <span className={styles.lclValue}>{Number(lcl).toFixed(2)}</span>
            </div>
                <button
                    className={styles.helpButton}
                    onClick={openHelp}
                    aria-label="Help"
                >
                    ?
                </button>
        </div>
            {/* Filter Section */}
            <div className={styles.filterSection}>
                <div>
                    <label htmlFor="lslInput">Set LSL:</label>
                    <input
                        id="lslInput"
                        type="number"
                        placeholder={lsl}
                        value={customLsl || ''}
                        onChange={(e) => setCustomLsl(e.target.value)}
                        className={styles.inputField}
                    />
                </div>
                <div>
                    <label htmlFor="uslInput">Set USL:</label>
                    <input
                        id="uslInput"
                        type="number"
                        placeholder={usl}
                        value={customUsl || ''}
                        onChange={(e) => setCustomUsl(e.target.value)}
                        className={styles.inputField}
                    />
                </div>
                <div>
                    <button
                        onClick={applyCustomLimits}
                        className={styles.applyButton}
                        disabled={isApplyDisabled()}
                    >
                        Apply
                    </button>
                    <button onClick={resetLimits} className={styles.resetButton}>
                        Reset
                    </button>
                </div>
                {isApplyDisabled() && (
                    <p className={styles.errorText}>LSL cannot be greater than or equal to USL.</p>
                )}
            </div>

            <div className={styles.header}>
                <h2>Control Charts for Step Number: {stepNumber}</h2>
            </div>

            {/* Chart Sections */}
            <div className={styles.chartSection}>
                <h3 className={styles.chartTitle}>Individual Chart</h3>
                <div className={styles.chartContainer} ref={individualChartRef}>
                    <Line data={individualChartData} options={individualChartOptions} />
                </div>
                <button
                    onClick={() => exportChartAsPNG(individualChartRef, 'Individual_Chart')}
                    className={styles.exportButton}
                >
                    Export Individual Chart
                </button>
                <button
                    onClick={() => setExpandedChart('individual')}
                    className={styles.expandButton}
                >
                    Expand Chart
                </button>
            </div>

            <div className={styles.chartSection}>
                <h3 className={styles.chartTitle}>MR Chart</h3>
                <div className={styles.chartContainer} ref={mrChartRef}>
                    <Line data={mrChartData} options={mrChartOptions} />
                </div>
                <button
                    onClick={() => exportChartAsPNG(mrChartRef, 'MR_Chart')}
                    className={styles.exportButton}
                >
                    Export MR Chart
                </button>
                <button
                    onClick={() => setExpandedChart('mr')}
                    className={styles.expandButton}
                >
                    Expand Chart
                </button>
            </div>
                
            {/* Expanded Chart Modal */}
            <Modal
    isOpen={!!expandedChart}
    onRequestClose={() => setExpandedChart(null)}
    className={styles.modalContent}
    overlayClassName={styles.modalOverlay}
>
    
    <button onClick={() => setExpandedChart(null)} className={styles.closeModalButton}>
        Close
    </button>
    {expandedChart === 'individual' && (
        <div className={styles.expandedChart}>
            <h2>Expanded Individual Chart</h2>
            <Line
                data={individualChartData}
                options={{
                    maintainAspectRatio: false,
                    responsive: true,
                    scales: {
                        x: {
                            ticks: {
                                autoSkip: false,
                                maxRotation: 90,
                                minRotation: 45,
                            },
                            title: {
                                display: true,
                                text: 'Serial Numbers',
                            },
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Measure Values',
                            },
                        },
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                    },
                }}
            />
        </div>
    )}
    {expandedChart === 'mr' && (
        <div className={styles.expandedChart}>
            <h2>Expanded MR Chart</h2>
            <Line
                data={mrChartData}
                options={{
                    maintainAspectRatio: false,
                    responsive: true,
                    scales: {
                        x: {
                            ticks: {
                                autoSkip: false,
                                maxRotation: 90,
                                minRotation: 45,
                            },
                            title: {
                                display: true,
                                text: 'Serial Numbers (MR)',
                            },
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Moving Ranges',
                            },
                        },
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                    },
                }}
            />
        </div>
    )}
</Modal>
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
                    <h2>About this Page</h2>
                    <p>
                        This page displays recalculated control charts for the selected step number based on the files chosen in the Control Limits Calculator.
                    </p>
                    <ul>
                        <li>
                            <strong>Individual Chart:</strong> Shows the selected measurement values for each serial number together with the recalculated control limits and the active specification limits.
                        </li>
                        <li>
                            <strong>MR Chart:</strong> Shows the moving range between consecutive measurement values to help evaluate short-term variation and process stability.
                        </li>
                        <li>
                            <strong>Recalculated Control Limits:</strong> The displayed UCL and LCL are newly computed from the selected files and the selected step number.
                        </li>
                        <li>
                            <strong>Custom Specification Limits:</strong> You can manually enter custom LSL and USL values, apply them to the charts, and reset them back to the original limits at any time.
                        </li>
                        <li>
                            <strong>Chart Tools:</strong>
                            <ul>
                                <li><strong>Export as PNG:</strong> Save the Individual Chart or MR Chart as an image.</li>
                                <li><strong>Expand Chart:</strong> Open a larger version of each chart for easier viewing and analysis.</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Step-based Analysis:</strong> This page focuses on one specific step number at a time, using only the selected files that were included in the calculation.
                        </li>
                    </ul>
                    <p>
                        Use this page to review the recalculated control behavior of a specific test step, compare it against specification limits, and inspect variation across the selected units.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default NewControlChart;
