const express = require('express');
const odbc = require('odbc');
const fs = require('fs'); // For file operations
const { connectToDatabase } = require('./connect3.js'); // Adjust the path as needed for your connection module
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

        // Get the current year
        const currentYear = new Date().getFullYear();

        // Generate an array of financial years from the greatest year to the next year
        let financialYears = [];
        for (let year = maxYear; year <= currentYear + 1; year++) {
            financialYears.push(year);
        }

        // Ensure the current year is included
        if (!financialYears.includes(currentYear)) {
            financialYears.push(currentYear);
        }

        // Format financial years as "FY {start_year}-{end_year}"
        const formattedYears = financialYears.map(year => {
            return `FY ${year - 1}-${year}`; // Full year format (e.g., 2023-2024)
        });

        // Create the response object
        const response = { financial_years: formattedYears };

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
