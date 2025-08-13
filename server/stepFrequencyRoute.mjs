import express from 'express';
import db from './db.mjs';

const router = express.Router();

// API route to get the frequency, fail count, and average measure value for each stepNumber with optional filters
router.get('/step-frequency', async (req, res) => {
    const { startDate, endDate, ateSwVersion, stepNumbers } = req.query;

    // Construct SQL filters
    let dateCondition = '';
    if (startDate && endDate) {
        dateCondition = `AND testStarted BETWEEN DATE(?) AND DATE(?)`;
    }

    let versionCondition = '';
    if (ateSwVersion) {
        versionCondition = `AND ateSwVersion = ?`;
    }

    let stepNumbersCondition = '';
    const queryParams = [];
    if (startDate && endDate) {
        queryParams.push(startDate, endDate);
    }
    if (ateSwVersion) {
        queryParams.push(ateSwVersion);
    }

    // Handle multiple stepNumbers if provided
    if (stepNumbers) {
        const stepNumbersArray = Array.isArray(stepNumbers) ? stepNumbers : [stepNumbers];
        stepNumbersCondition = `AND stepNumber IN (${stepNumbersArray.map(() => '?').join(', ')})`;
        queryParams.push(...stepNumbersArray);
    }

    try {
        // Query to get total count, fail count, and average measure value for each stepNumber with filters
        const query = `
            SELECT 
                stepNumber,
                COUNT(*) AS totalFrequency,
                SUM(CASE WHEN stepResult = 'FAIL' THEN 1 ELSE 0 END) AS failCount,
                AVG(CASE WHEN stepResult = 'FAIL' THEN measureValue ELSE NULL END) AS avgMeasureValue
            FROM step_data
            JOIN global_metadata ON step_data.global_id = global_metadata.id
            WHERE 1=1 ${dateCondition} ${versionCondition} ${stepNumbersCondition}
            GROUP BY stepNumber
            ORDER BY failCount DESC
        `;

        const results = await new Promise((resolve, reject) => {
            db.all(query, queryParams, (err, rows) => {
                if (err) {
                    console.error('Error fetching step frequency data:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });

        res.json(results);
    } catch (error) {
        console.error('Error in /step-frequency API:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
