const express = require('express');
const fs = require('fs'); // File system module for file handling

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
router.get('/', (req, res) => {
    // Extract the financial year from query parameters
    const financialYear = req.query.financialYear || '';

    // Validate the financial year
    if (!financialYear) {
        return res.status(400).json({ error: 'Financial year is required' });
    }

    // Object to store the financial year
    const data = { financialYear };

    // Path to the JSON file
    const jsonFilePath = './financial_year_data_for_segregated.json';

    try {
        // Write the financial year to the JSON file
        fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2));
        console.log(`Financial year saved to ${jsonFilePath}`);

        // Send a success response
        res.status(200).json({ message: 'Financial year saved successfully', data });
    } catch (err) {
        console.error('Error writing financial year to file:', err);
        res.status(500).json({ error: 'Error writing financial year to file' });
    }
});

// Export the router
module.exports = router;
