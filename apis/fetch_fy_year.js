const express = require('express');
const odbc = require('odbc');
const fs = require('fs'); // For file operations
// const { connectToDatabase } = require('./connect3.js'); // Adjust the path as needed for your connection module
const { connectToDatabase } = require('./connect6.js');
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

// Route to handle GET request
router.get('/', async (req, res) => {
    try {
        // Connect to the database
        const db = await connectToDatabase();
        
        // Fetch the greatest posting year from the database
        const queryMaxYear = "SELECT MAX(YEAR(posting_date)) AS max_year FROM consumption_analysis_table";
        const result = await db.query(queryMaxYear);

        // Extract the max year from the result
        const maxYear = result[0]?.max_year || new Date().getFullYear();

        // Get the current year and month
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // Months are 0-based, so add 1

        // Determine the financial years to include
        let financialYears = [];
        if (currentMonth < 3) { // Before March
            financialYears = [
                `FY ${currentYear - 2}-${currentYear - 1}`, // e.g., 2023-2024
                `FY ${currentYear - 1}-${currentYear}`      // e.g., 2024-2025
            ];
        } else { // March or later
            financialYears = [
                `FY ${currentYear - 1}-${currentYear}`,      // e.g., 2024-2025
                `FY ${currentYear}-${currentYear + 1}`      // e.g., 2025-2026
            ];
        }

        // Create the response object
        const response = { financial_years: financialYears };

        // Convert the response to JSON
        const responseJson = JSON.stringify(response);

        // Send the JSON response
        res.json(response);

        // Write the JSON response to fy_sent_back.json file
        fs.writeFileSync('fy_sent_back.json', responseJson);
        
    } catch (error) {
        // Handle potential database errors
        const errorResponse = { error: `Database error: ${error.message}` };
        
        // Send error response
        res.json(errorResponse);

        // Write the error response to fy_sent_back.json file
        fs.writeFileSync('fy_sent_back.json', JSON.stringify(errorResponse));
    }
});

// Export the router
module.exports = router;
