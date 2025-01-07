const express = require('express');
const router = express.Router();
const { connectToDatabase } = require('./connect5.js'); // Your database connection module

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

// API endpoint to fetch data from the login table
router.get('/', async (req, res) => {
    try {
        // Establish database connection
        const dbConnection = await connectToDatabase();

        // Query to fetch name, domain_id, and access from the login table
        const query = `
            SELECT name, domain_id, access, last_login_time, state, area, site
            FROM login;
        `;

        const result = await dbConnection.query(query);

        // Close the database connection
        await dbConnection.close();

        // Transform `domain_id` to `domainId`
        const transformedResult = result.map(row => ({
            ...row,
            domainId: row.domain_id,
        }));

        // Send the transformed data as the response
        res.status(200).json({
            success: true,
            data: transformedResult,
        });
    } catch (error) {
        console.error('Error fetching data:', error);

        // Handle errors and send error response
        res.status(500).json({
            success: false,
            message: 'Error fetching data from the login table.',
            error: error.message,
        });
    }
});

// Export the router
module.exports = router;
