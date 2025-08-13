import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation'; // Import annotation plugin
import Modal from 'react-modal';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';
import styles from './ParetoChart.module.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    annotationPlugin // Register the annotation plugin
);

// Set app element for accessibility
Modal.setAppElement('#root');

const ParetoChart = () => {
    const [paretoData, setParetoData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showTable, setShowTable] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [ateSwVersion, setAteSwVersion] = useState('');
    const [serialNumbers, setSerialNumbers] = useState([]);
    const [selectedSerialNumbers, setSelectedSerialNumbers] = useState([]);
    const chartRef = useRef(null);

    const [isHelpOpen, setIsHelpOpen] = useState(false); 
    const openHelp = () => setIsHelpOpen(true); 
    const closeHelp = () => setIsHelpOpen(false);

        // States for serial numbers and AteSwVersion
        const [selectedAteSwVersion, setSelectedAteSwVersion] = useState('');
        const [ateSwVersions, setAteSwVersions] = useState([]); // Store all distinct AteSwVersion values
        // States for serial numbers and Testspec
        const [selectedTestspec, setSelectedTestspec] = useState('');
        const [testspecs, setTestspecs] = useState([]); // Store all distinct Testspec values

        
        useEffect(() => {
            const fetchAteSwVersions = async () => {
                try {
                    const response = await axios.get('http://localhost:3001/api/ate-sw-versions');
                    setAteSwVersions(response.data.map(version => ({ value: version.AteSwVersion, label: version.AteSwVersion })));
                } catch (error) {
                    console.error('Error fetching AteSwVersion data:', error);
                }
            };
        
            fetchAteSwVersions();
        }, []); // Fetch AteSwVersions once on component mount
        
        useEffect(() => {
            const fetchSerialNumbers = async () => {
                try {
                    const response = await axios.get('http://localhost:3001/api/distinct-serial-numbers');
                    setSerialNumbers(response.data.map(sn => ({ value: sn, label: sn })));
                } catch (error) {
                    console.error('Error fetching serial numbers:', error);
                }
            };
        
            fetchSerialNumbers();
        }, []); // Fetch serial numbers once on component mount
        
        const fetchParetoData = async () => {
            setLoading(true);
            try {
                const response = await axios.get('http://localhost:3001/api/pareto-failure-analysis', {
                    params: {
                        startDate: startDate ? startDate.toISOString().split('T')[0] : null,
                        endDate: endDate ? endDate.toISOString().split('T')[0] : null,
                        ateSwVersion: ateSwVersion || null,
                        serialNumbers: selectedSerialNumbers.map(sn => sn.value).join(','), // Send as comma-separated string
                    },
                });
        
                setParetoData(response.data); // Update paretoData state
            } catch (err) {
                console.error('Failed to fetch Pareto data:', err);
                setError('Failed to load data. Please try again later.');
            } finally {
                setLoading(false);
            }
        };
        
        
        useEffect(() => {
            fetchParetoData();
        }, []); // Automatically fetch data when filters change
        

        const handleApplyFilters = () => {
            console.log('Applying filters:', {
                startDate,
                endDate,
                ateSwVersion,
                selectedSerialNumbers,
            });
        
            // Fetch Pareto data with the current filter values
            fetchParetoData();
        };
        
        
        const resetFilters = () => {
            console.log('Resetting filters to default');
        
            setStartDate(() => null);
            setEndDate(() => null);
            setAteSwVersion(() => '');
            setSelectedSerialNumbers(() => []);
        
            fetchParetoData(); // Safe to call immediately since states are updated together
        };
        
        
        

    const getChartData = () => {
        const eightyPercentIndex = paretoData.findIndex(data => data.cumulativePercentage >= 80);

        return {
            labels: paretoData.map(data => data.stepNumber),
            datasets: [
                {
                    label: 'Fail Count',
                    data: paretoData.map(data => data.failCount),
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    yAxisID: 'y',
                    type: 'bar',
                },
                {
                    label: 'Cumulative Fail Percentage',
                    data: paretoData.map(data => data.cumulativePercentage),
                    type: 'line',
                    fill: false,
                    borderColor: 'rgba(54, 162, 235, 0.8)',
                    backgroundColor: 'rgba(54, 162, 235, 0.8)',
                    yAxisID: 'y1',
                    tension: 0.4,
                },
            ],
            eightyPercentIndex,
        };
    };

    const chartOptions = {
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
                title: { display: true, text: 'Cumulative Fail Percentage' },
            },
        },
        plugins: {
            legend: { display: true, position: 'top' },
            annotation: {
                annotations: {
                    eightyPercentLine: {
                        type: 'line',
                        xMin: getChartData().eightyPercentIndex,
                        xMax: getChartData().eightyPercentIndex,
                        borderColor: 'rgba(255, 165, 0, 0.8)', // Orange color for the line
                        borderWidth: 2,
                        label: {
                            enabled: true,
                            content: '80% Cumulative',
                            position: 'top',
                            backgroundColor: 'rgba(255, 165, 0, 0.8)',
                            color: '#000',
                        },
                    },
                },
            },
        },
    };

    const openModal = () => {
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    useEffect(() => {
        // Simulate a 7 seconds loading time
        setTimeout(() => {
            setLoading(false);  // Hide loading animation after 7 seconds
        }, 7000);
    }, []);

    const exportChartAsPNG = async () => {
        if (chartRef.current) {
            const canvas = await html2canvas(chartRef.current);
            canvas.toBlob(blob => {
                saveAs(blob, 'pareto-chart.png');
            });
        }
    };

    const exportTableAsCSV = () => {
        const csvRows = [
            ['Step Number', 'Total Count', 'Fail Count', 'Fail Percentage', 'Cumulative Percentage'],
            ...paretoData.map(data => [
                data.stepNumber,
                data.totCount || 0,
                data.failCount || 0,
                Number(data.failPercentage || 0).toFixed(2) + '%',
                Number(data.cumulativePercentage || 0).toFixed(2) + '%'
            ])
        ];
        const csvContent = csvRows.map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'pareto_data.csv');
    };

    const exportTableAsPDF = () => {
        const doc = new jsPDF();
        const tableColumn = ['Step Number', 'Total Count', 'Fail Count', 'Fail Percentage', 'Cumulative Percentage'];
        const tableRows = paretoData.map(data => [
            data.stepNumber,
            data.totCount || 0,
            data.failCount || 0,
            Number(data.failPercentage || 0).toFixed(2) + '%',
            Number(data.cumulativePercentage || 0).toFixed(2) + '%'
        ]);
        doc.text('Pareto Failure Analysis', 14, 15);
        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 20,
        });
        doc.save('pareto_data.pdf');
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.pageTitle}>Pareto Failure Analysis</h2>
            
            <div className={styles.datePickerContainer}>
    <DatePicker
        selected={startDate}
        onChange={(date) => setStartDate(date)} // Update state but do not fetch data
        dateFormat="yyyy-MM-dd"
        placeholderText="Start Date"
        className={styles.filterInput}
    />
    <DatePicker
        selected={endDate}
        onChange={(date) => setEndDate(date)} // Update state but do not fetch data
        dateFormat="yyyy-MM-dd"
        placeholderText="End Date"
        className={styles.filterInput}
    />
    <select
        value={ateSwVersion}
        onChange={(e) => setAteSwVersion(e.target.value)} // Update state but do not fetch data
        className={styles.dropdown}
    >
        <option value="">Select ATE SW Version</option>
        {ateSwVersions.map(version => (
            <option key={version.value} value={version.value}>
                {version.label}
            </option>
        ))}
    </select>
    <Select
        isMulti
        options={serialNumbers}
        value={selectedSerialNumbers}
        onChange={setSelectedSerialNumbers} // Update state but do not fetch data
        placeholder="Select Serial Numbers"
        className={styles.multiSelect}
    />
    <button onClick={handleApplyFilters} className={styles.filterButton}>Apply Filters</button>
    <button onClick={resetFilters} className={styles.filterButton}>Reset to Default</button>
