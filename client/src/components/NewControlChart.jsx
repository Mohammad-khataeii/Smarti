import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import html2canvas from 'html2canvas';
import Modal from 'react-modal';
import styles from './NewControlChart.module.css';

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
        ucl,
        lcl,
        lsl,
        usl,
        passSerialNumbers,
        passMeasureValues,
    } = results;

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
    const movingRanges = passMeasureValues.slice(1).map((val, idx) => Math.abs(val - passMeasureValues[idx]));
    const mrBar = movingRanges.reduce((sum, mr) => sum + mr, 0) / movingRanges.length;

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
        labels: passSerialNumbers.slice(1),
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
                data: Array(movingRanges.length).fill(ucl),
                borderColor: 'red',
                borderWidth: 1,
                borderDash: [5, 5],
            },
            {
                label: 'LCL',
                data: Array(movingRanges.length).fill(lcl),
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
            {/* Display Calculated UCL and LCL */}
        <div className={styles.uclLclDisplay}>
            <div>
                <label>New calculated</label>
                <label>UCL:</label>
                <span className={styles.uclValue}>{ucl.toFixed(2)}</span>
            </div>
            <div>
                <label>LCL:</label>
                <span className={styles.lclValue}>{lcl.toFixed(2)}</span>
            </div>
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

        </div>
    );
};

export default NewControlChart;
