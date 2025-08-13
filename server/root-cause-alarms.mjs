import express from 'express';
import db from './db.mjs'; // SQLite database initialization
import { promisify } from 'util';

const router = express.Router();
const dbAll = promisify(db.all).bind(db);

router.get('/root-cause-alarms', async (req, res) => {
    try {
        const { startDate, endDate, ateSwVersion, serialNumbers } = req.query;

        // Validate date format (optional)
        const validateDate = (date) => !isNaN(Date.parse(date));
        if ((startDate && !validateDate(startDate)) || (endDate && !validateDate(endDate))) {
            return res.status(400).json({ message: 'Invalid date format. Please use YYYY-MM-DD.' });
        }

        // Build the WHERE clause for filters
        let filters = '';
        const params = [];

        if (startDate) {
            filters += ' AND gm.testStarted >= ?';
            params.push(startDate);
        }
        if (endDate) {
            filters += ' AND gm.testStopped <= ?';
            params.push(endDate);
        }
        if (ateSwVersion) {
            filters += ' AND gm.ateSwVersion = ?';
            params.push(ateSwVersion);
        }
        if (serialNumbers) {
            const serialNumbersArray = serialNumbers.split(',');
            filters += ` AND gm.serialNumber IN (${serialNumbersArray.map(() => '?').join(',')})`;
            params.push(...serialNumbersArray);
        }

        // Fetch related steps with 100% probability
        const relatedFailures = await dbAll(`
            WITH FailureAnalysis AS (
                SELECT sd1.stepNumber AS primaryStep, 
                       sd2.stepNumber AS relatedStep, 
                       COUNT(*) AS relatedCount
                FROM step_data sd1
                JOIN global_metadata gm ON sd1.global_id = gm.id
                JOIN step_data sd2 ON sd1.global_id = sd2.global_id
                WHERE sd1.stepResult = 'FAIL'
                  AND sd2.stepResult = 'FAIL'
                  AND sd1.stepNumber != sd2.stepNumber
                  ${filters}
                GROUP BY sd1.stepNumber, sd2.stepNumber
            ),
            TotalFailures AS (
                SELECT sd.stepNumber, COUNT(*) AS totalCount
                FROM step_data sd
                JOIN global_metadata gm ON sd.global_id = gm.id
                WHERE sd.stepResult = 'FAIL'
                  ${filters}
                GROUP BY sd.stepNumber
            )
            SELECT fa.primaryStep, fa.relatedStep, 
                   (CAST(fa.relatedCount AS FLOAT) / tf.totalCount) * 100 AS probability
            FROM FailureAnalysis fa
            JOIN TotalFailures tf ON fa.primaryStep = tf.stepNumber
            WHERE (CAST(fa.relatedCount AS FLOAT) / tf.totalCount) * 100 = 100
            ORDER BY fa.primaryStep, fa.relatedStep;
        `, params);

        if (!relatedFailures.length) {
            return res.json({ message: 'No 100% probability relations found.' });
        }

        // Format the response
        const alarms = relatedFailures.map(row => ({
            primaryStep: row.primaryStep,
            relatedStep: row.relatedStep,
            probability: `${row.probability.toFixed(2)}%`
        }));

        res.json({ alarms });
    } catch (error) {
        console.error('Error fetching alarm data:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// API to fetch stepName and stepNumber from step_data
router.get('/step-details', async (req, res) => {
    try {
        // Fetch step details
        const stepDetails = await dbAll(`
            SELECT DISTINCT stepNumber, stepName
            FROM step_data
            ORDER BY stepNumber ASC;
        `);

        console.log('stepname', stepDetails);
        if (!stepDetails.length) {
            return res.json({ message: 'No step details found.' });
        }

        res.json({ steps: stepDetails });
    } catch (error) {
        console.error('Error fetching step details:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
