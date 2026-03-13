import express from 'express';
import db from './db.mjs'; // Assume db is initialized with sqlite3
import { promisify } from 'util';

const router = express.Router();

// Promisify db.all to use it as a promise
const dbAll = promisify(db.all).bind(db);

router.get('/control-chart-data', async (req, res) => {
    try {
        const { lsl, usl, startDate, endDate, ateSwVersion, Testspec } = req.query;

        const startDateFilter = startDate || '1970-01-01 00:00:00';
        const endDateFilter = endDate || '9999-12-31 23:59:59';

        let latestPassWhere = `
            g.uutStatus = 'PASS'
            AND g.testStarted BETWEEN ? AND ?
        `;

        const params = [startDateFilter, endDateFilter];

        if (ateSwVersion) {
            latestPassWhere += ` AND g.AteSwVersion = ?`;
            params.push(ateSwVersion);
        }

        if (Testspec) {
            latestPassWhere += ` AND g.Testspec = ?`;
            params.push(Testspec);
        }

        const query = `
            WITH LatestPassFiles AS (
                SELECT g.serialNumber, MAX(g.testStarted) AS maxTestStarted
                FROM global_metadata g
                JOIN step_data s ON g.id = s.global_id
                WHERE ${latestPassWhere}
                GROUP BY g.serialNumber
            )
            SELECT 
                g.id,
                g.serialNumber,
                g.testStarted,
                g.AteSwVersion,
                g.Testspec,
                s.stepNumber,
                s.measureValue,
                s.limitLow,
                s.limitHigh,
                s.stepResult,
                s.units
            FROM global_metadata g
            JOIN step_data s ON g.id = s.global_id
            JOIN LatestPassFiles lf 
                ON g.serialNumber = lf.serialNumber 
                AND g.testStarted = lf.maxTestStarted
            WHERE s.stepResult != 'DONE'
              AND s.units != 'Cnt'
            ORDER BY s.stepNumber, g.testStarted ASC
        `;

        console.log('Incoming query params:', req.query);
        console.log('SQL params:', params);

        const files = await dbAll(query, params);

        console.log('Retrieved files from database:', files);

        const stepData = {};

        files.forEach((file) => {
            const stepNumber = file.stepNumber;
            const measureValue = parseFloat(file.measureValue);
            const serialNumber = file.serialNumber;

            if (stepNumber !== null && stepNumber !== undefined && !isNaN(measureValue)) {
                if (!stepData[stepNumber]) {
                    stepData[stepNumber] = {
                        values: [],
                        serialNumbers: [],
                        limitLow: lsl !== undefined && lsl !== '' ? parseFloat(lsl) : parseFloat(file.limitLow),
                        limitHigh: usl !== undefined && usl !== '' ? parseFloat(usl) : parseFloat(file.limitHigh)
                    };
                }

                stepData[stepNumber].values.push(measureValue);
                stepData[stepNumber].serialNumbers.push(serialNumber);
            }
        });

        console.log('Organized stepData after validation:', stepData);

        const controlChartData = Object.entries(stepData).map(([stepNumber, { values, serialNumbers, limitLow, limitHigh }]) => {
            const xBar = values.reduce((sum, val) => sum + val, 0) / values.length;

            const mrValues = values.slice(1).map((val, idx) => Math.abs(val - values[idx]));
            const mrBar = mrValues.length > 0
                ? mrValues.reduce((sum, mr) => sum + mr, 0) / mrValues.length
                : 0;

            const individualUCL = xBar + (3 * mrBar / 1.128);
            const individualLCL = xBar - (3 * mrBar / 1.128);

            const mrUCL = mrBar * 3.267;
            const mrLCL = 0;

            let cp = null;
            let cpk = null;

            if (mrBar > 0 && !isNaN(limitLow) && !isNaN(limitHigh)) {
                cp = (limitHigh - limitLow) / (6 * mrBar);
                cpk = Math.min(
                    (limitHigh - xBar) / (3 * mrBar),
                    (xBar - limitLow) / (3 * mrBar)
                );
            }

            const mean = xBar;
            const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);

            const normalDistribution = {
                mean,
                stdDev,
                data: stdDev > 0
                    ? values.map((value) => ({
                        value,
                        density:
                            (1 / (stdDev * Math.sqrt(2 * Math.PI))) *
                            Math.exp(-Math.pow(value - mean, 2) / (2 * Math.pow(stdDev, 2)))
                    }))
                    : []
            };

            return {
                stepNumber: String(stepNumber),
                serialNumbers,
                values,
                movingRanges: mrValues,
                individualChart: {
                    xBar,
                    ucl: individualUCL,
                    lcl: individualLCL
                },
                mrChart: {
                    mrBar,
                    ucl: mrUCL,
                    lcl: mrLCL
                },
                lsl: limitLow,
                usl: limitHigh,
                cp,
                cpk,
                normalDistribution
            };
        });

        res.json(controlChartData);
    } catch (error) {
        console.error('Error fetching control chart data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route to get distinct AteSwVersion values with their counts
router.get('/ate-sw-versions', async (req, res) => {
    try {
        const versions = await dbAll(`
            SELECT AteSwVersion, COUNT(*) as count
            FROM global_metadata
            GROUP BY AteSwVersion
        `);

        res.json(versions);
    } catch (error) {
        console.error('Error fetching AteSwVersion data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route to get distinct Testspec values with their counts
router.get('/testspecs', async (req, res) => {
    try {
        const testspecs = await dbAll(`
            SELECT Testspec, COUNT(*) as count
            FROM global_metadata
            GROUP BY Testspec
        `);

        res.json(testspecs);
    } catch (error) {
        console.error('Error fetching Testspec data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});






// Route to fetch distinct filenames from global_metadata
router.get('/filenames', async (req, res) => {
    try {
        const filenames = await dbAll(`
            SELECT DISTINCT 
                filename, 
                serialNumber, 
                testStarted, 
                AteSwVersion 
            FROM global_metadata
            WHERE uutStatus = 'PASS'
        `);
        res.json(filenames);
    } catch (error) {
        console.error('Error fetching filenames:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// Route to fetch previous calculations
router.get('/ucl-lcl-calculations', async (req, res) => {
    try {
        const calculations = await dbAll(`
            SELECT * FROM ucl_lcl_calculations
            ORDER BY createdAt DESC
        `);
        res.json(calculations);
    } catch (error) {
        console.error('Error fetching UCL and LCL calculations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/calculate-ucl-lcl', express.json(), async (req, res) => {
    try {
        const { selectedFilenames, stepNumber } = req.body;

        console.log('POST /calculate-ucl-lcl body:', req.body);

        if (!Array.isArray(selectedFilenames) || selectedFilenames.length === 0) {
            return res.status(400).json({
                error: 'selectedFilenames must be a non-empty array'
            });
        }

        if (!stepNumber || typeof stepNumber !== 'string') {
            return res.status(400).json({
                error: 'stepNumber is required and must be a string'
            });
        }

        const placeholders = selectedFilenames.map(() => '?').join(',');
        const params = [...selectedFilenames, stepNumber];

        const query = `
            SELECT
                g.filename,
                g.serialNumber,
                g.testStarted,
                s.stepNumber,
                s.measureValue,
                s.limitLow,
                s.limitHigh,
                s.stepResult,
                s.units
            FROM global_metadata g
            JOIN step_data s ON g.id = s.global_id
            WHERE g.filename IN (${placeholders})
              AND s.stepNumber = ?
              AND g.uutStatus = 'PASS'
              AND s.stepResult != 'DONE'
              AND s.units != 'Cnt'
            ORDER BY g.testStarted ASC
        `;

        console.log('calculate-ucl-lcl SQL:', query);
        console.log('calculate-ucl-lcl params:', params);

        const rows = await dbAll(query, params);

        console.log('calculate-ucl-lcl rows:', rows);

        const validRows = rows.filter((row) => {
            const value = parseFloat(row.measureValue);
            return !isNaN(value);
        });

        if (validRows.length === 0) {
            return res.status(404).json({
                error: 'No data found for the selected filenames and step number.'
            });
        }

        const values = validRows.map((row) => parseFloat(row.measureValue));
        const serialNumbers = validRows.map((row) => row.serialNumber);
        const filenames = validRows.map((row) => row.filename);

        const xBar = values.reduce((sum, val) => sum + val, 0) / values.length;

        const movingRanges = values.slice(1).map((val, idx) => Math.abs(val - values[idx]));

        const mrBar =
            movingRanges.length > 0
                ? movingRanges.reduce((sum, mr) => sum + mr, 0) / movingRanges.length
                : 0;

        const individualUCL = xBar + (3 * mrBar / 1.128);
        const individualLCL = xBar - (3 * mrBar / 1.128);

        const mrUCL = mrBar * 3.267;
        const mrLCL = 0;

        const firstRow = validRows[0];
        const lsl = parseFloat(firstRow.limitLow);
        const usl = parseFloat(firstRow.limitHigh);

        let cp = null;
        let cpk = null;

        if (mrBar > 0 && !isNaN(lsl) && !isNaN(usl)) {
            cp = (usl - lsl) / (6 * mrBar);
            cpk = Math.min(
                (usl - xBar) / (3 * mrBar),
                (xBar - lsl) / (3 * mrBar)
            );
        }

        const mean = xBar;
        const variance =
            values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        const normalDistribution = {
            mean,
            stdDev,
            data:
                stdDev > 0
                    ? values.map((value) => ({
                        value,
                        density:
                            (1 / (stdDev * Math.sqrt(2 * Math.PI))) *
                            Math.exp(-Math.pow(value - mean, 2) / (2 * Math.pow(stdDev, 2)))
                    }))
                    : []
        };

        const results = {
            stepNumber: String(stepNumber),
            filenames,
            serialNumbers,
            values,
            movingRanges,
            individualChart: {
                xBar,
                ucl: individualUCL,
                lcl: individualLCL
            },
            mrChart: {
                mrBar,
                ucl: mrUCL,
                lcl: mrLCL
            },
            lsl: !isNaN(lsl) ? lsl : null,
            usl: !isNaN(usl) ? usl : null,
            cp,
            cpk,
            normalDistribution
        };

        return res.json({ results });
    } catch (error) {
        console.error('Error in /calculate-ucl-lcl:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;

