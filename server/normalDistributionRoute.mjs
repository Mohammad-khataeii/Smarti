import express from 'express';
import db from './db.mjs'; // Assume db is initialized with sqlite3
import { promisify } from 'util';

const router = express.Router();

// Promisify db.all to use it as a promise
const dbAll = promisify(db.all).bind(db);

router.get('/normal-distribution', async (req, res) => {
    try {
        const { stepNumber, lsl, usl, startDate, endDate, ateSwVersion } = req.query;

        if (!stepNumber) {
            return res.status(400).json({ error: 'StepNumber is required.' });
        }

        // Default date filters
        const startDateFilter = startDate ? new Date(startDate).toISOString() : '1970-01-01T00:00:00.000Z';
        const endDateFilter = endDate ? new Date(endDate).toISOString() : new Date().toISOString();

        // Fetch data with the same selection logic as `/control-chart-data`
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
            WHERE s.stepResult != 'DONE' 
              AND s.units != 'Cnt'
              AND s.stepNumber = ?
            ORDER BY g.testStarted ASC
        `, ateSwVersion
            ? [startDateFilter, endDateFilter, ateSwVersion, stepNumber]
            : [startDateFilter, endDateFilter, stepNumber]);

        if (!files.length) {
            return res.status(404).json({ error: 'No data found for the specified step number and filters.' });
        }

        // Extract measure values and limits
        const values = files.map(file => parseFloat(file.measureValue)).filter(val => !isNaN(val));
        const lowerSpecLimit = lsl ? parseFloat(lsl) : parseFloat(files[0].limitLow);
        const upperSpecLimit = usl ? parseFloat(usl) : parseFloat(files[0].limitHigh);

        // Step 1: Calculate Mean (xBar) and Moving Range (mrBar)
        const xBar = values.reduce((sum, val) => sum + val, 0) / values.length;
        const movingRanges = values.slice(1).map((val, idx) => Math.abs(val - values[idx]));
        const mrBar = movingRanges.length > 0
            ? movingRanges.reduce((sum, mr) => sum + mr, 0) / movingRanges.length
            : 0;

        // Step 2: Calculate Cp and Cpk
        let cp = null;
        let cpk = null;
        if (mrBar > 0) {
            cp = (upperSpecLimit - lowerSpecLimit) / (6 * mrBar);
            cpk = Math.min(
                (upperSpecLimit - xBar) / (3 * mrBar),
                (xBar - lowerSpecLimit) / (3 * mrBar)
            );
        }

        // Step 3: Calculate Number of Bins (K) Using Rice Rule
        const n = values.length; // Number of data points
        const K = Math.ceil(2 * Math.cbrt(n)); // Rice Rule for K
        const maxVal = Math.max(...values);
        const minVal = Math.min(...values);
        const rangeOfData = maxVal - minVal;
        const omega = rangeOfData / K; // Bin width

        const histogramBins = Array(K).fill(0); // Initialize bins
        values.forEach(value => {
            const binIndex = Math.min(
                K - 1,
                Math.floor((value - minVal) / omega)
            );
            histogramBins[binIndex] += 1;
        });

        const histogramData = histogramBins.map((count, index) => ({
            x: minVal + index * omega, // Bin start
            y: count / values.length, // Normalize frequency to density
        }));

        // Step 4: Generate Fitted Normal Curve
        const sigma = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - xBar, 2), 0) / n);
        const fittedNormalCurve = [];
        const stepSize = rangeOfData / 100; // 100 points for a smooth curve
        for (let x = minVal; x <= maxVal; x += stepSize) {
            const y = (1 / (sigma * Math.sqrt(2 * Math.PI))) *
                      Math.exp(-0.5 * Math.pow((x - xBar) / sigma, 2));
            fittedNormalCurve.push({ x, y });
        }

        // Step 5: Response
        res.json({
            stepNumber,
            values, // Raw measure values
            histogramData, // Binned histogram data
            fittedNormalCurve, // Normal curve based on data
            omega, // Bin width
            xBar,
            movingRanges,
            mrBar,
            lsl: lowerSpecLimit,
            usl: upperSpecLimit,
            cp,
            cpk,
            ucl: xBar + (3 * mrBar / 1.128),
            lcl: xBar - (3 * mrBar / 1.128),
        });
    } catch (error) {
        console.error('Error fetching normal distribution data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



export default router;
