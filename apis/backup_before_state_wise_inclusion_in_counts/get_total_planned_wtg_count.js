const express = require('express');
const router = express.Router();
const fs = require('fs');
const { connectToDatabase } = require('./connect.js'); // Ensure this is your database connection module

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

router.get('/', async (req, res) => {
    const parameters = {
        zextRNO: req.query.orderType || '',
        selectedState: (req.query.state && req.query.state !== 'Select') ? req.query.state : '',
        selectedArea: (req.query.area && req.query.area !== 'Select') ? req.query.area : '',
        selectedSite: (req.query.site && req.query.site !== 'Select') ? req.query.site : '',
        startDate: req.query.fromDate || null,
        endDate: req.query.toDate || null
    };

    console.log('Parameters:', parameters); // Log parameters

    if (!parameters.zextRNO) {
        return res.status(400).json({ message: 'ZEXT_RNO is required.' });
    }

    try {
        const db = await connectToDatabase();
        if (!db) {
            console.error('Database connection failed');
            return res.status(500).send('Database connection failed');
        }

        let query = `
            SELECT COUNT(*) AS total_count 
            FROM Schedule_plan_lubrication 
            WHERE ZEXT_RNO = ? 
            AND TRY_CAST(ZREQ_SDAT AS DATE) IS NOT NULL
            AND CONVERT(DATE, TRY_CAST(ZREQ_SDAT AS DATE), 23) <= CONVERT(DATE, GETDATE(), 23)
            AND CONVERT(DATE, TRY_CAST(ZREQ_SDAT AS DATE), 23) <= GETDATE()
            AND ZTEXT1 NOT IN ('Deletion Flag')
            AND PLANT NOT LIKE 'T%'
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

        console.log('Executing Query:', query); // Log the query
        console.log('With Parameters:', params); // Log the parameters

        const result = await db.query(query, params);
        console.log('Query Result:', result); // Log the result

        const totalPlannedCount = result?.[0]?.total_count || 0;

        const results = {
            totalPlannedCount: totalPlannedCount
        };

        fs.writeFileSync('planned-parameters.json', JSON.stringify(parameters, null, 2));
        fs.writeFileSync('plan_results.json', JSON.stringify(results, null, 2));

        res.json(results);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Export the router
module.exports = router;
