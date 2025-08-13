import React from 'react';
import styles from './RootCauseAnalysis.module.css';

const Modal = ({ isOpen, onClose, data }) => {
    if (!isOpen) return null;

    return (
        <div className={styles.modalBackdrop} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h3>Related Step {data.relatedStep}</h3>
                <p><strong>Primary Step:</strong> Step {data.primaryStep}</p>
                <p><strong>Probability:</strong> {data.probability}%</p>
                <p><strong>Details:</strong> {data.details}</p>
                <button className={styles.modalClose} onClick={onClose}>Close</button>
            </div>
        </div>
    );
};

export default Modal;
