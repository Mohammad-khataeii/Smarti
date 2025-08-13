import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';
import styles from './SerialPassFailChart.module.css';
import Modal from 'react-modal';

ChartJS.register(ArcElement, Tooltip, Legend);

const SerialPassFailChart = () => {
    const [data, setData] = useState({ PASS: 0, FAIL: 0 });
    const [totalProduction, setTotalProduction] = useState(0);
    const [error, setError] = useState(null);
    const [drillDownData, setDrillDownData] = useState(null);
    const [selectedStatus, setSelectedStatus] = useState(null);
    const [isTableVisible, setIsTableVisible] = useState(true);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [ateSwVersion, setAteSwVersion] = useState('');
    const [ateSwVersions, setAteSwVersions] = useState([]);
    const [serialNumbers, setSerialNumbers] = useState([]);
    const [selectedSerialNumbers, setSelectedSerialNumbers] = useState([]);
    const [resetting, setResetting] = useState(false); // New state to track reset
    const [isHelpOpen, setIsHelpOpen] = useState(false); 
    const [loading, setLoading] = useState(true); // Add this to track loading state

    const openHelp = () => setIsHelpOpen(true); 
    const closeHelp = () => setIsHelpOpen(false);
    const chartRef = useRef(null);


    useEffect(() => {
        // Simulate data fetching
        setTimeout(() => {
            setLoading(false); // Set loading to false when data is ready
        }, 2000); // Simulate a 2-second delay
    }, []);
    
    // Fetch ATE SW versions and distinct serial numbers on mount
    useEffect(() => {
        const fetchAteSwVersions = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/ate-sw-versions');
                setAteSwVersions(response.data.map(version => ({ value: version.AteSwVersion, label: version.AteSwVersion })));
            } catch (error) {
                console.error('Error fetching ATE SW versions:', error);
            }
        };

        const fetchSerialNumbers = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/distinct-serial-numbers');
                setSerialNumbers(response.data.map(sn => ({ value: sn, label: sn })));
            } catch (error) {
                console.error('Error fetching serial numbers:', error);
            }
        };

        fetchAteSwVersions();
        fetchSerialNumbers();
        fetchData(); // Load data for the default (all-time) view
        fetchTotalProduction();
    }, []);

    const resetFilters = () => {
        // Clear filter states
        setStartDate(null);
        setEndDate(null);
        setAteSwVersion('');
        setSelectedSerialNumbers([]);
        setResetting(true); // Set resetting to true to trigger useEffect
    };

    // useEffect to fetch default data when resetting changes to true
    useEffect(() => {
        if (resetting) {
            // Fetch default (all-time) data
            fetchData({ startDate: null, endDate: null, ateSwVersion: null, serialNumbers: [] });
            fetchTotalProduction({ startDate: null, endDate: null, ateSwVersion: null, serialNumbers: [] });
            setResetting(false); // Reset flag to false after fetching
        }
    }, [resetting]);

    const fetchData = async (filters = {}) => {
        try {
            const response = await axios.get('http://localhost:3001/api/uut-status-count', {
                params: {
                    startDate: filters.startDate || (startDate ? startDate.toISOString().split('T')[0] : null),
                    endDate: filters.endDate || (endDate ? endDate.toISOString().split('T')[0] : null),
                    ateSwVersion: filters.ateSwVersion || ateSwVersion || null,
                    serialNumbers: filters.serialNumbers || selectedSerialNumbers.map(sn => sn.value),
                }
            });
            setData(response.data);
        } catch (error) {
            console.error('Error fetching UUT status count:', error);
            setError('Failed to load data. Please try again later.');
        }
    };

    const fetchTotalProduction = async (filters = {}) => {
        try {
            const response = await axios.get('http://localhost:3001/api/total-production', {
                params: {
                    startDate: filters.startDate || (startDate ? startDate.toISOString().split('T')[0] : null),
                    endDate: filters.endDate || (endDate ? endDate.toISOString().split('T')[0] : null),
                    ateSwVersion: filters.ateSwVersion || ateSwVersion || null,
                    serialNumbers: filters.serialNumbers || selectedSerialNumbers.map(sn => sn.value),
                }
            });
            setTotalProduction(response.data.totalProduction);
        } catch (error) {
            console.error('Error fetching total production:', error);
        }
    };

    const applyFilters = () => {
        fetchData();
        fetchTotalProduction();
    };

    const handleChartClick = async (elements) => {
        if (elements.length === 0) return;
        const clickedSegmentIndex = elements[0].index;
        const status = clickedSegmentIndex === 0 ? 'PASS' : 'FAIL';
        setSelectedStatus(status);

        try {
            const response = await axios.get('http://localhost:3001/api/uut-status-details', {
                params: {
                    status,
                    startDate: startDate ? startDate.toISOString().split('T')[0] : null,
                    endDate: endDate ? endDate.toISOString().split('T')[0] : null,
                    ateSwVersion: ateSwVersion || null,
                    serialNumbers: selectedSerialNumbers.map(sn => sn.value),
                }
            });
            setDrillDownData(response.data.sort((a, b) => b.count - a.count));
        } catch (error) {
            console.error('Error fetching drill-down data:', error);
            setError('Failed to load drill-down data.');
        }
    };

    const exportChartAsPNG = async () => {
        if (chartRef.current) {
            const canvas = await html2canvas(chartRef.current);
            canvas.toBlob(blob => {
                saveAs(blob, 'chart.png');
            });
        }
    };

    const exportTableAsCSV = () => {
        if (!drillDownData) return;
        const csvRows = [['Serial Number', 'Count'], ...drillDownData.map(row => [row.serialNumber, row.count])];
        const csvContent = csvRows.map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${selectedStatus}-data.csv`);
    };

    const exportTableAsPDF = () => {
        const doc = new jsPDF();
        doc.text(`${selectedStatus} Details`, 10, 10);
        doc.autoTable({
            head: [['Serial Number', 'Count']],
            body: drillDownData.map(row => [row.serialNumber, row.count]),
            startY: 20,
        });
        doc.save(`${selectedStatus}-data.pdf`);
    };

    const toggleTableVisibility = () => {
        setIsTableVisible(!isTableVisible);
    };

    const chartData = {
        labels: ['Pass (%)', 'Fail (%)'],
        datasets: [
            {
                data: [data.PASS, data.FAIL],
                backgroundColor: ['#4CAF50', '#F44336'],
                hoverBackgroundColor: ['#66BB6A', '#E57373'],
            },
        ],
    };

    return (
        <div className={styles.container}>
            {loading ? (
                <div className={styles.loadingScreen}>
                    <div className={styles.spinner}></div>
                    <p>Loading...</p>
                </div>
            ) : (
                <div>
                    <h2 className={styles.title}>Pie Chart Analysis</h2>
                    {error && <div className={styles.errorMessage}>{error}</div>}

                    {/* Filter Controls */}
                    <div className={styles.filterContainer}>
                        <div className={styles.filterItem}>
                            <label>Start Date:</label>
                            <DatePicker
                                selected={startDate}
                                onChange={(date) => setStartDate(date)}
                                dateFormat="yyyy-MM-dd"
                                placeholderText="Select Start Date"
                                className={styles.datePicker}
                            />
                        </div>
                        <div className={styles.filterItem}>
                            <label>End Date:</label>
                            <DatePicker
                                selected={endDate}
                                onChange={(date) => setEndDate(date)}
                                dateFormat="yyyy-MM-dd"
                                placeholderText="Select End Date"
                                className={styles.datePicker}
                            />
                        </div>
                        <div className={styles.filterItem}>
                            <label>ATE SW Version:</label>
                            <select
                                value={ateSwVersion}
                                onChange={(e) => setAteSwVersion(e.target.value)}
                                className={styles.dropdown}
                            >
                                <option value="">Select Version</option>
                                {ateSwVersions.map(version => (
                                    <option key={version.value} value={version.value}>
                                        {version.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.filterItem}>
                            <label>Serial Numbers:</label>
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

                    <div className={styles.filterButtons}>
                        <button onClick={applyFilters} className={styles.applyButton}>Apply Filters</button>
                        <button onClick={resetFilters} className={styles.resetButton}>Reset to Default</button>
                    </div>

                    <div className={styles.chartContainer} ref={chartRef}>
                        <Pie 
                            data={chartData} 
                            options={{
                                responsive: true,
                                onClick: (event, elements) => handleChartClick(elements),
                            }} 
                        />
                    </div>

                    <h3>Total Production: {totalProduction}</h3>

                    <div className={styles.exportButtons}>
                        <button onClick={exportChartAsPNG} className={styles.exportButton}>Download Chart as PNG</button>
                        <button onClick={exportTableAsCSV} className={styles.exportButton}>Export Table as CSV</button>
                        <button onClick={exportTableAsPDF} className={styles.exportButton}>Export Table as PDF</button>
                        <button onClick={toggleTableVisibility} className={styles.exportButton}>
                            {isTableVisible ? 'Hide Table' : 'Show Table'}
                        </button>
                    </div>

                    {isTableVisible && drillDownData && (
                        <div className={styles.drillDownSection}>
                            <h3 className={styles.subtitle}>{selectedStatus} Details</h3>
                            <table className={styles.drillDownTable}>
                                <thead>
                                    <tr>
                                        <th>Serial Number</th>
                                        <th>Count</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {drillDownData.map((row, index) => (
                                        <tr key={index}>
                                            <td>{row.serialNumber}</td>
                                            <td>{row.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                                This page provides a detailed analysis of the test results for hardware units, focusing on the overall **PASS** and **FAIL** outcomes:
                            </p>
                            <ul>
                                <li><strong>Pie Chart:</strong> Visual representation of the percentage of PASS and FAIL outcomes across all tests.</li>
                                <li><strong>Total Production:</strong> Displays the total count of unique hardware units tested during the selected period.</li>
                                <li><strong>Drill-Down Table:</strong> Detailed breakdown of test results for individual hardware units, categorized by their serial numbers.</li>
                                <li><strong>Filters:</strong> Customize the analysis by applying:
                                    <ul>
                                        <li><strong>Date Range:</strong> Filter tests by their execution dates.</li>
                                        <li><strong>ATE SW Version:</strong> Focus on tests conducted with specific software versions.</li>
                                        <li><strong>Serial Numbers:</strong> Analyze results for selected hardware units.</li>
                                    </ul>
                                </li>
                                <li><strong>Export Options:</strong> Download the chart as a PNG image or export the drill-down table as CSV or PDF for further analysis.</li>
                            </ul>
                            <p>
                                Use this tool to gain insights into test performance, identify areas for improvement, and generate reports for hardware testing quality.
                            </p>
                        </div>
                    </Modal>
                </div>
            )}
        </div>
    );
};

export default SerialPassFailChart;
