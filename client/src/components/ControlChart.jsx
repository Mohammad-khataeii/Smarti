import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Line, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import styles from './ControlChart.module.css';
import Modal from 'react-modal';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css'; // Import the DatePicker CSS
import { useNavigate } from 'react-router-dom';



ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const ControlChart = () => {
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStepNumber, setSelectedStepNumber] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState(null);
    const [showTable, setShowTable] = useState(false);
    const individualChartRef = useRef(null);
    const mrChartRef = useRef(null);
    const [lsl, setLsl] = useState('');
    const [usl, setUsl] = useState('');
    // Temporary values for inputs to apply limits
    const [tempLsl, setTempLsl] = useState('');
    const [tempUsl, setTempUsl] = useState('');
    // Default LSL and USL values, set initially from API data
    const [defaultLsl, setDefaultLsl] = useState('');
    const [defaultUsl, setDefaultUsl] = useState('');
    // Validation error message
    const [errorMessage, setErrorMessage] = useState('');
    // Date filter states
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    // Temporary states for date input fields
    const [tempStartDate, setTempStartDate] = useState(null);
    const [tempEndDate, setTempEndDate] = useState(null);
    // States for serial numbers and AteSwVersion
    const [selectedAteSwVersion, setSelectedAteSwVersion] = useState('');
    const [ateSwVersions, setAteSwVersions] = useState([]); // Store all distinct AteSwVersion values
    // States for serial numbers and Testspec
    const [selectedTestspec, setSelectedTestspec] = useState('');
    const [testspecs, setTestspecs] = useState([]); // Store all distinct Testspec values
    const [isHelpOpen, setIsHelpOpen] = useState(false); 
    const openHelp = () => setIsHelpOpen(true); 
    const closeHelp = () => setIsHelpOpen(false);
    // calculator
    const [filenames, setFilenames] = useState([]);
    const [selectedFilenames, setSelectedFilenames] = useState([]);
    const [uclLclResults, setUclLclResults] = useState([]);
    const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
    const navigate = useNavigate();
    
    const [sortOrder, setSortOrder] = useState('newest'); // Track sort order
    const [sortedFilenames, setSortedFilenames] = useState([]); // Sorted filenames


    