</div>


            {loading ? (
                <p>Loading data...</p>
            ) : (
                <div className={styles.chartContainer} ref={chartRef}>
                    <Bar data={getChartData()} options={chartOptions} />
                </div>
            )}

            <button 
                className={styles.applyButton} 
                style={{ margin: '20px auto', display: 'block' }} 
                onClick={() => setShowTable(!showTable)}
            >
                {showTable ? 'Hide Table' : 'Show Table'}
            </button>

            {showTable && (
    <table className={styles.styledTable}>
    <thead>
        <tr>
            <th>Step Number</th>
            <th>Total Count</th>
            <th>Fail Count</th>
            <th>Fail Percentage</th>
            <th>Cumulative Percentage</th>
        </tr>
    </thead>
    <tbody>
        {paretoData.map((data, index) => (
            <tr 
                key={index} 
                className={Number(data.cumulativePercentage) < 80 ? styles.redRow : ''}
            >
                <td>{data.stepNumber}</td>
                <td>{data.totCount || 0}</td>
                <td>{data.failCount || 0}</td>
                <td>{Number(data.failPercentage || 0).toFixed(2) + '%'}</td>
                <td>{Number(data.cumulativePercentage || 0).toFixed(2) + '%'}</td>
            </tr>
        ))}
    </tbody>
</table>

)}


            <div className={styles.exportButtons}>
                <button onClick={exportChartAsPNG} className={styles.applyButton}>Export Chart as PNG</button>
                <button onClick={exportTableAsCSV} className={styles.applyButton}>Export Table as CSV</button>
                <button onClick={exportTableAsPDF} className={styles.applyButton}>Export Table as PDF</button>
                <button onClick={openModal} className={styles.applyButton}>Expand Chart</button>
            </div>

            <Modal
                isOpen={isModalOpen}
                onRequestClose={closeModal}
                className={styles.modalContent}
                overlayClassName={styles.modalOverlay}
                contentLabel="Expanded Pareto Chart"
            >
                <button onClick={closeModal} className={styles.closeButton}>Close</button>
                <div className={styles.expandedChartContainer}>
                    <Bar data={getChartData()} options={chartOptions} />
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
            This page provides a detailed **Pareto analysis** of failure data, helping you identify the most significant contributors to overall failures:
        </p>
        <ul>
            <li>
                <strong>Pareto Chart:</strong> A combination of a bar chart (failure counts by step) and a line chart (cumulative percentage), visualizing the steps contributing most to failures.
            </li>
            <li>
                <strong>Filters:</strong> Apply filters to customize the analysis:
                <ul>
                    <li><strong>Date Range:</strong> Focus on a specific test period.</li>
                    <li><strong>ATE SW Version:</strong> Analyze data for a particular software version.</li>
                    <li><strong>Serial Numbers:</strong> Drill down into failures for selected hardware units.</li>
                </ul>
            </li>
            <li>
                <strong>Data Table:</strong> View detailed data for each step, including:
                <ul>
                    <li>Step Number</li>
                    <li>Total Count</li>
                    <li>Fail Count</li>
                    <li>Fail Percentage</li>
                    <li>Cumulative Fail Percentage</li>
                </ul>
            </li>
            <li>
                <strong>Annotations:</strong> Highlights the step where the cumulative percentage crosses the 80% threshold, adhering to the Pareto principle.
            </li>
            <li>
                <strong>Export Options:</strong> Download the chart as a PNG or the data table as CSV/PDF for reporting and documentation.
            </li>
        </ul>
        <p>
            Use this page to identify the key contributors to failures, prioritize improvement efforts, and enhance the quality of hardware testing processes.
        </p>
    </div>
</Modal>

        </div>
    );
};

export default ParetoChart;
