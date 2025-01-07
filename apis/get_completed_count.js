const express = require('express');
const router = express.Router();
const { connectToDatabase } = require('./connect.js'); // Database connection module

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

        if (!zextRNO) {
            return res.status(400).send(''); // Send a 400 Bad Request response if ZEXT_RNO is empty
        }

        // Prepare the base query for completed count by PLANT
        let query = `
            SELECT COUNT(*) AS completed_count, PLANT
            FROM Schedule_plan_lubrication
            WHERE ZEXT_RNO = ?
            AND ZTEXT1 NOT IN ('Open', 'In Process', 'Deletion Flag')
            AND TRY_CAST([ZREQ_SDAT] AS DATE) IS NOT NULL
            AND CONVERT(DATE, TRY_CAST([ZREQ_SDAT] AS DATE), 23) <= GETDATE()
            AND [PLANT] NOT LIKE 'T%'
        `;
        const params = [zextRNO];

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

        const db = await connectToDatabase();
        const result = await db.query(query, params);

        const stateWiseCounts = {};
        let totalCompletedCount = 0;

        // Loop through each PLANT, fetch corresponding state, and accumulate counts by state
        for (const row of result) {
            const plant = row.PLANT;
            const completedCount = row.completed_count;

            const stateQuery = `SELECT State FROM installedbase WHERE Maintenance_Plant = ?`;
            const stateResult = await db.query(stateQuery, [plant]);

            if (stateResult.length > 0) {
                const state = stateResult[0].State;
                stateWiseCounts[state] = (stateWiseCounts[state] || 0) + completedCount;
                totalCompletedCount += completedCount;
            }
        }

        const results = {
            totalCompletedCount,
            stateWiseCounts
        };

        res.json(results);
    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
