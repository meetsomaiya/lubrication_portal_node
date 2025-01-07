const express = require('express');
const fs = require('fs');
const moment = require('moment-timezone'); // Import moment-timezone
const { connectToDatabase } = require('./connect5.js'); // Your database connection module
const ExcelJS = require('exceljs');

const router = express.Router();

// Set up CORS middleware
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '3600');
    next();
});

// Middleware to parse JSON bodies
router.use(express.json());

// Route to handle the reason submission
router.post('/', (req, res) => {
    // Extract the data from the request body
    const { reason, orderNo, domainId, functionLoc } = req.body;

    if (!reason || !orderNo || !domainId || !functionLoc) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get the current timestamp in IST (Asia/Kolkata)
    const timestamp = moment().tz('Asia/Kolkata').format();  // ISO 8601 format with IST timezone

    // Create the data object to save to the JSON file
    const reasonData = {
        reason,
        orderNo,
        domainId,
        functionLoc,
        timestamp, // Use the converted IST timestamp
    };

    // Log the data to be written
    console.log('Received data:', reasonData);

    // Read the existing data from the JSON file
    fs.readFile('reason_for_wtg_planning.json', (err, data) => {
        if (err && err.code !== 'ENOENT') {
            return res.status(500).json({ error: 'Error reading the JSON file' });
        }

        let reasons = [];
        if (!err) {
            reasons = JSON.parse(data);
        }

        // Add the new reason data to the list
        reasons.push(reasonData);

        // Write the updated data back to the JSON file
        fs.writeFile('reason_for_wtg_planning.json', JSON.stringify(reasons, null, 2), (writeErr) => {
            if (writeErr) {
                return res.status(500).json({ error: 'Error writing to the JSON file' });
            }

            // Send success response
            res.status(200).json({ message: 'Reason added successfully', data: reasonData });
        });
    });
});

module.exports = router;
