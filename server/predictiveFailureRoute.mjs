// predictiveAnalysisRoute.mjs
import express from 'express';
import { spawn } from 'child_process';
import db from './db.mjs'; // SQLite database initialization
import { promisify } from 'util';

const router = express.Router();
const dbAll = promisify(db.all).bind(db);

router.get('/predictive-analysis', async (req, res) => {
    try {
        const { stepNumber, startDate, endDate } = req.query;

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
            dateFilter += ' AND Date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            dateFilter += ' AND Date <= ?';
            params.push(endDate);
        }

        // Fetch historical data for the specific step from the database
        const historicalData = await dbAll(`
            SELECT Date, FailCount
            FROM failure_data
            WHERE StepNumber = ?
            ${dateFilter}
            ORDER BY Date
        `, params);

        if (historicalData.length === 0) {
            return res.json({ message: 'No historical data available for the selected step.' });
        }

        // Pass data to the Python script and retrieve the forecast
        const pythonProcess = spawn('python', ['predict_failures.py', JSON.stringify(historicalData)]);

        let pythonOutput = '';
        let pythonError = '';

        // Collect Python script output
        pythonProcess.stdout.on('data', (data) => {
            pythonOutput += data.toString();
        });

        // Collect Python script errors
        pythonProcess.stderr.on('data', (data) => {
            pythonError += data.toString();
        });

        // Handle Python script completion
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const forecastData = JSON.parse(pythonOutput);
                    return res.json(forecastData); // Return the forecasted data to the frontend
                } catch (err) {
                    console.error('Error parsing Python output:', err.message);
                    return res.status(500).json({ message: 'Error processing forecast data' });
                }
            } else {
                console.error('Python script exited with code:', code);
                console.error('Python error output:', pythonError);
                return res.status(500).json({ message: 'Error generating forecast' });
            }
        });
    } catch (error) {
        console.error('Error performing predictive analysis:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
