const express = require('express');
const fs = require('fs');
const xlsx = require('xlsx'); // Excel library
const { connectToDatabase } = require('./connect3.js'); // Your database connection module
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

// Route to handle GET request
router.get('/', async (req, res) => {
    const financialYear = req.query.financialYear || '';

    if (!financialYear) {
        return res.status(400).json({ error: 'Financial year is required' });
    }

    // Parse financial year
    const matches = financialYear.match(/FY (\d{4})-(\d{4})/);
    if (!matches) {
        return res.status(400).json({ error: 'Invalid financial year format. Use "FY YYYY-YYYY".' });
    }

    const startYear = matches[1];
    const endYear = matches[2];
    const startDate = `${startYear}-03-31`;
    const endDate = `${endYear}-04-01`;
    const currentDate = new Date().toISOString().split('T')[0]; // Today's date

    // Create the financial year data object
    const financialYearData = {
        financialYear: financialYear,
        startYear: startYear,
        endYear: endYear,
        startDate: startDate,
        endDate: endDate,
        currentDate: currentDate
    };

    // Write the data to a JSON file
    const filePath = './financial_year_for_consolidated_retrieved.json';
    fs.writeFile(filePath, JSON.stringify(financialYearData, null, 2), (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to write financial year data to file.' });
        }
        // Return success response
        return res.status(200).json(financialYearData);
    });
});

module.exports = router;
