const express = require('express');
const { connectToDatabase } = require('./connect.js'); // Your database connection module

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
    // Extract parameters from query
    const zextRNO = req.query.orderType || '';
    const selectedState = req.query.state !== 'Select' ? req.query.state : '';
    const selectedArea = req.query.area !== 'Select' ? req.query.area : '';
    const selectedSite = req.query.site !== 'Select' ? req.query.site : '';
    const startDate = req.query.fromDate || null;
    const endDate = req.query.toDate || null;

    // console.log('Extracted Parameters:', {
    //     zextRNO,
    //     selectedState,
    //     selectedArea,
    //     selectedSite,
    //     startDate,
    //     endDate
    // });

    // Check if ZEXT_RNO is empty
    if (!zextRNO) {
        // console.log('ZEXT_RNO is empty, returning early.');
        return res.send(''); // If ZEXT_RNO is empty, do not proceed further
    }

    // Prepare the base query to fetch the total open status count based on ZEXT_RNO and date criteria
    let query = `
        SELECT COUNT(*) AS total_status_count
        FROM Schedule_plan_lubrication
        WHERE ZEXT_RNO = ? 
        AND TRY_CAST([ZREQ_SDAT] AS DATE) IS NOT NULL
        AND CONVERT(DATE, TRY_CAST([ZREQ_SDAT] AS DATE), 23) <= GETDATE()
        AND [PLANT] NOT LIKE 'T%'
        AND ZTEXT1 IN ('Open', 'In Process')`;

    // Initialize parameters array for binding
    let params = [zextRNO];

    // Add conditions based on selected state, area, and site
    if (selectedState) {
        query += ` AND [PLANT] IN (SELECT DISTINCT [Maintenance_Plant] FROM installedbase WHERE State = ?)`;
        params.push(selectedState);
    }

    if (selectedArea) {
        query += ` AND [PLANT] IN (SELECT DISTINCT [Maintenance_Plant] FROM installedbase WHERE Area = ?)`;
        params.push(selectedArea);
    }

    if (selectedSite) {
        query += ` AND [PLANT] IN (SELECT DISTINCT [Maintenance_Plant] FROM installedbase WHERE Site = ?)`;
        params.push(selectedSite);
    }

    // Check if start and end dates are set
    if (startDate && endDate) {
        query += ` AND [ZREQ_SDAT] BETWEEN ? AND ?`;
        params.push(startDate, endDate);
    }

    // console.log('Final SQL Query:', query);
    // console.log('Query Parameters:', params);

    try {
        // Connect to the database
        const connection = await connectToDatabase();
        // console.log('Database connection established.');

        // Execute the SQL query
        const result = await connection.query(query, params);
        
        // Log the result for debugging
        // console.log('SQL Query Result:', result);

        // Directly send the total open status count from the first row of the result
        // const totalOpenStatusCount = result[0][0].total_status_count; // Directly accessing the count
      const totalOpenStatusCount = result[0].total_status_count; // Directly accessing the count
        // console.log('Total Open Status Count:', totalOpenStatusCount);

        const results = {
            totalOpenStatusCount: totalOpenStatusCount
        };

        // Return the total open status count as a response
        // res.send(totalOpenStatusCount.toString());

        res.json(results);
    } catch (error) {
        // console.error('Database query error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Export the router
module.exports = router;
