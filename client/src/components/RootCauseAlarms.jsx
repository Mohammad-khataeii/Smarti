import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import styles from './RootCauseAlarms.module.css';

const RootCauseAlarms = () => {
    const [alarms, setAlarms] = useState([]);
    const [groupedAlarms, setGroupedAlarms] = useState({});
    const [expandedRows, setExpandedRows] = useState({});
    const [modalContent, setModalContent] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sortOrder, setSortOrder] = useState('DESC'); // State for sorting order
    const [loading, setLoading] = useState(true); // State for loading

    // Fetch alarms
    useEffect(() => {
        const fetchAlarms = async () => {
            setLoading(true); // Start loading
            try {
                const response = await axios.get('http://localhost:3001/api/root-cause-alarms');
                const alarms = response.data.alarms;
    
                // Fetch step details to map stepNumbers to stepNames
                const stepDetailsResponse = await axios.get('http://localhost:3001/api/step-details');
                const stepDetails = stepDetailsResponse.data.steps.reduce((acc, step) => {
                    acc[step.stepNumber] = step.stepName;
                    return acc;
                }, {});
    
                // Group alarms by primaryStep with stepName mapping
                const grouped = alarms.reduce((acc, alarm) => {
                    if (!acc[alarm.primaryStep]) {
                        acc[alarm.primaryStep] = {
                            primaryStepName: stepDetails[alarm.primaryStep] || 'Unknown',
                            relatedSteps: [],
                        };
                    }
                    acc[alarm.primaryStep].relatedSteps.push({
                        relatedStep: alarm.relatedStep,
                        relatedStepName: stepDetails[alarm.relatedStep] || 'Unknown',
                    });
                    return acc;
                }, {});
    
                // Artificial delay to keep the spinner visible longer
                setTimeout(() => {
                    setGroupedAlarms(grouped);
                    setLoading(false); // Stop loading
                }, 5000); // 2-second delay
            } catch (error) {
                console.error('Error fetching alarms or step details:', error);
                setLoading(false); // Stop loading even in case of an error
            }
        };
    
        fetchAlarms();
    }, []);
    

    // Toggle expanded rows
    const toggleRow = (primaryStep) => {
        setExpandedRows((prev) => ({
            ...prev,
            [primaryStep]: !prev[primaryStep],
        }));
    };

    // Toggle sorting order
    const toggleSortOrder = () => {
        setSortOrder((prevOrder) => (prevOrder === 'DESC' ? 'ASC' : 'DESC'));
    };

    // Sort groupedAlarms based on relatedSteps length
    const sortedGroupedAlarms = Object.entries(groupedAlarms)
        .sort(([keyA, valueA], [keyB, valueB]) => {
            const diff = valueB.relatedSteps.length - valueA.relatedSteps.length;
            return sortOrder === 'DESC' ? diff : -diff;
        })
        .reduce((sortedAcc, [key, value]) => {
            sortedAcc[key] = value;
            return sortedAcc;
        }, {});

    // Open modal with troubleshooting tips
    const openModal = (primaryStep, primaryStepName) => {
        const tips = getTroubleshootingTips(primaryStepName);
        setModalContent({ primaryStep, primaryStepName, tips });
        setIsModalOpen(true);
    };

    const closeModal = () => setIsModalOpen(false);

    // Get troubleshooting tips based on stepName
    const getTroubleshootingTips = (stepName) => {
        const tips = {
            'Brake Pad Test': [
                'Ensure brake pads are aligned properly.',
                'Check for contamination (oil, grease, etc.) on the pads.',
                'Verify the pad thickness is within the acceptable range.',
            ],
            'Hydraulic Pressure Test': [
                'Inspect hydraulic fluid levels.',
                'Check for leaks in hydraulic lines.',
                'Ensure the pressure sensor calibration is accurate.',
            ],
            'Temperature Tolerance Test': [
                'Verify the environmental temperature meets test conditions.',
                'Ensure thermocouples are properly connected.',
                'Inspect heating/cooling components for proper functionality.',
            ],
        };
        return tips[stepName] || ['No troubleshooting tips available for this step.'];
    };

    return (
        <div className={styles.container}>
            {loading ? (
                <div className={styles.loadingScreen}>
                    <div className={styles.spinner}></div>
                    <p>Loading...</p>
                </div>
            ) : (
                <>
                    <h1 className={styles.title}>🚨 Root Cause Alarm System</h1>
                    <p className={styles.description}>
                        Monitor alarms and take action to address high-probability failures for train brake systems.
                    </p>

                    {/* Sort Order Toggle Button */}
                    <button className={styles.sortButton} onClick={toggleSortOrder}>
                        Sort: {sortOrder === 'DESC' ? 'Descending' : 'Ascending'}
                    </button>

                    <div className={styles.tableContainer}>
                        <table className={styles.alarmTable}>
                            <thead>
                                <tr>
                                    <th>Primary Step</th>
                                    <th>Related Steps</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(sortedGroupedAlarms).length > 0 ? (
                                    Object.entries(sortedGroupedAlarms).map(([primaryStep, data]) => (
                                        <React.Fragment key={primaryStep}>
                                            {/* Primary Step Row */}
                                            <tr
                                                className={`${styles.row} ${
                                                    expandedRows[primaryStep] ? styles.rowExpanded : ''
                                                }`}
                                                onClick={() => toggleRow(primaryStep)}
                                            >
                                                <td className={styles.primaryStep}>
                                                    {primaryStep} - {data.primaryStepName}
                                                    <span className={styles.toggleIcon}>
                                                        {expandedRows[primaryStep] ? '▲' : '▼'}
                                                    </span>
                                                </td>
                                                <td>
                                                    {expandedRows[primaryStep]
                                                        ? `${data.relatedSteps.length} steps expanded`
                                                        : `${data.relatedSteps.length} steps hidden`}
                                                </td>
                                            </tr>

                                            {/* Related Steps */}
                                            {expandedRows[primaryStep] &&
                                                data.relatedSteps.map((step, index) => (
                                                    <tr key={index} className={styles.relatedRow}>
                                                        <td></td>
                                                        <td className={styles.relatedStep}>
                                                            {step.relatedStep} - {step.relatedStepName}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="2" className={styles.noAlarms}>
                                            No alarms to display. ✅
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <Modal
                        isOpen={isModalOpen}
                        onRequestClose={closeModal}
                        className={styles.modalContent}
                        overlayClassName={styles.modalOverlay}
                    >
                        {modalContent && (
                            <div>
                                <h2>Step: {modalContent.primaryStepName}</h2>
                                <ul>
                                    {modalContent.tips.map((tip, index) => (
                                        <li key={index}>{tip}</li>
                                    ))}
                                </ul>
                                <button onClick={closeModal} className={styles.closeModalButton}>
                                    Close
                                </button>
                            </div>
                        )}
                    </Modal>
                </>
            )}
        </div>
    );
};

export default RootCauseAlarms;
