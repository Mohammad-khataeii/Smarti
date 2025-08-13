// predictiveFailureRoute.mjs
import express from 'express';
import db from './db.mjs';

const router = express.Router();

router.get('/predictive-failure-analysis', async (req, res) => {
    const { stepNumber, startDate, endDate } = req.query;

    if (!stepNumber) {
        return res.status(400).json({ message: 'stepNumber parameter is required' });
    }

    // Validate date parameters
    if (startDate && isNaN(Date.parse(startDate)) || endDate && isNaN(Date.parse(endDate))) {
        return res.status(400).json({ message: 'Invalid date format for startDate or endDate' });
    }

    // Build date condition for SQL query
    let dateCondition = '';
    const params = [stepNumber];

    if (startDate && endDate) {
        dateCondition = `AND gm.testStarted BETWEEN DATE(?) AND DATE(?)`;
        params.push(startDate, endDate);
    }

    try {
        // Step 1: Query to get the failure count for the specific step number within the date range
        db.all(`
            SELECT stepNumber, COUNT(*) AS failCount
            FROM step_data
            JOIN global_metadata AS gm ON step_data.global_id = gm.id
            WHERE step_data.stepResult = 'FAIL' 
              AND step_data.stepNumber = ?
              ${dateCondition}
            GROUP BY stepNumber
        `, params, async (err, failureCounts) => {
            if (err) {
                console.error('Error fetching step failure counts:', err.message);
                return res.status(500).json({ message: 'Internal server error' });
            }

            if (failureCounts.length === 0) {
                return res.json([]); // Return an empty array if no failures are found for the step number
            }

            const failCount = failureCounts[0].failCount;
            const analysis = [];

            // Step 2: Find failures in other steps associated with failures in the selected step within the date range
            const relatedFailures = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT sd2.stepNumber, COUNT(*) AS relatedCount
                    FROM step_data AS sd1
                    JOIN global_metadata AS gm ON sd1.global_id = gm.id
                    JOIN step_data AS sd2 ON gm.id = sd2.global_id
                    WHERE sd1.stepNumber = ? 
                      AND sd1.stepResult = 'FAIL'
                      AND sd2.stepResult = 'FAIL'
                      AND sd2.stepNumber != sd1.stepNumber
                      ${dateCondition}
                    GROUP BY sd2.stepNumber
                `, params, (err, rows) => {
                    if (err) {
                        console.error(`Error fetching related failures for step ${stepNumber}:`, err.message);
                        return reject(err);
                    }
                    resolve(rows);
                });
            });

            // Step 3: Calculate the probability for each related failure and store it in the analysis array
            relatedFailures.forEach(relatedRow => {
                const probability = (relatedRow.relatedCount / failCount) * 100;
                analysis.push({
                    primaryStep: stepNumber,
                    relatedStep: relatedRow.stepNumber,
                    probability: probability.toFixed(2)
                });
            });

            console.log("Final Analysis Data:", analysis);
            res.json(analysis);
        });
    } catch (error) {
        console.error('Error performing predictive failure analysis:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/distinct-step-numbers', async (req, res) => {
    try {
        const stepNumbers = await new Promise((resolve, reject) => {
            db.all(`
                SELECT DISTINCT stepNumber 
                FROM step_data 
                WHERE stepResult = 'FAIL' 
                ORDER BY stepNumber
            `, (err, rows) => {
                if (err) {
                    console.error('Error fetching distinct step numbers:', err.message);
                    return reject(err);
                }
                resolve(rows.map(row => row.stepNumber));
            });
        });

        res.json(stepNumbers);
    } catch (error) {
        console.error('Error fetching distinct step numbers:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
