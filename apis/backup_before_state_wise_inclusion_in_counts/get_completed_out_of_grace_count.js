const express = require('express');
const odbc = require('odbc'); // Ensure you've installed this package
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

    // Check if ZEXT_RNO is empty
    if (!zextRNO) {
        return res.send(''); // Early exit if zextRNO is empty
    }

    // Base query to fetch the count of completed items out of grace time based on ZEXT_RNO and date criteria
    let query = `
        SELECT COUNT(*) AS day_difference_count
        FROM Schedule_plan_lubrication
        WHERE ZEXT_RNO = ? 
            AND ZTEXT1 NOT IN ('Open', 'In Process', 'Deletion Flag')
            AND TRY_CAST([ZREQ_SDAT] AS DATE) IS NOT NULL
            AND TRY_CAST([ZACTENDT] AS DATE) IS NOT NULL
            AND (DATEDIFF(DAY, TRY_CAST([ZREQ_SDAT] AS DATE), TRY_CAST([ZACTENDT] AS DATE)) > 7 
                 OR DATEDIFF(DAY, TRY_CAST([ZACTENDT] AS DATE), TRY_CAST([ZREQ_SDAT] AS DATE)) > 7)
            AND ZTEXT1 != 'deletion_flag'
            AND CONVERT(DATE, TRY_CAST([ZREQ_SDAT] AS DATE), 23) BETWEEN DATEADD(YEAR, -2, GETDATE()) AND DATEADD(YEAR, 2, GETDATE())
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

    try {
        // Connect to the database
        const connection = await connectToDatabase();
        const result = await connection.query(query, params);
        
        // Fetch the count of completed items out of grace time
        // const dayDifferenceCount = result[0][0].day_difference_count;
        const dayDifferenceCount = result[0].day_difference_count;

        const results = {
            dayDifferenceCount: dayDifferenceCount
        };

        // Return the count of completed items out of grace time as a response
        // res.send(dayDifferenceCount.toString());

        res.json(results);
    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).send('An error occurred while querying the database.');
    }
});

// Export the router
module.exports = router;
