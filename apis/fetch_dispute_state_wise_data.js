const express = require('express');
const odbc = require('odbc');
const fs = require('fs');
//const { connectToDatabase } = require('./connect3.js'); // Database connection module
const { connectToDatabase } = require('./connect6.js');
const router = express.Router();

// Set timezone to Asia/Kolkata
process.env.TZ = 'Asia/Kolkata';

// CORS middleware
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

// Error logging function
function logError(message) {
    const errorData = { error: message, timestamp: new Date().toISOString() };
    const errorFilePath = 'error_log.json';

    // Append or create a new JSON log
    if (fs.existsSync(errorFilePath)) {
        const existingData = JSON.parse(fs.readFileSync(errorFilePath));
        existingData.push(errorData);
        fs.writeFileSync(errorFilePath, JSON.stringify(existingData, null, 2));
    } else {
        fs.writeFileSync(errorFilePath, JSON.stringify([errorData], null, 2));
    }
}

// Route to handle GET request
router.get('/', async (req, res) => {
    const year = req.query.year;

    if (!year) {
        logError("No 'year' parameter provided in the request.");
        return res.status(400).json({ error: "No 'year' parameter provided in the request." });
    }

    // Determine today's date or yesterday's date based on the current hour
    const currentHour = new Date().getHours();
    const today = new Date();
    if (currentHour >= 0 && currentHour < 9) {
        today.setDate(today.getDate() - 1); // Set to yesterday's date
    }
    const formattedDate = today.toISOString().split('T')[0];

    // Prepare the SQL query
    const query = `
        SELECT [state], [issue_quantity], [return_quantity], [return_percentage]
        FROM [dbo].[dispute_state_wise_count]
        WHERE [financial_year] = ? AND [date_of_insertion] = ?
    `;

    try {
        // Connect to the database
        const db = await connectToDatabase();
        const result = await db.query(query, [year, formattedDate]);

        // Check if any data was returned
        if (result.length > 0) {
            const formattedData = result.reduce((acc, row) => {
                const { state, issue_quantity, return_quantity, return_percentage } = row;
                acc[state] = {
                    issue_quantity: issue_quantity.toString(),
                    return_quantity: return_quantity.toString(),
                    return_percentage: return_percentage.toString()
                };
                return acc;
            }, {});

            res.json(formattedData);
        } else {
            logError("No data found for the specified year and today's date.");
            res.json({ error: "No data found for the specified year and today's date." });
        }
    } catch (error) {
        logError("Database error: " + error.message);
        res.status(500).json({ error: "Database error: " + error.message });
    }
});

// Export the router
module.exports = router;
