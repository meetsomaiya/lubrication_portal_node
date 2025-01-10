const express = require('express');
const router = express.Router();
const fs = require('fs');
//const { connectToDatabase } = require('./connect.js');
const { connectToDatabase } = require('./connect6.js');

router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '3600');
    next();
});

router.use(express.json());

router.get('/', async (req, res) => {
    const parameters = {
        zextRNO: req.query.orderType || '',
        selectedState: (req.query.state && req.query.state !== 'Select') ? req.query.state : '',
        selectedArea: (req.query.area && req.query.area !== 'Select') ? req.query.area : '',
        selectedSite: (req.query.site && req.query.site !== 'Select') ? req.query.site : '',
        startDate: req.query.fromDate || null,
        endDate: req.query.toDate || null
    };

    console.log('Parameters:', parameters);

    if (!parameters.zextRNO) {
        return res.status(400).json({ message: 'ZEXT_RNO is required.' });
    }

    try {
        const db = await connectToDatabase();
        if (!db) {
            console.error('Database connection failed');
            return res.status(500).send('Database connection failed');
        }

        // Step 1: Fetch total planned count and unique PLANTs
        let query = `
        SELECT COUNT(*) AS total_count, PLANT
        FROM Schedule_plan_lubrication
        WHERE ZEXT_RNO = ?
        AND ZTEXT1 NOT IN ('Open', 'In Process', 'Deletion Flag')
        AND TRY_CAST([ZREQ_SDAT] AS DATE) IS NOT NULL
        AND CONVERT(DATE, TRY_CAST([ZREQ_SDAT] AS DATE), 23) <= GETDATE()
        AND [PLANT] NOT LIKE 'T%'
    `;
        
        const params = [parameters.zextRNO];

        if (parameters.selectedState) {
            query += ` AND PLANT IN (
                          SELECT DISTINCT Maintenance_Plant 
                          FROM installedbase 
                          WHERE State = ?
                      )`;
            params.push(parameters.selectedState);
        }

        if (parameters.selectedArea) {
            query += ` AND PLANT IN (
                          SELECT DISTINCT Maintenance_Plant 
                          FROM installedbase 
                          WHERE Area = ?
                      )`;
            params.push(parameters.selectedArea);
        }

        if (parameters.selectedSite) {
            query += ` AND PLANT IN (
                          SELECT DISTINCT Maintenance_Plant 
                          FROM installedbase 
                          WHERE Site = ?
                      )`;
            params.push(parameters.selectedSite);
        }

        if (parameters.startDate && parameters.endDate) {
            query += ` AND ZREQ_SDAT >= ? AND ZREQ_SDAT <= ?`;
            params.push(parameters.startDate, parameters.endDate);
        }

        query += ` GROUP BY PLANT`;

        console.log('Executing Query:', query);
        console.log('With Parameters:', params);

        const schedulePlanResult = await db.query(query, params);
        console.log('Query Result:', schedulePlanResult);

        const TotalCount = schedulePlanResult.reduce((sum, row) => sum + row.total_count, 0);

        // Step 2: Get state-wise count from installedbase
        const stateWiseCounts = {};

        for (const row of schedulePlanResult) {
            const maintenancePlant = row.PLANT;

            // Fetch the state for each maintenance plant
            const stateQuery = `
                SELECT State 
                FROM installedbase 
                WHERE Maintenance_Plant = ?
            `;
            const stateResult = await db.query(stateQuery, [maintenancePlant]);

            if (stateResult.length > 0) {
                const state = stateResult[0].State;
                stateWiseCounts[state] = (stateWiseCounts[state] || 0) + row.total_count;
            }
        }

        const results = {
            TotalCount,
            stateWiseCounts
        };

        fs.writeFileSync('planned-parameters.json', JSON.stringify(parameters, null, 2));
        fs.writeFileSync('plan_results.json', JSON.stringify(results, null, 2));

        res.json(results);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
