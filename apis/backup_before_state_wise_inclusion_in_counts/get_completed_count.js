const express = require('express');
const odbc = require('odbc');
const router = express.Router();
const { connectToDatabase } = require('./connect.js'); // Your database connection module

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
    try {
    // Extract parameters from query
    const zextRNO = req.query.orderType || '';
    const selectedState = req.query.state !== 'Select' ? req.query.state : '';
    const selectedArea = req.query.area !== 'Select' ? req.query.area : '';
    const selectedSite = req.query.site !== 'Select' ? req.query.site : '';
    const startDate = req.query.fromDate || null;
    const endDate = req.query.toDate || null;

        // Check if ZEXT_RNO is empty
        if (!zextRNO) {
            return res.status(400).send(''); // Send a 400 Bad Request response if ZEXT_RNO is empty
        }

        // Array of statuses to consider for the open count
        const statusArray = ['Open', 'In Process'];
        
        // Prepare the base query
        let query = `
            SELECT COUNT(*) AS completed_count
            FROM Schedule_plan_lubrication
            WHERE ZEXT_RNO = ?
            AND ZTEXT1 NOT IN ('Open', 'In Process', 'Deletion Flag')
            AND TRY_CAST([ZREQ_SDAT] AS DATE) IS NOT NULL
            AND CONVERT(DATE, TRY_CAST([ZREQ_SDAT] AS DATE), 23) <= CONVERT(DATE, GETDATE(), 23)
            AND CONVERT(DATE, TRY_CAST([ZREQ_SDAT] AS DATE), 23) <= GETDATE()
            AND [PLANT] NOT LIKE 'T%'
        `;

        // Initialize parameters array for binding
        const params = [zextRNO];

        // Add conditions based on selected state, area, and site
        if (selectedState) {
            query += ` AND [PLANT] IN (
                SELECT DISTINCT [Maintenance_Plant] 
                FROM installedbase 
                WHERE State = ?
            )`;
            params.push(selectedState); // Add state parameter for binding
        }

        if (selectedArea) {
            query += ` AND [PLANT] IN (
                SELECT DISTINCT [Maintenance_Plant] 
                FROM installedbase 
                WHERE Area = ?
            )`;
            params.push(selectedArea); // Add area parameter for binding
        }

        if (selectedSite) {
            query += ` AND [PLANT] IN (
                SELECT DISTINCT [Maintenance_Plant] 
                FROM installedbase 
                WHERE Site = ?
            )`;
            params.push(selectedSite); // Add site parameter for binding
        }

        // Check if start and end dates are set
        if (startDate && endDate) {
            query += ` AND [ZREQ_SDAT] >= ? AND [ZREQ_SDAT] <= ?`;
            params.push(startDate); // Add start date parameter for binding
            params.push(endDate); // Add end date parameter for binding
        }

        // Connect to the database
        const db = await connectToDatabase();
        
        // Prepare and execute the SQL query
        const result = await db.query(query, params);

        // Fetch the count of completed items
        const completedCount = result[0]?.completed_count || 0;

        const results = {
            totalCompletedCount: completedCount
        };


        // Return the count of completed items as a response
        // res.send(completedCount.toString());

        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error'); // Handle any errors that occur
    }
});

// Export the router
module.exports = router;
