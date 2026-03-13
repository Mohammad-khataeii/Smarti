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
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

import GoToDashboardButton from '../components/GoToDashboardButton';

const Papa = window.Papa;
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
    
    // ✅ Export table data to PDF
const exportTableToPDF = () => {
  if (!tableData || tableData.length === 0) return;

  const doc = new jsPDF();
  doc.text('Step Frequency Table', 14, 15);

  const tableColumn = ["Step Number", "Total Frequency", "Fail Count", "Fail Percentage (%)", "Average Fail Measure"];
  const tableRows = tableData.map(item => [
    `Step ${item.stepNumber}`,
    item.totalFrequency,
    item.failCount,
    item.failPercentage.toFixed(2),
    item.avgMeasureValue ? item.avgMeasureValue.toFixed(2) : "-"
  ]);

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 20,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [0, 123, 255] }
  });

  doc.save('step_frequency_table.pdf');
};

// ✅ Export table data to CSV
const exportTableToCSV = () => {
  if (!tableData || tableData.length === 0) return;

  const csvData = tableData.map(item => ({
    StepNumber: `Step ${item.stepNumber}`,
    TotalFrequency: item.totalFrequency,
    FailCount: item.failCount,
    FailPercentage: item.failPercentage.toFixed(2),
    AverageFailMeasure: item.avgMeasureValue ? item.avgMeasureValue.toFixed(2) : "-"
  }));

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'step_frequency_table.csv';
  link.click();
};

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
            <GoToDashboardButton />
            <div className={styles.filterSection}>
                <div className={styles.dateFilterContainer}>
  <div className={styles.datePickerGroup}>
    <label>Start Date:</label>
    <DatePicker
      selected={startDate}
      onChange={(date) => setStartDate(date)}
      placeholderText="Select start date"
      dateFormat="yyyy-MM-dd"
      className={styles.datePicker}
      isClearable
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
    />
  </div>

  <div className={styles.datePickerGroup}>
    <label>End Date:</label>
    <DatePicker
      selected={endDate}
      onChange={(date) => setEndDate(date)}
      placeholderText="Select end date"
      dateFormat="yyyy-MM-dd"
      className={styles.datePicker}
      isClearable
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
      minDate={startDate}
    />
  </div>

  {/* Quick Range Buttons */}
  <div className={styles.quickRangeContainer}>
    <button
      className={styles.quickRangeBtn}
      onClick={() => {
        const today = new Date();
        setStartDate(today);
        setEndDate(today);
      }}
    >
      Today
    </button>
    <button
      className={styles.quickRangeBtn}
      onClick={() => {
        const today = new Date();
        const last7 = new Date();
        last7.setDate(today.getDate() - 7);
        setStartDate(last7);
        setEndDate(today);
      }}
    >
      Last 7 Days
    </button>
    <button
      className={styles.quickRangeBtn}
      onClick={() => {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(startOfMonth);
        setEndDate(today);
      }}
    >
      This Month
    </button>
    <button
      className={styles.quickRangeBtn}
      onClick={() => {
        const today = new Date();
        const last30 = new Date();
        last30.setDate(today.getDate() - 30);
        setStartDate(last30);
        setEndDate(today);
      }}
    >
      Last 30 Days
    </button>
  </div>
</div>

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
                <div className={styles.exportButtonGroup}>
      <button onClick={exportTableToPDF} className={styles.exportButton}>
        Export as PDF
      </button>
      <button onClick={exportTableToCSV} className={styles.exportButton}>
        Export as CSV
      </button>
    </div>
                {showDetails && tableData && (
                    
  <>
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

    
  </>
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
