import express from 'express';
import db from './db.mjs'; // Assume db is initialized with sqlite3
import { promisify } from 'util';

const router = express.Router();

// Promisify db.all to use it as a promise
const dbAll = promisify(db.all).bind(db);

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

router.get('/control-chart-data', async (req, res) => {
    try {
        const { lsl, usl, startDate, endDate, ateSwVersion } = req.query;

        // Set date filters if provided, otherwise set to default values
        const startDateFilter = startDate ? new Date(startDate).toISOString() : '1970-01-01T00:00:00.000Z';
        const endDateFilter = endDate ? new Date(endDate).toISOString() : new Date().toISOString();

        // Step 1: Filter to get only PASS statuses, the most recent file per serial number, and optional AteSwVersion filter
        const files = await dbAll(`
            WITH LatestPassFiles AS (
                SELECT g.serialNumber, MAX(g.testStarted) AS maxTestStarted
                FROM global_metadata g
                JOIN step_data s ON g.id = s.global_id
                WHERE g.uutStatus = 'PASS'
                    AND g.testStarted BETWEEN ? AND ?
                    ${ateSwVersion ? 'AND g.AteSwVersion = ?' : ''}
                GROUP BY g.serialNumber
            )
            SELECT g.id, g.serialNumber, s.stepNumber, s.measureValue, s.limitLow, s.limitHigh
            FROM global_metadata g
            JOIN step_data s ON g.id = s.global_id
            JOIN LatestPassFiles lf ON g.serialNumber = lf.serialNumber AND g.testStarted = lf.maxTestStarted
            WHERE s.stepResult != 'DONE' AND s.units != 'Cnt'
            ORDER BY s.stepNumber, g.testStarted ASC
        `, ateSwVersion ? [startDateFilter, endDateFilter, ateSwVersion] : [startDateFilter, endDateFilter]);

        console.log('Retrieved files from database:', files);

        // Step 2: Organize data by stepNumber
        const stepData = {};
        files.forEach(file => {
            const stepNumber = file.stepNumber;
            const measureValue = parseFloat(file.measureValue);
            const serialNumber = file.serialNumber;

            if (stepNumber && !isNaN(measureValue)) {
                if (!stepData[stepNumber]) {
                    stepData[stepNumber] = {
                        values: [],
                        serialNumbers: [],
                        limitLow: parseFloat(lsl) || parseFloat(file.limitLow),
                        limitHigh: parseFloat(usl) || parseFloat(file.limitHigh)
                    };
                }
                stepData[stepNumber].values.push(measureValue);
                stepData[stepNumber].serialNumbers.push(serialNumber);
            }
        });

        console.log('Organized stepData after validation:', stepData);

        // Step 3: Calculate the metrics for Individual Chart, MR Chart, and Normal Distribution
        const controlChartData = Object.entries(stepData).map(([stepNumber, { values, serialNumbers, limitLow, limitHigh }]) => {
            // Individual Chart Calculations
            const xBar = values.reduce((sum, val) => sum + val, 0) / values.length;
            const mrValues = values.slice(1).map((val, idx) => Math.abs(val - values[idx]));

            const mrBar = mrValues.length > 0 ? mrValues.reduce((sum, mr) => sum + mr, 0) / mrValues.length : 0;

            // Control limits for Individual Chart
            const individualUCL = xBar + (3 * mrBar / 1.128);
            const individualLCL = xBar - (3 * mrBar / 1.128);

            // Control limits for MR Chart
            const mrUCL = mrBar * 3.267; // MR UCL is usually MR-bar * D4 constant (3.267 for n=2)
            const mrLCL = 0; // MR LCL is typically 0 because range cannot be negative

            // Calculate Cp and Cpk
            let cp = null;
            let cpk = null;
            if (mrBar > 0) {
                cp = (limitHigh - limitLow) / (6 * mrBar);
                cpk = Math.min(
                    (limitHigh - xBar) / (3 * mrBar),
                    (xBar - limitLow) / (3 * mrBar)
                );
            }

            // Normal Distribution Calculations
            const mean = xBar;
            const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
            const normalDistribution = Array.from({ length: 100 }, (_, i) => {
                const x = mean - 3 * stdDev + (i / 100) * (6 * stdDev);
                const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2)));
                return { x, y };
            });

            return {
                stepNumber,
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
                normalDistribution,
                lsl: limitLow,
                usl: limitHigh,
                cp,
                cpk
            };
        });

        // Log all retrieved stepNumbers for debugging purposes
        const retrievedStepNumbers = controlChartData.map(data => data.stepNumber);
        //console.log('All retrieved stepNumbers:', retrievedStepNumbers);

        res.json(controlChartData);
    } catch (error) {
        console.error('Error fetching control chart data:', error);
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


// Route to calculate and store UCL, LCL
router.get('/control-chart-data', async (req, res) => {
    try {
        const { lsl, usl, startDate, endDate, ateSwVersion } = req.query;

        // Set date filters if provided, otherwise set to default values
        const startDateFilter = startDate ? new Date(startDate).toISOString() : '1970-01-01T00:00:00.000Z';
        const endDateFilter = endDate ? new Date(endDate).toISOString() : new Date().toISOString();

        // Step 1: Filter to get only PASS statuses, the most recent file per serial number, and optional AteSwVersion filter
        const files = await dbAll(`
            WITH LatestPassFiles AS (
                SELECT g.serialNumber, MAX(g.testStarted) AS maxTestStarted
                FROM global_metadata g
                JOIN step_data s ON g.id = s.global_id
                WHERE g.uutStatus = 'PASS'
                    AND g.testStarted BETWEEN ? AND ?
                    ${ateSwVersion ? 'AND g.AteSwVersion = ?' : ''}
                GROUP BY g.serialNumber
            )
            SELECT g.id, g.serialNumber, s.stepNumber, s.measureValue, s.limitLow, s.limitHigh
            FROM global_metadata g
            JOIN step_data s ON g.id = s.global_id
            JOIN LatestPassFiles lf ON g.serialNumber = lf.serialNumber AND g.testStarted = lf.maxTestStarted
            WHERE s.stepResult != 'DONE' AND s.units != 'Cnt'
            ORDER BY s.stepNumber, g.testStarted ASC
        `, ateSwVersion ? [startDateFilter, endDateFilter, ateSwVersion] : [startDateFilter, endDateFilter]);

        //console.log('Retrieved files from database:', files);

        // Step 2: Organize data by stepNumber
        const stepData = {};
        files.forEach(file => {
            const stepNumber = file.stepNumber;
            const measureValue = parseFloat(file.measureValue);
            const serialNumber = file.serialNumber;

            if (stepNumber && !isNaN(measureValue)) {
                if (!stepData[stepNumber]) {
                    stepData[stepNumber] = {
                        values: [],
                        serialNumbers: [],
                        limitLow: parseFloat(lsl) || parseFloat(file.limitLow),
                        limitHigh: parseFloat(usl) || parseFloat(file.limitHigh)
                    };
                }
                stepData[stepNumber].values.push(measureValue);
                stepData[stepNumber].serialNumbers.push(serialNumber);
            }
        });

        //console.log('Organized stepData after validation:', stepData);

        // Step 3: Calculate the metrics for Individual Chart, MR Chart, and Normal Distribution
        const controlChartData = Object.entries(stepData).map(([stepNumber, { values, serialNumbers, limitLow, limitHigh }]) => {
            // Individual Chart Calculations
            const xBar = values.reduce((sum, val) => sum + val, 0) / values.length;
            const mrValues = values.slice(1).map((val, idx) => Math.abs(val - values[idx]));
            const mrBar = mrValues.length > 0 ? mrValues.reduce((sum, mr) => sum + mr, 0) / mrValues.length : 0;

            // Control limits for Individual Chart
            const individualUCL = xBar + (3 * mrBar / 1.128);
            const individualLCL = xBar - (3 * mrBar / 1.128);

            // Control limits for MR Chart
            const mrUCL = mrBar * 3.267; // MR UCL is usually MR-bar * D4 constant (3.267 for n=2)
            const mrLCL = 0; // MR LCL is typically 0 because range cannot be negative

            // Calculate Cp and Cpk
            let cp = null;
            let cpk = null;
            if (mrBar > 0) {
                cp = (limitHigh - limitLow) / (6 * mrBar);
                cpk = Math.min(
                    (limitHigh - xBar) / (3 * mrBar),
                    (xBar - limitLow) / (3 * mrBar)
                );
            }

            // Normal Distribution Calculations
            const mean = xBar;
            const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);

            const normalDistribution = {
                mean,
                stdDev,
                data: values.map(value => ({
                    value,
                    density: (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(value - mean, 2) / (2 * Math.pow(stdDev, 2)))
                }))
            };

            return {
                stepNumber,
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
        

        // Log all retrieved stepNumbers for debugging purposes
        const retrievedStepNumbers = controlChartData.map(data => data.stepNumber);
        //console.log('All retrieved stepNumbers:', retrievedStepNumbers);

        res.json(controlChartData);
    } catch (error) {
        //console.error('Error fetching control chart data:', error);
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

export default router;

