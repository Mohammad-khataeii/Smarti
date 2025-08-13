import express from 'express';
import db from './db.mjs'; // SQLite database initialization
import { promisify } from 'util';

const router = express.Router();
const dbAll = promisify(db.all).bind(db);

router.get('/root-cause-analysis', async (req, res) => {
    try {
        const { stepNumber, startDate, endDate, ateSwVersion, serialNumbers } = req.query;

        if (!stepNumber) {
            return res.status(400).json({ message: 'stepNumber parameter is required' });
        }

        // Validate date format (optional)
        const validateDate = (date) => !isNaN(Date.parse(date));

        if ((startDate && !validateDate(startDate)) || (endDate && !validateDate(endDate))) {
            return res.status(400).json({ message: 'Invalid date format. Please use YYYY-MM-DD.' });
        }

        // Build the WHERE clause for the date filter
        let dateFilter = '';
        const params = [stepNumber];

        if (startDate) {
            dateFilter += ' AND gm.testStarted >= ?';
            params.push(startDate);
        }
        if (endDate) {
            dateFilter += ' AND gm.testStopped <= ?';
            params.push(endDate);
        }

        // Fetch failures for the selected step within the date range
        const stepFailures = await dbAll(`
            SELECT serialNumber, testStarted
            FROM global_metadata AS gm
            JOIN step_data AS sd ON gm.id = sd.global_id
            WHERE sd.stepNumber = ? AND sd.stepResult = 'FAIL'
            ${dateFilter}
        `, params);

        if (stepFailures.length === 0) {
            return res.json([]); // Return an empty array if no failures are found
        }

        // Fetch related failures for each serial number and test date
        const relatedFailures = await dbAll(`
            SELECT sd2.stepNumber, COUNT(*) AS relatedCount
            FROM step_data AS sd1
            JOIN global_metadata AS gm1 ON sd1.global_id = gm1.id
            JOIN step_data AS sd2 ON sd1.global_id = sd2.global_id
            WHERE sd1.stepNumber = ? AND sd2.stepNumber != sd1.stepNumber AND sd2.stepResult = 'FAIL'
            ${dateFilter}
            GROUP BY sd2.stepNumber
            ORDER BY relatedCount DESC
        `, params);

        // Calculate probabilities
        const totalFailures = stepFailures.length;
        const analysis = relatedFailures.map(row => {
            const probability = ((row.relatedCount / totalFailures) * 100).toFixed(2);
            // Ensure probability doesn't exceed 100%
            const normalizedProbability = Math.min(probability, 100);
            return {
                primaryStep: stepNumber,
                relatedStep: row.stepNumber,
                probability: normalizedProbability
            };
        });

        res.json(analysis);
    } catch (error) {
        console.error('Error performing root cause analysis:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
