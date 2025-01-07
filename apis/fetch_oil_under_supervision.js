const express = require('express');
const { connectToMSSQL} = require('./fleetconnect.js');
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

// Function to parse dates in YYYYMMDD format
// const parseDate = (dateStr) => {
//     if (!dateStr || dateStr.length !== 8) return null;
//     const year = parseInt(dateStr.substring(0, 4), 10);
//     const month = parseInt(dateStr.substring(4, 6), 10) - 1; // Month is zero-based in JS Date
//     const day = parseInt(dateStr.substring(6, 8), 10);
//     return new Date(year, month, day);
// };

// Route to handle GET request
router.get('/', async (req, res) => {
    const loginUser = req.query.loginUser || '';

    if (!loginUser) {
        return res.json([]);
    }

    try {
        // Construct the query
        const query = `SELECT * FROM [Fleet_Manager_DB].[dbo].oil_under_supervision 
                       WHERE (STATE_ENGG_HEAD='${loginUser}' OR AREA_INCHARGE='${loginUser}' OR SITE_INCHARGE='${loginUser}')`;

        console.log('Executing query:', query, 'With parameter loginUser:', loginUser);

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
