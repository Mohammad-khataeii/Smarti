import express from 'express';
import db from './db.mjs';

const router = express.Router();

// API endpoint to calculate failure co-occurrence probabilities
router.get('/failure-predictions', async (req, res) => {
    try {
        const db = await dbPromise;

        // Step 1: Fetch all the steps with their results (PASS or FAIL)
        const stepData = await db.all(`
            SELECT serialNumber, stepNumber, stepResult
            FROM step_data
            WHERE stepResult = 'FAIL'
            ORDER BY serialNumber, stepNumber
        `);

        // Step 2: Group failures by serialNumber to identify co-occurrences
        const failuresBySerial = {};
        stepData.forEach(row => {
            if (!failuresBySerial[row.serialNumber]) {
                failuresBySerial[row.serialNumber] = [];
            }
            failuresBySerial[row.serialNumber].push(row.stepNumber);
        });

        // Step 3: Calculate the co-occurrence frequency
        const failureCoOccurrences = {}; // Stores co-occurrence counts
        const failureCounts = {}; // Stores individual failure counts for probability calculation

        Object.values(failuresBySerial).forEach(failedSteps => {
            failedSteps.forEach((step, i) => {
                // Initialize the step's failure count if not already initialized
                failureCounts[step] = (failureCounts[step] || 0) + 1;

                failedSteps.forEach((otherStep, j) => {
                    if (i !== j) {
                        if (!failureCoOccurrences[step]) {
                            failureCoOccurrences[step] = {};
                        }
                        failureCoOccurrences[step][otherStep] = (failureCoOccurrences[step][otherStep] || 0) + 1;
                    }
                });
            });
        });

        // Step 4: Calculate conditional probabilities
        const failurePredictions = {}; // Stores conditional probabilities
        for (const step in failureCoOccurrences) {
            failurePredictions[step] = {};
            for (const otherStep in failureCoOccurrences[step]) {
                const coOccurrenceCount = failureCoOccurrences[step][otherStep];
                const stepCount = failureCounts[step];
                const probability = (coOccurrenceCount / stepCount) * 100;
                failurePredictions[step][otherStep] = probability.toFixed(2); // Round to 2 decimal places
            }
        }

        console.log('Failure Predictions:', failurePredictions); // Log for debugging

        res.json(failurePredictions);
    } catch (error) {
        console.error('Error calculating failure predictions:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
