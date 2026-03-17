// fileManagementRoutes.mjs
import express from 'express';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import os from 'os';
import path from 'path';

const router = express.Router();

const dbPath = path.join(os.homedir(), '.smarti_data', 'test_results.db');
const dbPromise = open({
    filename: dbPath,
    driver: sqlite3.Database,
});

// Endpoint to get all records with optional filtering by serial number and date range
router.get('/global_metadata', async (req, res) => {
    const { fileName, serialNumber, startDate, endDate, ateSwVersion, uutStatus } = req.query;

    try {
        const db = await dbPromise;
        let query = `SELECT id, filename, serialNumber, uutStatus, testStarted, testStopped, AteSwVersion FROM global_metadata`;
        const conditions = [];
        const params = [];

        // Add filtering conditions
        if (fileName) {
            conditions.push(`filename LIKE ?`);
            params.push(`%${fileName}%`);
        }
        
        if (serialNumber) {
            conditions.push(`serialNumber = ?`);
            params.push(serialNumber);
        }
        if (startDate) {
            conditions.push(`testStarted >= ?`);
            params.push(startDate);
        }
        if (endDate) {
            conditions.push(`testStopped <= ?`);
            params.push(endDate);
        }
        if (ateSwVersion) {
            conditions.push(`ateSwVersion = ?`);
            params.push(ateSwVersion);
        }
        if (uutStatus) {
            conditions.push(`uutStatus = ?`);
            params.push(uutStatus);
        }

        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(' AND ');
        }

        const results = await db.all(query, params);
        res.json(results);
    } catch (error) {
        console.error('Error fetching records:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// fileManagementRoutes.mjs

// Endpoint to get step details for a specific file
router.get('/test_steps', async (req, res) => {
    const { fileId } = req.query;

    if (!fileId) {
        return res.status(400).json({ message: 'File ID is required' });
    }

    try {
        const db = await dbPromise;
        const query = `
            SELECT stepNumber, stepResult
            FROM step_data
            WHERE global_id = ?
            ORDER BY stepNumber
        `;
        const results = await db.all(query, [fileId]);

        res.json(results);
    } catch (error) {
        console.error('Error fetching test steps:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Endpoint to delete multiple records by IDs
router.delete('/global_metadata', async (req, res) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Invalid request. Provide an array of IDs.' });
    }

    try {
        const db = await dbPromise;
        const placeholders = ids.map(() => '?').join(',');
        await db.run(`DELETE FROM global_metadata WHERE id IN (${placeholders})`, ids);
        res.json({ message: `${ids.length} records deleted successfully` });
    } catch (error) {
        console.error('Error deleting records:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Endpoint to delete all records
router.delete('/global_metadata/all', async (req, res) => {
    try {
        const db = await dbPromise;
        await db.run(`DELETE FROM global_metadata WHERE 1=1`);
        res.json({ message: 'All records deleted successfully' });
    } catch (error) {
        console.error('Error deleting all records:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Endpoint to delete a single record by ID
router.delete('/global_metadata/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const db = await dbPromise;
        await db.run(`DELETE FROM global_metadata WHERE id = ?`, id);
        res.json({ message: `Record with ID ${id} deleted successfully` });
    } catch (error) {
        console.error('Error deleting record:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});





// Route to get UUT status count within a date range
router.get('/uut-status-count', async (req, res) => {
    try {
        const db = await dbPromise;
        const { startDate, endDate, ateSwVersion, serialNumbers } = req.query;

        let conditions = [];
        let params = [];

        // Optional: exclude invalid serials
        conditions.push(`serialNumber != ?`);
        params.push('NOUUTSN');

        if (startDate && endDate) {
            conditions.push(`testStarted BETWEEN DATE(?) AND DATE(?)`);
            params.push(startDate, endDate);
        }

        if (ateSwVersion) {
            conditions.push(`ateSwVersion = ?`);
            params.push(ateSwVersion);
        }

        if (serialNumbers) {
            const serialArray = Array.isArray(serialNumbers) ? serialNumbers : [serialNumbers];
            conditions.push(`serialNumber IN (${serialArray.map(() => '?').join(', ')})`);
            params.push(...serialArray);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const rows = await db.all(`
            SELECT 
                serialNumber,
                MAX(
                    CASE 
                        WHEN uutStatus IS NULL OR TRIM(uutStatus) != 'PASS' THEN 1 
                        ELSE 0 
                    END
                ) AS isFail
            FROM global_metadata
            ${whereClause}
            GROUP BY serialNumber
        `, params);

        const totalProduction = rows.length;
        const failCount = rows.filter(row => row.isFail === 1).length;
        const passCount = totalProduction - failCount;

        if (totalProduction === 0) {
            return res.json({ PASS: "0.00", FAIL: "0.00" });
        }

        const passPercentage = (passCount / totalProduction) * 100;
        const failPercentage = (failCount / totalProduction) * 100;

        res.json({
            PASS: passPercentage.toFixed(2),
            FAIL: failPercentage.toFixed(2)
        });

    } catch (error) {
        console.error('Error fetching UUT status count:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});








// Route to get UUT status details within a date range
router.get('/uut-status-details', async (req, res) => {
    const { status, startDate, endDate, ateSwVersion, serialNumbers } = req.query;

    if (!status || (status !== 'PASS' && status !== 'FAIL')) {
        return res.status(400).json({ message: 'Invalid status parameter' });
    }

    try {
        const db = await dbPromise;

        const conditions = [];
        const params = [];

        // Optional: skip invalid serials
        conditions.push(`serialNumber != ?`);
        params.push('NOUUTSN');

        if (startDate && endDate) {
            conditions.push(`testStarted BETWEEN DATE(?) AND DATE(?)`);
            params.push(startDate, endDate);
        }

        if (ateSwVersion) {
            conditions.push(`ateSwVersion = ?`);
            params.push(ateSwVersion);
        }

        if (serialNumbers) {
            const serialArray = Array.isArray(serialNumbers) ? serialNumbers : [serialNumbers];
            conditions.push(`serialNumber IN (${serialArray.map(() => '?').join(', ')})`);
            params.push(...serialArray);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const query = `
            SELECT
                serialNumber,
                CASE
                    WHEN MAX(
                        CASE
                            WHEN uutStatus IS NULL OR TRIM(UPPER(uutStatus)) != 'PASS' THEN 1
                            ELSE 0
                        END
                    ) = 1 THEN 'FAIL'
                    ELSE 'PASS'
                END AS finalStatus,
                CASE
                    WHEN MAX(
                        CASE
                            WHEN uutStatus IS NULL OR TRIM(UPPER(uutStatus)) != 'PASS' THEN 1
                            ELSE 0
                        END
                    ) = 1
                        THEN SUM(
                            CASE
                                WHEN uutStatus IS NULL OR TRIM(UPPER(uutStatus)) != 'PASS' THEN 1
                                ELSE 0
                            END
                        )
                    ELSE SUM(
                        CASE
                            WHEN TRIM(UPPER(uutStatus)) = 'PASS' THEN 1
                            ELSE 0
                        END
                    )
                END AS count,
                SUM(
                    CASE
                        WHEN uutStatus IS NULL OR TRIM(UPPER(uutStatus)) != 'PASS' THEN 1
                        ELSE 0
                    END
                ) AS failCount,
                SUM(
                    CASE
                        WHEN TRIM(UPPER(uutStatus)) = 'PASS' THEN 1
                        ELSE 0
                    END
                ) AS passCount,
                COUNT(*) AS totalTests
            FROM global_metadata
            ${whereClause}
            GROUP BY serialNumber
            HAVING finalStatus = ?
            ORDER BY serialNumber
        `;

        const result = await db.all(query, [...params, status]);
        res.json(result);
    } catch (error) {
        console.error('Error fetching UUT status details:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/failure-rate-monthly', async (req, res) => {
    try {
        const db = await dbPromise;
        const { startDate, endDate, ateSwVersion, serialNumbers } = req.query;

        // Build SQL conditions based on provided filters
        let dateCondition = '';
        const params = [];
        if (startDate && endDate) {
            dateCondition = `AND testStarted BETWEEN DATE(?) AND DATE(?)`;
            params.push(
                startDate.replace(/\//g, '-'),
                endDate.replace(/\//g, '-')
            );
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

        // Query to group data by month and calculate failure rates
        const monthlyData = await db.all(`
            SELECT 
                strftime('%Y-%m', REPLACE(testStarted, '/', '-')) AS month,
                COUNT(DISTINCT serialNumber) AS total,
                SUM(CASE WHEN uutStatus = 'PASS' THEN 1 ELSE 0 END) AS passCount
            FROM global_metadata
            WHERE testStarted IS NOT NULL
            AND testStarted != ''
            ${dateCondition} ${versionCondition} ${serialNumberCondition}
            GROUP BY strftime('%Y-%m', REPLACE(testStarted, '/', '-'))
            HAVING total > 0
            ORDER BY month ASC;
        `, params);

        // Transform data to calculate failure rate for each month
        const formattedData = monthlyData.map(row => {
            const failCount = row.total - row.passCount;
            const failRate = row.total ? (failCount / row.total) * 100 : 0;

            return {
                month: row.month || "Unknown",
                failureRate: Math.max(0, failRate).toFixed(2),
            };
        });

        res.json(formattedData);
    } catch (error) {
        console.error('Error fetching monthly failure rate:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});











export default router;
