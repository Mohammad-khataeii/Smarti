import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Select from 'react-select';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import styles from './StepFrequencyChart.module.css';
import Modal from 'react-modal';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const StepFrequencyChart = () => {
    const [chartData, setChartData] = useState(null);
    const [tableData, setTableData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [ateSwVersion, setAteSwVersion] = useState('');
    const [ateSwVersions, setAteSwVersions] = useState([]);
    const [stepNumbers, setStepNumbers] = useState([]);
    const [selectedStepNumbers, setSelectedStepNumbers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const openHelp = () => setIsHelpOpen(true);
    const closeHelp = () => setIsHelpOpen(false);


    useEffect(() => {
        const fetchAteSwVersions = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/ate-sw-versions');
                setAteSwVersions(response.data);
            } catch (error) {
                console.error('Error fetching AteSwVersion data:', error);
            }
        };
        fetchAteSwVersions();
    }, []);

    useEffect(() => {
        const fetchStepNumbers = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/distinct-step-numbers');
                setStepNumbers(response.data.map(step => ({ value: step, label: `Step ${step}` })));
            } catch (error) {
                console.error('Error fetching step numbers:', error);
            }
        };
        fetchStepNumbers();
    }, []);

    const fetchStepFrequencyData = async (startDate = null, endDate = null, ateSwVersion = '', stepNumbers = []) => {
        setLoading(true);
        try {
            const response = await axios.get('http://localhost:3001/api/step-frequency', {
                params: {
                    startDate: startDate ? startDate.toISOString().split('T')[0] : null,
                    endDate: endDate ? endDate.toISOString().split('T')[0] : null,
                    ateSwVersion: ateSwVersion || undefined,
                    stepNumbers: stepNumbers.length > 0 ? stepNumbers.map(item => item.value) : undefined,
                },
            });
            const data = response.data;

            const sortedData = data
                .map(item => ({
                    stepNumber: item.stepNumber,
                    totalFrequency: item.totalFrequency,
                    failCount: item.failCount,
                    failPercentage: (item.failCount / item.totalFrequency) * 100,
                    avgMeasureValue: item.avgMeasureValue // Include average measure value in each item
                }))
                .sort((a, b) => b.failPercentage - a.failPercentage);

            const labels = sortedData.map(item => `Step ${item.stepNumber}`);
            const failPercentages = sortedData.map(item => item.failPercentage.toFixed(2));

            setChartData({
                labels,
                datasets: [
                    {
                        label: 'Fail Percentage',
                        data: failPercentages,
                        backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    },
                ],
            });

            const sortedTableData = sortedData.sort((a, b) => b.failCount - a.failCount);
            setTableData(sortedTableData);
        } catch (error) {
            console.error('Error fetching step frequency data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStepFrequencyData();
    }, []);

    const handleApplyFilters = () => {
        fetchStepFrequencyData(startDate, endDate, ateSwVersion, selectedStepNumbers);
    };

    const resetFilters = () => {
        setStartDate(null);
        setEndDate(null);
        setAteSwVersion('');
        setSelectedStepNumbers([]);
        fetchStepFrequencyData();
    };

    const toggleModal = () => {
        setIsModalOpen(!isModalOpen);
    };

    const toggleDetails = () => {
        setShowDetails(!showDetails);
    };

    if (loading) return <p>Loading...</p>;

    return (
        <div className={styles.pageContainer}>
            <h2 className={styles.chartTitle}>Step Frequency and Fail Percentage</h2>
            
            <div className={styles.filterSection}>
                <label>Select Start Date:</label>
                <DatePicker
                    selected={startDate}
                    onChange={(date) => setStartDate(date)}
                    dateFormat="yyyy-MM-dd"
                    placeholderText="Start Date"
                    className={styles.datePicker}
                />
                <label>Select End Date:</label>
                <DatePicker
                    selected={endDate}
                    onChange={(date) => setEndDate(date)}
                    dateFormat="yyyy-MM-dd"
                    placeholderText="End Date"
                    className={styles.datePicker}
                />
                <label>AteSwVersion:</label>
                <select
                    value={ateSwVersion}
                    onChange={(e) => setAteSwVersion(e.target.value)}
                    className={styles.dropdown}
                >
                    <option value="">Select AteSwVersion</option>
                    {ateSwVersions.map(version => (
                        <option key={version.AteSwVersion} value={version.AteSwVersion}>
                            {version.AteSwVersion} ({version.count})
                        </option>
                    ))}
                </select>
                <label>Select Step Numbers:</label>
                <Select
                    isMulti
                    options={stepNumbers}
                    value={selectedStepNumbers}
                    onChange={setSelectedStepNumbers}
                    className={styles.multiSelect}
                    placeholder="Select Step Numbers"
                />
                <button onClick={handleApplyFilters} className={styles.applyButton}>
                    Apply Filters
                </button>
                <button onClick={resetFilters} className={styles.resetButton}>
                    Reset to Default
                </button>
                <button onClick={toggleModal} className={styles.enlargeButton}>
                    Enlarge Chart
                </button>
            </div>

            {/* Display the chart on the page by default */}
            {chartData && (
                <Bar
                    data={chartData}
                    options={{
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: true,
                                text: 'Fail Percentage by Step Number',
                            },
                        },
                        scales: {
                            y: {
                                title: {
                                    display: true,
                                    text: 'Fail Percentage (%)',
                                },
                            },
                            x: {
                                title: {
                                    display: true,
                                    text: 'Step Number',
                                },
                            },
                        },
                    }}
                />
            )}

            <div className={styles.tableToggle}>
                <button onClick={toggleDetails} className={styles.toggleButton}>
                    {showDetails ? 'Hide Details' : 'Show Details'}
                </button>
                {showDetails && tableData && (
                    <table className={styles.detailsTable}>
                        <thead>
                            <tr>
                                <th>Step Number</th>
                                <th>Total Frequency</th>
                                <th>Fail Count</th>
                                <th>Fail Percentage (%)</th>
                                <th>Average Fail Measure Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map((item, index) => (
                                <tr key={index}>
                                    <td>{`Step ${item.stepNumber}`}</td>
                                    <td>{item.totalFrequency}</td>
                                    <td>{item.failCount}</td>
                                    <td>{item.failPercentage.toFixed(2)}</td>
                                    <td>{item.avgMeasureValue ? item.avgMeasureValue.toFixed(2) : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {isModalOpen && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <span onClick={toggleModal} className={styles.closeButton}>&times;</span>
                        <button onClick={toggleModal} className={styles.closeModalButton}>
                            Close
                        </button>
                        {chartData && (
                            <Bar
                                data={chartData}
                                options={{
                                    responsive: true,
                                    plugins: {
                                        legend: {
                                            position: 'top',
                                        },
                                        title: {
                                            display: true,
                                            text: 'Fail Percentage by Step Number (Enlarged)',
                                        },
                                    },
                                    scales: {
                                        y: {
                                            title: {
                                                display: true,
                                                text: 'Fail Percentage (%)',
                                            },
                                        },
                                        x: {
                                            title: {
                                                display: true,
                                                text: 'Step Number',
                                            },
                                        },
                                    },
                                }}
                            />
                        )}
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
        <h2>About this Page</h2>
        <p>
            This page provides a detailed analysis of hardware test data, focusing on the frequency and failure rates of test steps:
        </p>
        <ul>
            <li><strong>Bar Chart:</strong> Visual representation of the fail percentage for each test step, sorted by the highest failure rates.</li>
            <li><strong>Table:</strong> Comprehensive breakdown of step data, including:
                <ul>
                    <li>Total frequency of step executions</li>
                    <li>Number of failures</li>
                    <li>Fail percentage</li>
                    <li>Average measure value for failures</li>
                </ul>
            </li>
            <li><strong>Filters:</strong> Customize the analysis by applying:
                <ul>
                    <li>Date range filters for test execution dates</li>
                    <li>Software version filters (AteSwVersion)</li>
                    <li>Step number filters</li>
                </ul>
            </li>
            <li><strong>Expandable Chart:</strong> View the bar chart in an enlarged modal for detailed inspection.</li>
        </ul>
        <p>
            Use this tool to identify problematic test steps, optimize testing processes, and generate actionable insights for hardware quality improvement.
        </p>
    </div>
</Modal>


        </div>
    );
};

export default StepFrequencyChart;
