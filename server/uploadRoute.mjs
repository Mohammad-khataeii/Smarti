// uploadRoute.mjs
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Initialize SQLite database
const initializeDatabase = async () => {
  const db = await open({
    filename: './test_results.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS global_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machineIdentifier TEXT,
      stationName TEXT,
      serialNumber TEXT,
      uutStatus TEXT,
      testStarted TEXT,
      testStopped TEXT,
      AteSwVersion TEXT,
      Testspec TEXT,
      filename TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS step_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      global_id INTEGER,
      stepNumber TEXT,
      stepResult TEXT,
      stepName TEXT,
      stepTime TEXT,
      measureType TEXT,
      units TEXT,
      measureValue TEXT,
      limitLow TEXT,
      limitHigh TEXT,
      measureString TEXT,
      limitString TEXT,
      FOREIGN KEY (global_id) REFERENCES global_metadata(id)
    );
  `);

  // Execute once to create the new table
await db.exec(`
  CREATE TABLE IF NOT EXISTS ucl_lcl_calculations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      stepNumber TEXT,
      ucl REAL,
      lcl REAL,
      cp REAL,
      cpk REAL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

    
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL
    ) 
  `);
  return db;
};

// Parse and save file data
router.post('/upload', upload.array('files'), async (req, res) => {
  const files = req.files;
  const responseArray = [];

  const db = await initializeDatabase();

  for (const file of files) {
    try {
      const ext = path.extname(file.originalname);
      if (ext === '.csv') {
        const data = {};

        const lines = fs.readFileSync(file.path, 'utf-8').split('\n');
        lines.forEach((line) => {
          const [key, value] = line.split(';');
          const trimmedKey = key ? key.trim() : null;
          const trimmedValue = value ? value.trim() : null;

          if (trimmedKey) {
            data[trimmedKey] = trimmedValue;
          }
        });

        const globalValues = {
          machineIdentifier: data['MachineIdentifier'] || null,
          stationName: data['StationName'] || null,
          serialNumber: data['SerialNumber'] || data['MachineIdentifier'],
          uutStatus: data['UUT Status'] || null,
          testStarted: data['TestStarted'] || null,
          testStopped: data['TestStopped'] || null,
          AteSwVersion: data['AteSwVersion'] || null,
          Testspec: data['Testspec'] || null,
          filename: file.originalname
        };

        console.log("Extracted Global Metadata:", globalValues);

        // Check for duplicate filename
        const existingRecord = await db.get(`
          SELECT * FROM global_metadata
          WHERE filename = ?
        `, [globalValues.filename]);

        if (existingRecord) {
          console.log(`Duplicate filename detected: ${file.originalname}. Skipping upload.`);
          responseArray.push({
            global: globalValues,
            data: [], // No step data as it's a duplicate
            message: 'Duplicate filename, skipped upload'
          });
          continue; // Move to the next file in the loop
        }

        const result = await db.run(`
          INSERT INTO global_metadata (
            machineIdentifier, stationName, serialNumber, uutStatus, testStarted, testStopped, AteSwVersion, Testspec, filename
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          globalValues.machineIdentifier,
          globalValues.stationName,
          globalValues.serialNumber,
          globalValues.uutStatus,
          globalValues.testStarted,
          globalValues.testStopped,
          globalValues.AteSwVersion,
          globalValues.Testspec,
          globalValues.filename
        ]);

        const globalId = result.lastID;

        const csvData = await fsPromises.readFile(file.path, 'utf8');
        const stepData = [];
        let tableStartFound = false;
        const mainTableHeaders = [
          'Step_Number', 'Step_Result', 'Step_Name', 'StepTime', 'Measure_Type', 
          'Units', 'Measure_Value', 'LimitLow', 'LimitHigh', 'Measure_string', 'LimitString'
        ];

        Papa.parse(csvData, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            results.data.forEach((row, rowIndex) => {
              if (!tableStartFound && row.length >= mainTableHeaders.length && mainTableHeaders.every((header, i) => row[i]?.trim() === header)) {
                tableStartFound = true;
                console.log("Main table header detected at row:", rowIndex, "Headers:", row);
                return;
              }

              if (tableStartFound) {
                const [stepNumber, stepResult, stepName, stepTime, measureType, units, measureValue, limitLow, limitHigh, measureStr, limitString] = row.map(cell => cell?.trim() || null);

                if (stepNumber && /^[0-9.]+$/.test(stepNumber)) {
                  const rowData = {
                    Step_Number: stepNumber,
                    Step_Result: stepResult,
                    Step_Name: stepName,
                    StepTime: stepTime,
                    Measure_Type: measureType,
                    Units: units,
                    Measure_Value: measureValue,
                    LimitLow: limitLow,
                    LimitHigh: limitHigh,
                    Measure_string: measureStr,
                    LimitString: limitString
                  };

                  console.log("Step Data Row:", rowData);

                  db.run(`
                    INSERT INTO step_data (
                      global_id, stepNumber, stepResult, stepName, stepTime, measureType, units, 
                      measureValue, limitLow, limitHigh, measureString, limitString
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `, [
                    globalId,
                    rowData.Step_Number,
                    rowData.Step_Result,
                    rowData.Step_Name,
                    rowData.StepTime,
                    rowData.Measure_Type,
                    rowData.Units,
                    rowData.Measure_Value,
                    rowData.LimitLow,
                    rowData.LimitHigh,
                    rowData.Measure_string,
                    rowData.LimitString
                  ]);

                  stepData.push(rowData);
                }
              }
            });
          }
        });

        console.log("Extracted Step Data for File:", stepData);

        responseArray.push({
          global: globalValues,
          data: stepData
        });
      }
    } catch (error) {
      console.error('Error processing file:', error);
    }
  }

  await db.close();
  res.json(responseArray);
});


export default router;
