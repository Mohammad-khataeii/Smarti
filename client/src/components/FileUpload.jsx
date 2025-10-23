import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import styles from './FileUpload.module.css';
import Modal from 'react-modal';
import GoToDashboardButton from '../components/GoToDashboardButton';

const FileUpload = () => {
    const [files, setFiles] = useState([]);
    const [redirectToChart, setRedirectToChart] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [duplicateCount, setDuplicateCount] = useState(0); 
    const [loading, setLoading] = useState(true);  // Track loading state

    const openHelp = () => setIsHelpOpen(true);
    const closeHelp = () => setIsHelpOpen(false);

    const handleFileChange = (e) => {
        setFiles(Array.from(e.target.files));
        setUploadStatus(null);
        setUploadProgress(0);
        setDuplicateCount(0);
    };

    const handleDeleteFile = (index) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        let duplicateFiles = 0; 

        for (let file of files) {
            formData.append('files', file);
        }

        try {
            const response = await axios.post('http://localhost:3001/api/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percentCompleted);
                },
            });

            const responseArray = response.data;

            responseArray.forEach((fileResponse) => {
                if (fileResponse.message && fileResponse.message.includes('Duplicate filename')) {
                    duplicateFiles += 1;
                }
            });

            setDuplicateCount(duplicateFiles);
            setUploadStatus({ success: true, message: 'Upload successful!' });
            setFiles([]);
            setUploadProgress(0);
        } catch (err) {
            setUploadStatus({ success: false, message: 'Upload failed. Please try again.' });
            setUploadProgress(0);
        }
    };

    useEffect(() => {
        // Simulate a 7 seconds loading time
        setTimeout(() => {
            setLoading(false);  // Hide loading animation after 7 seconds
        }, 7000);
    }, []);

    if (redirectToChart) {
        return <Navigate to="/control-chart" />;
    }

    return (
        <div className={styles.container}>
            <GoToDashboardButton />
            {loading ? (
                <div className={styles.loadingScreen}>
                    <div className={styles.spinner}></div>
                    <p>Loading...</p>
                </div>
            ) : (
                <div>
                    <div className={styles.uploadBox}>
                        <h3>Upload Files Here</h3>
                        <div className={styles.dropArea}>
                            <label htmlFor="fileInput" className={styles.browseLabel}>
                                Drag or click to upload file
                            </label>
                            <input
                                id="fileInput"
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                className={styles.fileInput}
                            />
                            <p className={styles.fileLimit}>Individual file size limit is 10MB</p>
                        </div>

                        {duplicateCount > 0 && (
                            <div className={styles.duplicateMessage}>
                                {duplicateCount} duplicate file(s) found. But don't worry, we'll handle it for you.
                            </div>
                        )}

                        <div className={styles.fileListSection}>
                            {files.length > 0 && (
                                <div className={styles.actionButtons}>
                                    <button onClick={handleSubmit} className={styles.uploadButton}>Upload</button>
                                    <button onClick={() => setFiles([])} className={styles.cancelButton}>Cancel</button>
                                </div>
                            )}
                            {uploadProgress > 0 && (
                                <div className={styles.progressBarContainer}>
                                    <div className={styles.progressBar} style={{ width: `${uploadProgress}%` }}>
                                        {uploadProgress}%
                                    </div>
                                </div>
                            )}
                            <h3 className={styles.fileListTitle}>Upload Queue</h3>
                            <ul className={styles.fileList}>
                                {files.map((file, index) => (
                                    <li key={index} className={styles.fileItem}>
                                        <div className={styles.fileInfo}>
                                            <span className={styles.fileType}>{file.name.split('.').pop().toUpperCase()}</span>
                                            <span className={styles.fileName}>{file.name}</span>
                                            <span className={styles.fileSize}>{(file.size / 1024).toFixed(2)} KB</span>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteFile(index)}
                                            className={styles.deleteButton}
                                        >
                                            🗑️
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {uploadStatus && (
                            <div className={uploadStatus.success ? styles.successMessage : styles.errorMessage}>
                                {uploadStatus.message}
                            </div>
                        )}
                    </div>
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
            This page allows you to upload hardware test data files, which are stored and made available for further analysis and visualization.
        </p>
        <ul>
            <li>
                <strong>File Upload:</strong> Drag and drop files or click to browse and select files for upload. Supports multiple file uploads at once.
            </li>
            <li>
                <strong>Upload Progress:</strong> Displays real-time upload progress as a percentage for the selected files.
            </li>
            <li>
                <strong>Duplicate Detection:</strong> Automatically detects and skips files that have already been uploaded based on their filename.
            </li>
            <li>
                <strong>Metadata Extraction:</strong> Extracts key metadata from uploaded files, such as machine identifier, station name, serial number, test start and stop times, and the software version (AteSwVersion).
            </li>
            <li>
                <strong>Step Data:</strong> Parses and saves detailed step data from CSV files to be used for further analysis and charting.
            </li>
        </ul>
    </div>
</Modal>

                </div>
            )}
        </div>
    );
};

export default FileUpload;
