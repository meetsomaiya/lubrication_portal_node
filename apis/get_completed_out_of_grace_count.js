const express = require('express');
//const { connectToDatabase } = require('./connect.js'); // Your database connection module
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

// Middleware to parse JSON bodies
router.use(express.json());

// Route to handle GET request
router.get('/', async (req, res) => {
    const zextRNO = req.query.orderType || '';
    const selectedState = req.query.state !== 'Select' ? req.query.state : '';
    const selectedArea = req.query.area !== 'Select' ? req.query.area : '';
    const selectedSite = req.query.site !== 'Select' ? req.query.site : '';
    const startDate = req.query.fromDate || null;
    const endDate = req.query.toDate || null;

    if (!zextRNO) {
        return res.send(''); // Early return if ZEXT_RNO is empty
    }

    // Base query to get initial day difference count
    let dayDiffQuery = `
        SELECT COUNT(*) AS day_difference_count, PLANT
        FROM Schedule_plan_lubrication
        WHERE ZEXT_RNO = ? 
            AND ZTEXT1 NOT IN ('Open', 'In Process', 'Deletion Flag')
            AND TRY_CAST([ZREQ_SDAT] AS DATE) IS NOT NULL
            AND TRY_CAST([ZACTENDT] AS DATE) IS NOT NULL
            AND (DATEDIFF(DAY, TRY_CAST([ZREQ_SDAT] AS DATE), TRY_CAST([ZACTENDT] AS DATE)) > 7 
                 OR DATEDIFF(DAY, TRY_CAST([ZACTENDT] AS DATE), TRY_CAST([ZREQ_SDAT] AS DATE)) > 7)
            AND ZTEXT1 != 'deletion_flag'
            AND CONVERT(DATE, TRY_CAST([ZREQ_SDAT] AS DATE), 23) BETWEEN DATEADD(YEAR, -2, GETDATE()) AND DATEADD(YEAR, 2, GETDATE())`;
    let params = [zextRNO];

    // Add conditions for selected state, area, and site
    if (selectedState) {
        dayDiffQuery += ` AND [PLANT] IN (SELECT DISTINCT [Maintenance_Plant] FROM installedbase WHERE State = ?)`;
        params.push(selectedState);
    }
    if (selectedArea) {
        dayDiffQuery += ` AND [PLANT] IN (SELECT DISTINCT [Maintenance_Plant] FROM installedbase WHERE Area = ?)`;
        params.push(selectedArea);
    }
    if (selectedSite) {
        dayDiffQuery += ` AND [PLANT] IN (SELECT DISTINCT [Maintenance_Plant] FROM installedbase WHERE Site = ?)`;
        params.push(selectedSite);
    }
    if (startDate && endDate) {
        dayDiffQuery += ` AND [ZREQ_SDAT] BETWEEN ? AND ?`;
        params.push(startDate, endDate);
    }
    dayDiffQuery += ` GROUP BY PLANT`;

    try {
        const connection = await connectToDatabase();
        const dayDiffResult = await connection.query(dayDiffQuery, params);
        
        const stateWiseCounts = {};

        // Loop through each plant and accumulate counts by state
        for (const row of dayDiffResult) {
            const plant = row.PLANT;
            const plantCount = row.day_difference_count;

            // Fetch the state for each plant from installedbase
            const stateQuery = `SELECT State FROM installedbase WHERE Maintenance_Plant = ?`;
            const stateResult = await connection.query(stateQuery, [plant]);

            if (stateResult.length > 0) {
                const state = stateResult[0].State;
                stateWiseCounts[state] = (stateWiseCounts[state] || 0) + plantCount;
            }
        }

        const results = {
            dayDifferenceCount: dayDiffResult.reduce((sum, row) => sum + row.day_difference_count, 0),
            stateWiseCounts
        };

        res.json(results);
    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Export the router
module.exports = router;
