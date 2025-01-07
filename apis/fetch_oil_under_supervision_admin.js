const express = require('express');
const { connectToMSSQL } = require('./fleetconnect.js');
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
        // Construct the query to fetch all rows from the oil_under_supervision table
        const query = `SELECT * FROM [Fleet_Manager_DB].[dbo].oil_under_supervision`;

        console.log('Executing query:', query);

        // Execute the query and get the result
        const result = await connectToMSSQL(query);
        
        // Send the result back to the client
        res.json(result);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
