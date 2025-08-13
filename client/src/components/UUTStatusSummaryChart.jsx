import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Modal from 'react-modal';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Select from 'react-select'; // Import react-select
import styles from './UUTStatusSummaryChart.module.css';
import html2canvas from 'html2canvas';
import ReactLoading from 'react-loading'; // Import react-loading

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

Modal.setAppElement('#root');

const UUTStatusSummaryChart = () => {
    const [summaryData, setSummaryData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showTable, setShowTable] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [serialNumbers, setSerialNumbers] = useState([]);
    const [selectedSerialNumbers, setSelectedSerialNumbers] = useState([]);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const chartRef = useRef(null);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const openHelp = () => setIsHelpOpen(true);
    const closeHelp = () => setIsHelpOpen(false);

    const fetchSummaryData = async () => {
        setLoading(true); // Start loading state
        try {
            const response = await axios.get('http://localhost:3001/api/uut-status-summary', {
                params: {
                    startDate: startDate ? startDate.toISOString().split('T')[0] : null,
                    endDate: endDate ? endDate.toISOString().split('T')[0] : null,
                    serialNumbers: selectedSerialNumbers.map(sn => sn.value).join(',')
                }
            });
            
            // Simulate a 5-second delay before setting loading to false
            setTimeout(() => {
                setSummaryData(response.data);
                setLoading(false); // End loading state after 5 seconds
            }, 5000); // 5000 milliseconds = 5 seconds
            
        } catch (err) {
            console.error('Error fetching UUT status summary:', err);
            setError('Failed to load data. Please try again later.');
            setLoading(false); // End loading state on error
        }
    };
    

    const fetchSerialNumbers = async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/serial-numbers');
            setSerialNumbers(response.data.map(sn => ({ value: sn, label: sn })));
        } catch (error) {
            console.error('Error fetching serial numbers:', error);
        }
    };

    useEffect(() => {
        fetchSerialNumbers();
    }, []);

    useEffect(() => {
        fetchSummaryData();
    }, [startDate, endDate, selectedSerialNumbers]);

    const handleSerialNumbersChange = (selectedOptions) => {
        setSelectedSerialNumbers(selectedOptions);
    };

    const getChartData = () => ({
        labels: summaryData.map(data => data.serialNumber),
        datasets: [
            {
                label: 'PASS',
                data: summaryData.map(data => data.passCount),
                backgroundColor: 'rgba(75, 192, 192, 0.6)', // Green for PASS
            },
            {
                label: 'FAIL',
                data: summaryData.map(data => data.failCount),
                backgroundColor: 'rgba(255, 99, 132, 0.6)', // Red for FAIL
            },
            {
                label: 'STOP',
                data: summaryData.map(data => data.stopCount),
                backgroundColor: 'rgba(79, 35, 156, 0.6)', // Red for FAIL
            },
        ],
    });

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    const exportChartAsPNG = async () => {
        if (chartRef.current) {
            const canvas = await html2canvas(chartRef.current);
            canvas.toBlob(blob => {
                saveAs(blob, 'uut-status-summary-chart.png');
            });
        }
    };

    const exportTableAsCSV = () => {
        const csvRows = [
            ['Serial Number', 'PASS Count', 'FAIL Count', 'STOP Count'],
            ...summaryData.map(data => [
                data.serialNumber,
                data.passCount,
                data.failCount,
                data.stopCount
            ])
        ];

        const csvContent = csvRows.map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'uut_status_summary.csv');
    };

    const exportTableAsPDF = () => {
        const doc = new jsPDF();
        const tableColumn = ['Serial Number', 'PASS Count', 'FAIL Count', 'STOP Count'];
        const tableRows = summaryData.map(data => [
            data.serialNumber,
            data.passCount,
            data.failCount,
            data.stopCount
        ]);

        doc.text('UUT Status Summary', 14, 15);
        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 20,
        });

        doc.save('uut_status_summary.pdf');
    };

    const handleApplyFilters = () => {
        fetchSummaryData(); // Re-fetch data with the current filter values
    };

    const resetFilters = () => {
        setStartDate(null);
        setEndDate(null);
        setSelectedSerialNumbers([]);
        fetchSummaryData(); // Re-fetch data with reset filters
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.pageTitle}>UUT Status Summary</h2>

            <div className={styles.filters}>
                {/* Date Picker for Start Date */}
                <div className={styles.datePickerContainer}>
                    <label>Select Start Date:</label>
                    <DatePicker
                        selected={startDate}
                        onChange={(date) => setStartDate(date)}
                        dateFormat="yyyy-MM-dd"
                        placeholderText="Start Date"
                        className={styles.datePicker}
                    />
                </div>

                {/* Date Picker for End Date */}
                <div className={styles.datePickerContainer}>
                    <label>Select End Date:</label>
                    <DatePicker
                        selected={endDate}
                        onChange={(date) => setEndDate(date)}
                        dateFormat="yyyy-MM-dd"
                        placeholderText="End Date"
                        className={styles.datePicker}
                    />
                </div>

                {/* Serial Numbers Multi-Select Dropdown using react-select */}
                <div className={styles.dropdownContainer}>
                    <label>Select Serial Numbers:</label>
                    <Select
                        isMulti
                        options={serialNumbers}
                        value={selectedSerialNumbers}
                        onChange={handleSerialNumbersChange}
                        placeholder="Select Serial Numbers"
                        className={styles.multiSelect}
                    />
                </div>

                {/* Apply Filter and Reset Buttons */}
                <div className={styles.filterButtons}>
                    <button onClick={handleApplyFilters} className={styles.applyFilterButton}>Apply Filters</button>
                    <button onClick={resetFilters} className={styles.resetFilterButton}>Reset to Default</button>
                </div>
            </div>

            {/* Loading State */}
            {loading ? (
                <div className={styles.loadingScreen}>
                <div className={styles.spinner}></div>
                <p>Loading...</p>
            </div>
            
            ) : (
                <div className={styles.chartContainer} ref={chartRef}>
                    <Bar
                        data={getChartData()}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'top',
                                },
                            },
                        }}
                    />
                </div>
            )}

            <button onClick={openModal} className={styles.expandButton}>Expand Chart</button>

            <div className={styles.exportButtons}>
                <button onClick={exportChartAsPNG} className={styles.applyFilterButton}>Export Chart as PNG</button>
                <button onClick={() => setShowTable(!showTable)} className={styles.viewTableButton}>
                    {showTable ? 'Hide Table' : 'Show Table'}
                </button>
                {showTable && (
                    <>
                        <button onClick={exportTableAsCSV} className={styles.applyFilterButton}>Export Table as CSV</button>
                        <button onClick={exportTableAsPDF} className={styles.applyFilterButton}>Export Table as PDF</button>
                    </>
                )}
            </div>

            {showTable && (
                <table className={styles.styledTable}>
                    <thead>
                        <tr>
                            <th className={styles.styledTableTh}>Serial Number</th>
                            <th className={styles.styledTableTh}>PASS Count</th>
                            <th className={styles.styledTableTh}>FAIL Count</th>
                            <th className={styles.styledTableTh}>STOP Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        {summaryData.map((data, index) => (
                            <tr key={index}>
                                <td className={styles.styledTableTd}>{data.serialNumber}</td>
                                <td className={styles.styledTableTd}>{data.passCount}</td>
                                <td className={styles.styledTableTd}>{data.failCount}</td>
                                <td className={styles.styledTableTd}>{data.stopCount}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            <Modal
                isOpen={isModalOpen}
                onRequestClose={closeModal}
                className={styles.modalContent}
                overlayClassName={styles.modalOverlay}
                contentLabel="Expanded UUT Status Summary Chart"
            >
                <button onClick={closeModal} className={styles.closeButton}>Close</button>
                <div className={styles.expandedChartContainer}>
                    <Bar
                        data={getChartData()}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: true, position: 'top' },
                            },
                        }}
                    />
                </div>
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
                    <h2>About this Page</h2>
                    <p>
                        This page provides a comprehensive analysis of hardware test data:
                    </p>
                    <ul>
                        <li><strong>Bar Chart:</strong> Visual representation of PASS and FAIL counts for each hardware unit (serial number).</li>
                        <li><strong>Table:</strong> Detailed PASS and FAIL counts in a structured format.</li>
                        <li><strong>Filters:</strong> Customize the data displayed by date range and specific serial numbers.</li>
                        <li><strong>Export Options:</strong> Download the data as PNG, CSV, or PDF for reporting or documentation.</li>
                    </ul>
                    <p>
                        Use this tool to identify trends and improve hardware testing processes.
                    </p>
                </div>
            </Modal>

        </div>
    );
};

export default UUTStatusSummaryChart;