// Sort files whenever filenames or sortOrder changes
useEffect(() => {
    const sorted = [...filenames].sort((a, b) => {
        const dateA = new Date(a.testStarted);
        const dateB = new Date(b.testStarted);
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    setSortedFilenames(sorted);
}, [filenames, sortOrder]);

    useEffect(() => {
        // Simulate a 7 seconds loading time
        setTimeout(() => {
            setLoading(false);  // Hide loading animation after 7 seconds
        }, 7000);
    }, []);

    const openModal = (chartType) => {
        setModalContent(chartType);
        setIsModalOpen(true);
    };
    
    const closeModal = () => {
        setIsModalOpen(false);
        setModalContent(null);
    };

    const exportChartAsPNG = async (chartRef, fileName) => {
        if (chartRef.current) {
            try {
                const canvas = await html2canvas(chartRef.current);
                canvas.toBlob(blob => {
                    if (blob) {
                        saveAs(blob, `${fileName}.png`);
                    }
                });
            } catch (error) {
                console.error("Failed to export chart as PNG:", error);
            }
        } else {
            console.warn("Chart reference is not set");
        }
    };
    
    
    const exportTableAsCSV = () => {
        const selectedData = chartData.find(stepData => stepData.stepNumber === selectedStepNumber);
        const csvRows = [
            ['Serial Number', 'Observation', 'Value'],
            ...selectedData.values.map((value, index) => [
                selectedData.serialNumbers ? selectedData.serialNumbers[index] : 'N/A',
                index + 1,
                value
            ])
        ];
        const csvContent = csvRows.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'control_chart_data.csv');
    };

    const exportTableAsPDF = () => {
        const selectedData = chartData.find(stepData => stepData.stepNumber === selectedStepNumber);
        const doc = new jsPDF();
        const tableColumn = ['Serial Number', 'Observation', 'Value'];
        const tableRows = selectedData.values.map((value, index) => [
            selectedData.serialNumbers ? selectedData.serialNumbers[index] : 'N/A',
            index + 1,
            value
        ]);
    
        doc.text(`Extracted Values for Step ${selectedData.stepNumber}`, 14, 15);
        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 20,
        });
        doc.save('control_chart_data.pdf');
    };
    
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
        const fetchTestspecs = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/testspecs');
                setTestspecs(response.data);
            } catch (error) {
                console.error('Error fetching Testspec data:', error);
            }
        };
        fetchTestspecs();
    }, []);

    useEffect(() => {
        const fetchControlChartData = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/control-chart-data', {
                    params: {
                        lsl: lsl || undefined,
                        usl: usl || undefined,
                        startDate: startDate ? startDate.toISOString() : undefined,
                        endDate: endDate ? endDate.toISOString() : undefined,
                        ateSwVersion: selectedAteSwVersion || undefined,
                        Testspec: selectedTestspec || undefined,
                    },
                });
    
                console.log("Full API Response:", response.data);
    
                // Filter out step data where all values are zero
                const filteredData = response.data.filter(
                    (stepData) => stepData.values.some((value) => value !== 0)
                );
    
                setChartData(filteredData);
            } catch (error) {
                console.error('Error fetching control chart data:', error);
            }
        };
    
        fetchControlChartData();
    }, [lsl, usl, startDate, endDate, selectedAteSwVersion, selectedTestspec]);
    
    
    const handleApplyLimits = () => {
        setLsl(tempLsl);
        setUsl(tempUsl);
        setSelectedAteSwVersion(selectedAteSwVersion);
        setSelectedTestspec(selectedTestspec);
    };
    

    const handleStepNumberChange = (e) => {
        setSelectedStepNumber(e.target.value);
    };

    const handleApplyDateFilter = () => {
        setStartDate(tempStartDate);
        setEndDate(tempEndDate);
    };

    const handleResetDateFilter = () => {
        // Reset temporary date states and main date states to null or default
        setTempStartDate(null);
        setTempEndDate(null);
        setStartDate(null);
        setEndDate(null);
    };

    const handleResetLimits = () => {
        // Reset both the LSL and USL states and temporary input values
        console.log("Resetting to default LSL and USL:", defaultLsl, defaultUsl);
        setLsl(defaultLsl);
        setUsl(defaultUsl);
        setTempLsl(defaultLsl);
        setTempUsl(defaultUsl);
        setSelectedAteSwVersion('');
        setSelectedTestspec('');
    };

    // Validate LSL and USL inputs
    useEffect(() => {
        if (tempLsl && tempUsl && parseFloat(tempLsl) > parseFloat(tempUsl)) {
            setErrorMessage('LSL cannot be greater than USL.');
        } else {
            setErrorMessage('');
        }
    }, [tempLsl, tempUsl]);

    


    //calculator
    useEffect(() => {
        const fetchFilenames = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/filenames'); // Replace with your API endpoint
                setFilenames(response.data);
            } catch (error) {
                console.error('Error fetching filenames:', error);
            }
        };
        fetchFilenames();
    }, []);
    
    

    // Find the data for the selected step number
    const selectedData = chartData.find((stepData) => stepData.stepNumber === selectedStepNumber);
    
    return (
        <div className={styles.controlChartContainer}>
            {loading ? (
                <div className={styles.loadingScreen}>
                    <div className={styles.spinner}></div>
                    <p>Loading...</p>
                </div>
                ) : (
                    <div>
            <h2 className={styles.chartHeader}>Control Charts</h2>

            <div className={styles.filtersWrapper}>
    <div className={styles.filtersRow}>
        {/* Step Number Filter */}
        <div className={styles.filterItem}>
            <label htmlFor="stepNumberSelect" className={styles.filterLabel}>
                Step Number:
            </label>
            <select
                id="stepNumberSelect"
                value={selectedStepNumber}
                onChange={handleStepNumberChange}
                className={styles.selectDropdown}
            >
                {chartData.map((stepData) => (
                    <option key={stepData.stepNumber} value={stepData.stepNumber}>
                        Step {stepData.stepNumber}
                    </option>
                ))}
            </select>
        </div>

        {/* AteSwVersion Filter */}
        <div className={styles.filterItem}>
            <label htmlFor="ateSwVersionSelect" className={styles.filterLabel}>
                AteSwVersion:
            </label>
            <select
                id="ateSwVersionSelect"
                value={selectedAteSwVersion}
                onChange={(e) => setSelectedAteSwVersion(e.target.value)}
                className={styles.selectDropdown}
            >
                <option value="">All Versions</option>
                {ateSwVersions.map((version) => (
                    <option key={version.AteSwVersion} value={version.AteSwVersion}>
                        {version.AteSwVersion} ({version.count})
                    </option>
                ))}
            </select>
        </div>
                
        {/* Testspec Filter */}
        <div className={styles.filterItem}>
            <label htmlFor="testspecSelect" className={styles.filterLabel}>
                Testspec:
            </label>
            <select
                id="testspecSelect"
                value={selectedTestspec}
                onChange={(e) => setSelectedTestspec(e.target.value)}
                className={styles.selectDropdown}
            >
                <option value="">All Testspecs</option>
                {testspecs.map((testspec) => (
                    <option key={testspec.Testspec} value={testspec.Testspec}>
                        {testspec.Testspec} ({testspec.count})
                    </option>
                ))}
            </select>
        </div>
    </div>

    <div className={styles.filtersRow}>
        {/* Date Filter */}
        <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Start Date:</label>
            <DatePicker
                selected={tempStartDate}
                onChange={(date) => setTempStartDate(date)}
                placeholderText="Select Start Date"
                className={styles.dateInput}
            />
        </div>
        <div className={styles.filterItem}>
            <label className={styles.filterLabel}>End Date:</label>
            <DatePicker
                selected={tempEndDate}
                onChange={(date) => setTempEndDate(date)}
                placeholderText="Select End Date"
                className={styles.dateInput}
            />
        </div>
        <div className={styles.filterActions}>
            <button onClick={handleApplyDateFilter} className={styles.applyButton}>
                Apply Date Filter
            </button>
            <button onClick={handleResetDateFilter} className={styles.resetButton}>
                Reset to Default
            </button>
        </div>
    </div>
    

    <div className={styles.filtersRow}>
        {/* LSL and USL Inputs */}
        <div className={styles.calculatorContainer}>
    <h3 className={styles.calculatorTitle}>Set Specification Limits</h3>

    <div className={styles.filterRow}>
        <div className={styles.filterItem}>
            <label className={styles.filterLabel}>LSL:</label>
            <input
                type="number"
                value={tempLsl}
                onChange={(e) => setTempLsl(e.target.value)}
                className={styles.input}
            />
        </div>
        
        <div className={styles.filterItem}>
            <label className={styles.filterLabel}>USL:</label>
            <input
                type="number"
                value={tempUsl}
                onChange={(e) => setTempUsl(e.target.value)}
                className={styles.input}
            />
        </div>
    </div>
</div>

        <div className={styles.filterActions}>
            <button
                onClick={handleApplyLimits}
                disabled={!!errorMessage}
                className={`${styles.button} ${errorMessage ? styles.disabledButton : ''}`}
            >
                Apply Limits
            </button>
            <button onClick={handleResetLimits} className={styles.button}>
                Reset to Default
            </button>
        </div>
    </div>
    {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
</div>
{selectedData?.normalDistribution?.data?.length > 0 ? (
    <div className={styles.chartBox}>
        <h4 className={styles.chartTitle}>Normal Distribution Chart</h4>
        <Line
            data={{
                labels: selectedData.normalDistribution.data.map((point) => point.value.toFixed(2)),
                datasets: [
                    {
                        label: 'Density',
                        data: selectedData.normalDistribution.data.map((point) => point.density),
                        borderColor: 'blue',
                        backgroundColor: 'rgba(0, 0, 255, 0.1)',
                        pointRadius: 0,
                        fill: true,
                    },
                ],
            }}
            options={{
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Normal Distribution Curve',
                    },
                },
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: 'Density',
                        },
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Measure Value',
                        },
                    },
                },
            }}
        />
    </div>
) : (
    <p className={styles.noDataMessage}>No Normal Distribution Data Available</p>
)}

            {selectedData && (
                <div style={{ marginTop: '20px' }}>
                    <h3>Step Number: {selectedData.stepNumber}</h3>
                    <div className={styles.chartContainer}>
                        
                        {/* Individual Chart */}
                        <div className={styles.chartBox} ref={individualChartRef} >
                        <button onClick={() => openModal('individual')} className={styles.enlargeButton}>Make Bigger</button>
                        <button onClick={() => exportChartAsPNG(individualChartRef, 'individual_chart')} className={styles.enlargeButton}>Export as PNG</button>


                            <h4 className={styles.chartTitle}>Individual Chart</h4>
                            <Line
                                data={{
                                    labels: selectedData.serialNumbers, // Use serialNumbers on x-axis
                                    datasets: [
                                        {
                                            label: 'Individual Values',
                                            data: selectedData.values,
                                            borderColor: 'blue',
                                            backgroundColor: 'blue',
                                            pointRadius: 3,
                                            fill: false,
                                        },
                                        {
                                            label: 'CL',
                                            data: Array(selectedData.values.length).fill(selectedData.individualChart?.xBar || null),
                                            borderColor: 'green',
                                            borderDash: [5, 5],
                                            pointRadius: 0,
                                        },
                                        {
                                            label: 'UCL',
                                            data: Array(selectedData.values.length).fill(selectedData.individualChart?.ucl || null),
                                            borderColor: 'red',
                                            borderDash: [5, 5],
                                            pointRadius: 0,
                                        },
                                        {
                                            label: 'LCL',
                                            data: Array(selectedData.values.length).fill(selectedData.individualChart?.lcl || null),
                                            borderColor: 'red',
                                            borderDash: [5, 5],
                                            pointRadius: 0,
                                        },
                                        {
                                            label: 'LSL', // Lower Specification Limit
                                            data: Array(selectedData.values.length).fill(selectedData.lsl || null),
                                            borderColor: 'purple',
                                            borderDash: [10, 5],
                                            pointRadius: 0,
                                        },
                                        {
                                            label: 'USL', // Upper Specification Limit
                                            data: Array(selectedData.values.length).fill(selectedData.usl || null),
                                            borderColor: 'purple',
                                            borderDash: [10, 5],
                                            pointRadius: 0,
                                        },
                                    ],
                                }}
                                options={{
                                    responsive: true,
                                    plugins: {
                                        legend: {
                                            position: 'top',
                                        },
                                        title: {
                                            display: true,
                                            text: 'Individual Chart',
                                        },
                                    },
                                    scales: {
                                        y: {
                                            title: {
                                                display: true,
                                                text: 'Measure Value',
                                            },
                                        },
                                        x: {
                                            title: {
                                                display: true,
                                                text: 'Serial Number',
                                            },
                                        },
                                    },
                                }}
                            />


                            {/* Display Cp and Cpk values below the Individual Chart */}
                            <div className={styles.capabilityMetrics}>
                                <p><strong>Cp:</strong> {selectedData.cp ? selectedData.cp.toFixed(2) : 'N/A'}</p>
                                <p><strong>Cpk:</strong> {selectedData.cpk ? selectedData.cpk.toFixed(2) : 'N/A'}</p>
                            </div>
                        </div>

                        {/* MR Chart */}
                        <div className={styles.chartBox} ref={mrChartRef}>
                        
                            <button onClick={() => openModal('mr')} className={styles.enlargeButton}>Make Bigger</button>
                            <button onClick={() => exportChartAsPNG(mrChartRef, 'mr_chart')} className={styles.enlargeButton}>Export as PNG</button>

                            <h4 className={styles.chartTitle}>MR Chart</h4>
                            <Line
                                data={{
                                    labels: selectedData.serialNumbers.slice(1), // Use serialNumbers for MR chart
                                    datasets: [
                                        {
                                            label: 'Moving Range',
                                            data: selectedData.movingRanges,
                                            borderColor: 'purple',
                                            backgroundColor: 'purple',
                                            pointRadius: 3,
                                            fill: false,
                                        },
                                        {
                                            label: 'MR-bar (CL)',
                                            data: Array(selectedData.movingRanges.length).fill(selectedData.mrChart?.mrBar || null),
                                            borderColor: 'green',
                                            borderDash: [5, 5],
                                            pointRadius: 0,
                                        },
                                        {
                                            label: 'UCL',
                                            data: Array(selectedData.movingRanges.length).fill(selectedData.mrChart?.ucl || null),
                                            borderColor: 'red',
                                            borderDash: [5, 5],
                                            pointRadius: 0,
                                        },
                                    ],
                                }}
                                options={{
                                    responsive: true,
                                    plugins: {
                                        legend: {
                                            position: 'top',
                                        },
                                        title: {
                                            display: true,
                                            text: 'Moving Range (MR) Chart',
                                        },
                                    },
                                    scales: {
                                        y: {
                                            title: {
                                                display: true,
                                                text: 'Moving Range',
                                            },
                                        },
                                        x: {
                                            title: {
                                                display: true,
                                                text: 'Serial Number',
                                            },
                                        },
                                    },
                                }}
                            />
                        </div>
                    </div>
                    
                    <Modal
    isOpen={isModalOpen}
    onRequestClose={closeModal}
    contentLabel="Enlarged Chart"
    className={styles.modalContent}
    overlayClassName={styles.modalOverlay}
>
    <button onClick={closeModal} className={styles.closeButton}>Close</button>

    {modalContent === 'individual' && (
        <div>
            <h4>Individual Chart (Enlarged)</h4>
            <Line
                data={{
                    labels: selectedData.serialNumbers,
                    datasets: [
                        { label: 'Individual Values', data: selectedData.values, borderColor: 'blue', pointRadius: 3 },
                        { label: 'CL', data: Array(selectedData.values.length).fill(selectedData.individualChart?.xBar || null), borderColor: 'green', borderDash: [5, 5], pointRadius: 0 },
                        { label: 'UCL', data: Array(selectedData.values.length).fill(selectedData.individualChart?.ucl || null), borderColor: 'red', borderDash: [5, 5], pointRadius: 0 },
                        { label: 'LCL', data: Array(selectedData.values.length).fill(selectedData.individualChart?.lcl || null), borderColor: 'red', borderDash: [5, 5], pointRadius: 0 },
                        { label: 'LSL', data: Array(selectedData.values.length).fill(selectedData.lsl || null), borderColor: 'purple', borderDash: [10, 5], pointRadius: 0 },
                        { label: 'USL', data: Array(selectedData.values.length).fill(selectedData.usl || null), borderColor: 'purple', borderDash: [10, 5], pointRadius: 0 },
                    ],
                }}
                options={{
                    responsive: true,
                    plugins: { legend: { position: 'top' } },
                }}
            />
        </div>
    )}

    {modalContent === 'mr' && (
        <div>
            <h4>MR Chart (Enlarged)</h4>
            <Line
                data={{
                    labels: selectedData.serialNumbers.slice(1),
                    datasets: [
                        {
                            label: 'Moving Range',
                            data: selectedData.movingRanges,
                            borderColor: 'purple',
                            pointRadius: 3,
                        },
                        {
                            label: 'MR-bar (CL)',
                            data: Array(selectedData.movingRanges.length).fill(selectedData.mrChart?.mrBar || null),
                            borderColor: 'green',
                            borderDash: [5, 5],
                            pointRadius: 0,
                        },
                        {
                            label: 'UCL',
                            data: Array(selectedData.movingRanges.length).fill(selectedData.mrChart?.ucl || null),
                            borderColor: 'red',
                            borderDash: [5, 5],
                            pointRadius: 0,
                        },
                    ],
                }}
                options={{
                    responsive: true,
                    plugins: {
                        legend: { position: 'top' },
                        title: { display: true, text: 'Moving Range (MR) Chart' },
                    },
                    scales: {
                        y: {
                            title: { display: true, text: 'Moving Range' },
                        },
                        x: {
                            title: { display: true, text: 'Serial Number' },
                        },
                    },
                }}
            />
        </div>
    )}
</Modal>


<button onClick={() => setIsCalculatorModalOpen(true)} className={styles.calculatorButton}>
    Open Control Limits Calculator
</button>


<Modal
    isOpen={isCalculatorModalOpen}
    onRequestClose={() => {
        setErrorMessage(''); // Clear error message when modal closes
        setIsCalculatorModalOpen(false);
    }}
    className={styles.modal2}
    overlayClassName={styles.overlay2}
>
    <h2 className={styles.modalTitle}>UCL/LCL Calculator</h2>
    <div>
        <label className={styles.label}>Step Number:</label>
        <p className={styles.text}>{selectedStepNumber || "No step number selected"}</p>
    </div>
    <div className={styles.fileList}>
        <div className={styles.sortContainer}>
            <label className={styles.label}>Select Files:</label>
            <button
                className={styles.sortButton}
                onClick={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
            >
                Sort by: {sortOrder === 'newest' ? 'Oldest' : 'Newest'}
            </button>
        </div>
        <div className={styles.fileTable}>
            {sortedFilenames.map((file, index) => (
                <div key={index} className={styles.fileRow}>
                    <input
                        type="checkbox"
                        id={`file-${index}`}
                        value={file.filename}
                        onChange={(e) => {
                            const isChecked = e.target.checked;
                            if (isChecked) {
                                setSelectedFilenames((prev) => [...prev, file.filename]);
                            } else {
                                setSelectedFilenames((prev) =>
                                    prev.filter((name) => name !== file.filename)
                                );
                            }
                        }}
                        className={styles.checkbox}
                    />
                    <label htmlFor={`file-${index}`} className={styles.fileLabel}>
                        <span className={styles.fileName}>{file.filename}</span>
                        <span className={styles.fileDetail}>Serial Number: {file.serialNumber}</span>
                        <span className={styles.fileDetail}>Test Started: {file.testStarted}</span>
                        <span className={styles.fileDetail}>AteSwVersion: {file.AteSwVersion}</span>
                    </label>
                </div>
            ))}
        </div>
    </div>

    {/* Error Message Section */}
    {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}

    <button
        onClick={async () => {
            try {
                if (!selectedStepNumber) {
                    setErrorMessage('No step number selected. Please select a step number.');
                    return;
                }

                if (!selectedFilenames.length) {
                    setErrorMessage('No files selected. Please select at least one file.');
                    return;
                }

                const response = await axios.post('http://localhost:3001/api/calculate-ucl-lcl', {
                    selectedFilenames,
                    stepNumber: selectedStepNumber,
                });

                if (response.data?.results) {
                    navigate('/new-control-chart', { state: { results: response.data.results } });
                } else {
                    setErrorMessage('No data returned from the backend for the selected test.');
                }
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    setErrorMessage('No data found for the selected filenames and step number.');
                } else {
                    setErrorMessage('An error occurred during the calculation.');
                }
                console.error('Error calculating UCL and LCL:', error);
            }
        }}
        className={styles.confirmButton}
    >
        Confirm
    </button>
    <button onClick={() => {
        setErrorMessage(''); // Clear error message when modal closes
        setIsCalculatorModalOpen(false);
    }} className={styles.closeButton}>
        Close
    </button>
</Modal>



<div className={styles.exportButtons}>
    <button onClick={exportTableAsCSV} className={styles.applyButton}>Export Table as CSV</button>
    <button onClick={exportTableAsPDF} className={styles.applyButton}>Export Table as PDF</button>
    <button onClick={() => setShowTable(!showTable)} className={styles.applyButton}>
        {showTable ? 'Hide Table' : 'Show Table'}
    </button>
</div>

                    {/* Display extracted values and serial numbers in a table below the chart */}
                    {showTable && (
    <div className={styles.tableContainer}>
        <h4 className={styles.tableHeader}>Extracted Values for Step {selectedData.stepNumber}</h4>
        <table className={styles.dataTable}>
            <thead>
                <tr>
                    <th>Serial Number</th>
                    <th>Observation</th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
                {selectedData.values.map((value, index) => (
                    <tr key={index}>
                        <td>{selectedData.serialNumbers ? selectedData.serialNumbers[index] : 'N/A'}</td>
                        <td>{index + 1}</td>
                        <td>{value}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
)}

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
            This page provides a comprehensive analysis of the stability and process capability of hardware tests, using Individual and Moving Range (MR) control charts:
        </p>
        <ul>
            <li>
                <strong>Individual Chart:</strong> Visualizes individual measurements of test values for each serial number along with control limits (UCL, LCL) and specification limits (USL, LSL).
            </li>
            <li>
                <strong>MR Chart:</strong> Displays the moving range of test values to analyze process variability and stability.
            </li>
            <li>
                <strong>Data Table:</strong> Provides a detailed breakdown of individual values, serial numbers, and calculated metrics (e.g., Cp, Cpk).
            </li>
            <li>
                <strong>Filters:</strong> Customize the analysis with:
                <ul>
                    <li><strong>Date Range:</strong> Focus on a specific time period.</li>
                    <li><strong>ATE SW Version:</strong> Analyze data by software version.</li>
                    <li><strong>Specification Limits (USL, LSL):</strong> Update and visualize control charts with custom specification limits.</li>
                </ul>
            </li>
            <li>
                <strong>Calculator Features:</strong> 
                <ul>
                    <li><strong>USL/LSL Calculator:</strong> Dynamically adjust the Upper Specification Limit (USL) and Lower Specification Limit (LSL) and instantly update the charts to reflect changes.</li>
                    <li><strong>UCL/LCL Calculator:</strong> Calculate and modify the Upper Control Limit (UCL) and Lower Control Limit (LCL) for both Individual and Moving Range charts, enabling precise control limit analysis.</li>
                </ul>
            </li>
            <li>
                <strong>Export Options:</strong> Download the table as CSV or PDF and export charts as PNG for documentation or reporting.
            </li>
        </ul>
        <p>
            Use this tool to monitor process stability, identify outliers, and assess the capability of the testing process.
        </p>
    </div>
</Modal>


</div>
            )}
        </div>
    );
};

export default ControlChart;

