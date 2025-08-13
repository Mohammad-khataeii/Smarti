// paretoRoute.mjs
import express from 'express';
import db from './db.mjs';

const router = express.Router();

// API to get failure analysis for each stepNumber with date range
router.get('/pareto-failure-analysis', async (req, res) => {
    const { startDate, endDate, ateSwVersion, serialNumbers } = req.query;

    try {
        // Build the base query and conditions
        let conditions = [];
        let params = [];

        if (startDate && endDate) {
            conditions.push(`gm.testStarted BETWEEN DATE(?) AND DATE(?)`);
            params.push(startDate, endDate);
        }
        if (ateSwVersion) {
            conditions.push(`gm.AteSwVersion = ?`);
            params.push(ateSwVersion);
        }
        if (serialNumbers && serialNumbers.length > 0) {
            const placeholders = serialNumbers.split(',').map(() => '?').join(', ');
            conditions.push(`gm.serialNumber IN (${placeholders})`);
            params.push(...serialNumbers.split(','));
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Query with dynamic filters
        db.all(`
            SELECT sd.stepNumber,
                   COUNT(*) AS totCount,
                   SUM(CASE WHEN sd.stepResult = 'FAIL' THEN 1 ELSE 0 END) AS failCount
            FROM step_data AS sd
            JOIN global_metadata AS gm ON sd.global_id = gm.id
            ${whereClause}
            GROUP BY sd.stepNumber
            ORDER BY failCount DESC
        `, params, (err, result) => {
            if (err) {
                console.error('Error fetching Pareto failure analysis:', err.message);
                return res.status(500).json({ message: 'Internal server error' });
            }

            // Process result
            let cumulativePercentage = 0;
            const totalFailures = result.reduce((sum, row) => sum + row.failCount, 0);
            const data = result.map(row => {
                const failFrequency = row.failCount;
                const failPercentage = totalFailures > 0 ? (row.failCount / totalFailures) * 100 : 0;
                cumulativePercentage += failPercentage;

                return {
                    stepNumber: row.stepNumber,
                    totCount: row.totCount,
                    failCount: failFrequency,
                    failPercentage: failPercentage.toFixed(2),
                    cumulativePercentage: cumulativePercentage.toFixed(2),
                };
            });

            res.json(data);
        });
    } catch (error) {
        console.error('Error fetching Pareto failure analysis:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});


export default router;
