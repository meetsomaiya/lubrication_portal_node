const express = require('express');
const odbc = require('odbc');
const { connectToDatabase } = require('./connect.js'); // Ensure you have this connection string in the 'connect.js' file.
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

// Define the route to execute the SQL query
router.get('/', async (req, res) => {
    try {
        const connection = await connectToDatabase(); // Connect to the database
        const sqlQuery = `
            SELECT DISTINCT ZEXT_RNO
            FROM Schedule_plan_lubrication
            WHERE (ZEXT_RNO LIKE 'Q1_LUB_%'
                OR ZEXT_RNO LIKE 'Q2_LUB_%'
                OR ZEXT_RNO LIKE 'Q3_LUB_%'
                OR ZEXT_RNO LIKE 'Q4_LUB_%'
                OR ZEXT_RNO LIKE 'HALF1_LUB_%'
                OR ZEXT_RNO LIKE 'HALF2_LUB_%')
                AND DATEDIFF(day, DATEADD(YEAR, -2, GETDATE()), CONVERT(DATE, TRY_CAST(ZREQ_SDAT AS DATE), 23)) >= 0
        `;

        const result = await connection.query(sqlQuery); // Execute the query
        await connection.close(); // Close the connection

        // Send the result back as a JSON response
        res.status(200).json(result);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'An error occurred while fetching data.' });
    }
});

// Export the router
module.exports = router;
