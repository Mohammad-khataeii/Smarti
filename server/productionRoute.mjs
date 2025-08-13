// productionRoute.mjs
import express from 'express';
import db from './db.mjs'; // Assuming db is initialized with sqlite3
import { promisify } from 'util';

const router = express.Router();
const dbGet = promisify(db.get).bind(db);

router.get('/total-production', async (req, res) => {
    try {
        const { startDate, endDate, ateSwVersion, serialNumbers } = req.query;

        // Build SQL conditions based on provided filters
        let dateCondition = '';
        const params = [];
        if (startDate && endDate) {
            dateCondition = `AND testStarted BETWEEN DATE(?) AND DATE(?)`;
            params.push(startDate, endDate);
        }

        let versionCondition = '';
        if (ateSwVersion) {
            versionCondition = `AND ateSwVersion = ?`;
            params.push(ateSwVersion);
        }

        let serialNumberCondition = '';
        if (serialNumbers) {
            const serialArray = Array.isArray(serialNumbers) ? serialNumbers : [serialNumbers];
            serialNumberCondition = `AND serialNumber IN (${serialArray.map(() => '?').join(', ')})`;
            params.push(...serialArray);
        }

        const result = await dbGet(`
            SELECT COUNT(DISTINCT serialNumber) AS totalProduction
            FROM global_metadata
            WHERE uutStatus = 'PASS' ${dateCondition} ${versionCondition} ${serialNumberCondition}
        `, params);

        res.json({ totalProduction: result.totalProduction });
    } catch (error) {
        console.error('Error fetching total production:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route to get distinct serial numbers
router.get('/distinct-serial-numbers', async (req, res) => {
    try {
        const serialNumbers = await new Promise((resolve, reject) => {
            db.all(`
                SELECT DISTINCT serialNumber 
                FROM global_metadata
                ORDER BY serialNumber
            `, (err, rows) => {
                if (err) {
                    console.error('Error fetching distinct serial numbers:', err.message);
                    return reject(err);
                }
                resolve(rows.map(row => row.serialNumber));
            });
        });

        res.json(serialNumbers);
    } catch (error) {
        console.error('Error fetching distinct serial numbers:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});


export default router;
