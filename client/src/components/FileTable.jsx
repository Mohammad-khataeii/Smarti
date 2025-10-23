import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import styles from './FileTable.module.css';
import Modal from 'react-modal';
import GoToDashboardButton from '../components/GoToDashboardButton';    

const FileTable = () => {
    const [records, setRecords] = useState([]);
    const [selectedRecords, setSelectedRecords] = useState([]);
    const [serialNumberFilter, setSerialNumberFilter] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [ateSwVersion, setAteSwVersion] = useState('');
    const [ateSwVersions, setAteSwVersions] = useState([]);
    const [uutStatus, setUutStatus] = useState('');
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [sortOrder, setSortOrder] = useState('desc'); // State for sorting order (asc or desc)
    const [isModalOpen, setIsModalOpen] = useState(false); // Modal state for displaying step details
    const [selectedFileSteps, setSelectedFileSteps] = useState([]); // State for selected file's step details
    const [loading, setLoading] = useState(true);  // Track loading state

    const openHelp = () => setIsHelpOpen(true);
    const closeHelp = () => setIsHelpOpen(false);

    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const openDeleteConfirm = () => setIsDeleteConfirmOpen(true);
    const closeDeleteConfirm = () => setIsDeleteConfirmOpen(false);

    const [isDeleteSelectedConfirmOpen, setIsDeleteSelectedConfirmOpen] = useState(false);
    const openDeleteSelectedConfirm = () => setIsDeleteSelectedConfirmOpen(true);
    const closeDeleteSelectedConfirm = () => setIsDeleteSelectedConfirmOpen(false);

    const [isDateModalOpen, setIsDateModalOpen] = useState(false);
    const [activeDateField, setActiveDateField] = useState(null); // 'start' or 'end'


    useEffect(() => {
        // Simulate a 7 seconds loading time
        setTimeout(() => {
            setLoading(false);  // Hide loading animation after 7 seconds
        }, 7000);
    }, []);
    
    useEffect(() => {
        fetchAteSwVersions();
    }, []);

    useEffect(() => {
        fetchRecords();
    }, [
        serialNumberFilter, startDate, endDate, ateSwVersion, uutStatus, sortOrder
    ]);

    // Fetch available ateSwVersions for the dropdown
    const fetchAteSwVersions = async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/ate-sw-versions');
            setAteSwVersions(response.data);
        } catch (error) {
            console.error('Error fetching ateSwVersions:', error);
        }
    };

    // Fetch records with optional filters
    const fetchRecords = async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/global_metadata', {
                params: {
                    serialNumber: serialNumberFilter || null,
                    startDate: startDate ? startDate.toISOString().split('T')[0] : null,
                    endDate: endDate ? endDate.toISOString().split('T')[0] : null,
                    ateSwVersion: ateSwVersion || null,
                    uutStatus: uutStatus || null, // Include uutStatus in the query parameters
                },
            });

            // Sort records based on sortOrder (desc or asc)
            const sortedRecords = response.data.sort((a, b) => {
                const dateA = new Date(a.testStarted);
                const dateB = new Date(b.testStarted);
                return sortOrder === 'desc' ? dateB - dateA : dateA - dateB; // Switch between desc and asc based on the sortOrder state
            });

            setRecords(sortedRecords);
        } catch (error) {
            console.error('Error fetching records:', error);
        }
    };

    // Toggle sort order
    const toggleSortOrder = () => {
        setSortOrder(prevOrder => (prevOrder === 'desc' ? 'asc' : 'desc'));
    };

    // Fetch step details for a clicked file
    const fetchStepDetails = async (fileId) => {
        try {
            const response = await axios.get('http://localhost:3001/api/test_steps', { params: { fileId } });
            setSelectedFileSteps(response.data);
            setIsModalOpen(true); // Open modal when the file details are fetched
        } catch (error) {
            console.error('Error fetching step details:', error);
        }
    };

    // Delete a single record by ID
    const handleDelete = async (id) => {
        try {
            await axios.delete(`http://localhost:3001/api/global_metadata/${id}`);
            fetchRecords(); // Refresh records list
        } catch (error) {
            console.error('Error deleting record:', error);
        }
    };

    const confirmDeleteSelected = async () => {
    try {
        await axios.delete('http://localhost:3001/api/global_metadata', { 
            data: { ids: selectedRecords } 
        });
        setSelectedRecords([]); // Clear selection after deletion
        fetchRecords(); // Refresh list
    } catch (error) {
        console.error('Error deleting selected records:', error);
    } finally {
        closeDeleteSelectedConfirm();
    }
};

    // Delete all records
    const handleDeleteAll = async () => {
        try {
            await axios.delete('http://localhost:3001/api/global_metadata/all');
            setSelectedRecords([]); // Clear selection after deletion
            fetchRecords(); // Refresh records list
        } catch (error) {
            console.error('Error deleting all records:', error);
        }
    };
    

    const confirmDeleteAll = async () => {
  await handleDeleteAll();
  closeDeleteConfirm();
};
    // Handle selection of a record for bulk delete
    const handleSelectRecord = (id) => {
        setSelectedRecords((prev) =>
            prev.includes(id) ? prev.filter((recordId) => recordId !== id) : [...prev, id]
        );
    };

    
    const closeModal = () => setIsModalOpen(false); // Close modal for step details

    return (
        <div className={styles.filesTableContainer}>
            <GoToDashboardButton />
            {loading ? (
                <div className={styles.loadingScreen}>
                    <div className={styles.spinner}></div>
                    <p>Loading...</p>
                </div>
            ) : (
                <div>
                    <h2 className={styles.filesTableTitle}>Global Metadata Records</h2>
    
                    {/* Filter controls */}
                    <div className={styles.filterControls}>
    <input
        type="text"
        value={serialNumberFilter}
        onChange={(e) => setSerialNumberFilter(e.target.value)}
        placeholder="Filter by Serial Number"
        className={styles.filterInput}
    />
    <button
    className={styles.filterInput}
    onClick={() => { setActiveDateField('start'); setIsDateModalOpen(true); }}
>
    {startDate ? startDate.toLocaleDateString() : 'Select Start Date'}
</button>
<button
    className={styles.filterInput}
    onClick={() => { setActiveDateField('end'); setIsDateModalOpen(true); }}
>
    {endDate ? endDate.toLocaleDateString() : 'Select End Date'}
</button>

    <select
        value={ateSwVersion}
        onChange={(e) => setAteSwVersion(e.target.value)}
        className={styles.filterInput}
    >
        <option value="">Select AteSwVersion</option>
        {ateSwVersions.map((version) => (
            <option key={version.AteSwVersion} value={version.AteSwVersion}>
                {version.AteSwVersion}
            </option>
        ))}
    </select>
    <select
        value={uutStatus}
        onChange={(e) => setUutStatus(e.target.value)}
        className={styles.filterInput}
    >
        <option value="">Select UUT Status</option>
        <option value="FAIL">FAIL</option>
        <option value="PASS">PASS</option>
        <option value="STOP">STOP</option>
        <option value="UNCOMPLETE">UNCOMPLETE</option>
    </select>
</div>

    
                    {/* Sort order toggle */}
                    <div className={styles.sortOrderToggle}>
                        <button onClick={toggleSortOrder} className={styles.filterButton}>
                            Sort {sortOrder === 'desc' ? 'Oldest to Newest' : 'Newest to Oldest'}
                        </button>
                    </div>
    
                    {/* Action buttons */}
                    <div className={styles.actionsContainer}>
                        <button
            onClick={openDeleteSelectedConfirm}
            className={`${styles.actionButton} ${styles.deleteAll}`}
            disabled={!selectedRecords.length}
        >
            Delete Selected
        </button>

        {/* Delete Selected Confirmation Modal */}
        <Modal
            isOpen={isDeleteSelectedConfirmOpen}
            onRequestClose={closeDeleteSelectedConfirm}
            className={styles.modalContent}
            overlayClassName={styles.modalOverlay}
            contentLabel="Confirm Delete Selected"
        >
            <h2>Confirm Deletion</h2>
            <p>
                Are you sure you want to delete the selected{" "}
                <strong>{selectedRecords.length}</strong> record(s)?  
                This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
                <button
                    onClick={confirmDeleteSelected}
                    className={`${styles.actionButton} ${styles.deleteAll}`}
                >
                    Yes, Delete Selected
                </button>
                <button
                    onClick={closeDeleteSelectedConfirm}
                    className={styles.closeModalButton}
                >
                    Cancel
                </button>
            </div>
        </Modal>

                        {/* Delete All Button */}
            <button
                onClick={openDeleteConfirm}
                className={`${styles.actionButton} ${styles.deleteAll}`}
            >
                Delete All
            </button>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteConfirmOpen}
                onRequestClose={closeDeleteConfirm}
                className={styles.modalContent}
                overlayClassName={styles.modalOverlay}
                contentLabel="Confirm Delete All"
            >
                <h2>Confirm Deletion</h2>
                <p>Are you sure you want to delete <strong>all</strong> records? This action cannot be undone.</p>
                <div className={styles.modalActions}>
                    <button
                        onClick={confirmDeleteAll}
                        className={`${styles.actionButton} ${styles.deleteAll}`}
                    >
                        Yes, Delete All
                    </button>
                    <button
                        onClick={closeDeleteConfirm}
                        className={styles.closeModalButton}
                    >
                        Cancel
                    </button>
                </div>
            </Modal>
                    </div>
    
                    {/* Records table */}
                    <table className={styles.filesTable}>
                        <thead>
                            <tr>
                                <th>Select</th>
                                <th>ID</th>
                                <th>Filename</th>
                                <th>Serial Number</th>
                                <th>UUT Status</th>
                                <th>Test Started</th>
                                <th>Test Stopped</th>
                                <th>ATE SW Version</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.length > 0 ? (
                                records.map((record) => (
                                    <tr key={record.id} className={selectedRecords.includes(record.id) ? styles.selectedRow : ''}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedRecords.includes(record.id)}
                                                onChange={() => handleSelectRecord(record.id)}
                                            />
                                        </td>
                                        <td>{record.id}</td>
                                        <td>{record.filename}</td>
                                        <td>{record.serialNumber}</td>
                                        <td>{record.uutStatus}</td>
                                        <td>{record.testStarted}</td>
                                        <td>{record.testStopped}</td>
                                        <td>{record.AteSwVersion || 'N/A'}</td>
                                        <td>
                                            <button
                                                onClick={() => fetchStepDetails(record.id)}
                                                className={styles.viewStepsButton}
                                            >
                                                View Steps
                                            </button>
                                            <button
                                                onClick={() => handleDelete(record.id)}
                                                className={styles.deleteButton}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="9" className={styles.noFilesText}>
                                        No records found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
    
                    {/* Step Details Modal */}
                    <Modal
                        isOpen={isModalOpen}
                        onRequestClose={closeModal}
                        className={styles.modalContent}
                        overlayClassName={styles.modalOverlay}
                        contentLabel="Step Details"
                    >
                        <h2>Step Details</h2>
                        <button onClick={closeModal} className={styles.closeModalButton}>Close</button>
                        <table className={styles.stepDetailsTable}>
                            <thead>
                                <tr>
                                    <th>Step Number</th>
                                    <th>Step Result</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedFileSteps.length > 0 ? (
                                    selectedFileSteps.map((step, index) => (
                                        <tr key={index}>
                                            <td>{step.stepNumber}</td>
                                            <td>{step.stepResult}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="2">No steps available.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </Modal>
    
                    {/* Help Button and Modal */}
                    <button className={styles.helpButton} onClick={openHelp}>?</button>
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
        <p>This page allows you to view, filter, and manage test records based on metadata extracted from uploaded files.</p>
        <ul>
            <li>
                <strong>Filters:</strong> You can filter the records by Serial Number, Start Date, End Date, ATE Software Version (AteSwVersion), and UUT Status (e.g., PASS, FAIL, STOP).
            </li>
            <li>
                <strong>Sorting:</strong> The records can be sorted by the Test Start Date, with options to view records from Newest to Oldest or Oldest to Newest.
            </li>
            <li>
                <strong>Step Details:</strong> For each record, you can view detailed step results by clicking the "View Steps" button. This shows the individual steps and their results for the associated test.
            </li>
            <li>
                <strong>Bulk Actions:</strong> You can delete selected records or delete all records with the action buttons at the top of the page.
            </li>
            <li>
                <strong>Help:</strong> You can open this help modal anytime by clicking the "?" button.
            </li>
        </ul>
    </div>
</Modal>
<Modal
    isOpen={isDateModalOpen}
    onRequestClose={() => setIsDateModalOpen(false)}
    className={styles.modalContent}
    overlayClassName={styles.modalOverlay}
    contentLabel="Select Date"
>
    <h2>Select {activeDateField === 'start' ? 'Start' : 'End'} Date</h2>

    {/* Quick Select Buttons */}
    <div className={styles.quickSelectContainer}>
        <button
            onClick={() => {
                const today = new Date();
                activeDateField === 'start' ? setStartDate(today) : setEndDate(today);
                setIsDateModalOpen(false);
            }}
            className={styles.quickSelectButton}
        >
            Today
        </button>

        <button
            onClick={() => {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                activeDateField === 'start' ? setStartDate(yesterday) : setEndDate(yesterday);
                setIsDateModalOpen(false);
            }}
            className={styles.quickSelectButton}
        >
            Yesterday
        </button>

        <button
            onClick={() => {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                activeDateField === 'start' ? setStartDate(sevenDaysAgo) : setEndDate(sevenDaysAgo);
                setIsDateModalOpen(false);
            }}
            className={styles.quickSelectButton}
        >
            7 Days Ago
        </button>

        <button
            onClick={() => {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                activeDateField === 'start' ? setStartDate(thirtyDaysAgo) : setEndDate(thirtyDaysAgo);
                setIsDateModalOpen(false);
            }}
            className={styles.quickSelectButton}
        >
            30 Days Ago
        </button>

        <button
            onClick={() => {
                activeDateField === 'start' ? setStartDate(null) : setEndDate(null);
                setIsDateModalOpen(false);
            }}
            className={`${styles.quickSelectButton} ${styles.clearButton}`}
        >
            Clear
        </button>
    </div>

    {/* Inline Date Picker */}
    <DatePicker
        selected={activeDateField === 'start' ? startDate : endDate}
        onChange={(date) => {
            if (activeDateField === 'start') setStartDate(date);
            else setEndDate(date);
            setIsDateModalOpen(false);
        }}
        inline
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
    />

    <div className={styles.modalActions}>
        <button
            onClick={() => setIsDateModalOpen(false)}
            className={styles.closeModalButton}
        >
            Cancel
        </button>
    </div>
</Modal>


                </div>
            )}
        </div>
    );
    
};

export default FileTable;
