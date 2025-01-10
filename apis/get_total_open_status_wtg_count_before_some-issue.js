const express = require('express');
const { connectToDatabase } = require('./connect.js'); // Database connection module

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

    // Base query to get counts by PLANT with filters
    let query = `
        SELECT COUNT(*) AS total_count, PLANT
        FROM Schedule_plan_lubrication
        WHERE ZEXT_RNO = ? 
        AND TRY_CAST([ZREQ_SDAT] AS DATE) IS NOT NULL
        AND CONVERT(DATE, TRY_CAST([ZREQ_SDAT] AS DATE), 23) <= GETDATE()
        AND [PLANT] NOT LIKE 'T%'
        AND ZTEXT1 IN ('Open', 'In Process')`;
    let params = [zextRNO];

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
    if (startDate && endDate) {
        query += ` AND [ZREQ_SDAT] BETWEEN ? AND ?`;
        params.push(startDate, endDate);
    }
    query += ` GROUP BY PLANT`;

    try {
        const connection = await connectToDatabase();
        const schedulePlanResult = await connection.query(query, params);
        
        const stateWiseCounts = {};

        // Loop through each plant, get corresponding state and accumulate counts by state
        for (const row of schedulePlanResult) {
            const plant = row.PLANT;
            const plantCount = row.total_count;

            // Fetch the state for each plant from installedbase
            const stateQuery = `SELECT State FROM installedbase WHERE Maintenance_Plant = ?`;
            const stateResult = await connection.query(stateQuery, [plant]);

            if (stateResult.length > 0) {
                const state = stateResult[0].State;
                stateWiseCounts[state] = (stateWiseCounts[state] || 0) + plantCount;
            }
        }

        const results = {
            totalOpenStatusCount: schedulePlanResult.reduce((sum, row) => sum + row.total_count, 0),
            stateWiseCounts
        };

        res.json(results);
    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
