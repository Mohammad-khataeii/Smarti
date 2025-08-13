import express from 'express';
import db from './db.mjs';

const router = express.Router();

// API endpoint to get the total count of PASS and FAIL for each serial number with date range and serial number filtering
router.get('/uut-status-summary', async (req, res) => {
    try {
        const { startDate, endDate, serialNumbers } = req.query;

        // Build the date condition based on the provided date range
        let dateCondition = '';
        if (startDate && endDate) {
            dateCondition += `AND testStarted BETWEEN DATE(?) AND DATE(?) `;
        }

        // Build the serial number condition if specific serial numbers are selected
        let serialNumberCondition = '';
        const serialNumberArray = serialNumbers ? serialNumbers.split(',') : [];
        if (serialNumberArray.length > 0) {
            const placeholders = serialNumberArray.map(() => '?').join(',');
            serialNumberCondition += `AND serialNumber IN (${placeholders}) `;
        }

        // Combine both conditions into the SQL query
        const query = `
            SELECT serialNumber,
                SUM(CASE WHEN uutStatus = 'PASS' THEN 1 ELSE 0 END) AS passCount,
                SUM(CASE WHEN uutStatus = 'FAIL' THEN 1 ELSE 0 END) AS failCount,
                SUM(CASE WHEN uutStatus = 'STOP' THEN 1 ELSE 0 END) AS stopCount
            FROM global_metadata
            WHERE 1=1 ${dateCondition} ${serialNumberCondition}
            GROUP BY serialNumber
            ORDER BY serialNumber
        `;

        const queryParams = [];
        if (startDate && endDate) {
            queryParams.push(startDate, endDate);
        }
        queryParams.push(...serialNumberArray);

        // Query to count PASS and FAIL per serial number within the specified date range and for the selected serial numbers
        const result = await new Promise((resolve, reject) => {
            db.all(query, queryParams, (err, rows) => {
                if (err) {
                    console.error('Error fetching UUT status summary:', err.message);
                    reject(err);
                } else {
                    console.log("API Result:", rows);
                    resolve(rows);
                }
            });
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching UUT status summary:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// API endpoint to get distinct serial numbers
router.get('/serial-numbers', async (req, res) => {
    try {
        // Query to get unique serial numbers from global_metadata
        const result = await new Promise((resolve, reject) => {
            db.all(`
                SELECT DISTINCT serialNumber 
                FROM global_metadata 
                ORDER BY serialNumber
            `, (err, rows) => {
                if (err) {
                    console.error('Error fetching serial numbers:', err.message);
                    reject(err);
                } else {
                    const serialNumbers = rows.map(row => row.serialNumber);
                    console.log('Fetched Serial Numbers:', serialNumbers);
                    resolve(serialNumbers);
                }
            });
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching serial numbers:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
