const express = require('express');
const odbc = require('odbc');
const router = express.Router();
const { connectToDatabase } = require('./connect4'); // Main DB connection module

// CORS setup
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '3600');
    next();
});

// Parse JSON bodies
router.use(express.json());

// Route to handle GET requests
router.get('/', async (req, res) => {
    // Extract parameters from query
    const zextRNO = req.query.orderType || '';
    const selectedState = (req.query.state && req.query.state !== 'Select') ? req.query.state : '';
    const selectedArea = (req.query.area && req.query.area !== 'Select') ? req.query.area : '';
    const selectedSite = (req.query.site && req.query.site !== 'Select') ? req.query.site : '';
    const startDate = req.query.fromDate || null;
    const endDate = req.query.toDate || null;

    // Ensure zextRNO is provided
    if (!zextRNO) {
        return res.sendStatus(400); // Bad Request
    }

    try {
        // Connect to the main database
        console.log("Connecting to main database...");
        const db = await connectToDatabase();
        console.log("Connected to main database.");

        // Build the query with placeholders for parameters
        let query = `
            SELECT 
                spl.[FUNCT_LOC], 
                spl.[PLANT], 
                spl.[CRM_ORDERH], 
                spl.[ZTEXT1], 
                spl.[ZEXT_RNO], 
                spl.[ZREQ_SDAT],
                r.[reason] AS Reason
            FROM 
                Schedule_plan_lubrication spl
            LEFT JOIN 
                reason r ON r.[functional_location] = spl.[FUNCT_LOC] 
                          AND r.[order_number] = spl.[CRM_ORDERH]
            WHERE 
                spl.ZEXT_RNO = ? 
                AND TRY_CAST(spl.[ZREQ_SDAT] AS DATE) IS NOT NULL
                AND CONVERT(DATE, TRY_CAST(spl.[ZREQ_SDAT] AS DATE), 23) <= GETDATE()
                AND spl.[PLANT] NOT LIKE 'T%'
                AND spl.ZTEXT1 IN ('Open', 'In Process')
        `;

        // Array to store parameters for query
        const params = [zextRNO];

        // Conditional filters for state, area, and site
        if (selectedState) {
            query += ` AND spl.[PLANT] IN (SELECT DISTINCT [Maintenance_Plant] FROM installedbase WHERE State = ?)`; 
            params.push(selectedState);
        }
        if (selectedArea) {
            query += ` AND spl.[PLANT] IN (SELECT DISTINCT [Maintenance_Plant] FROM installedbase WHERE Area = ?)`; 
            params.push(selectedArea);
        }
        if (selectedSite) {
            query += ` AND spl.[PLANT] IN (SELECT DISTINCT [Maintenance_Plant] FROM installedbase WHERE Site = ?)`; 
            params.push(selectedSite);
        }

        // Date range filter
        if (startDate && endDate) {
            query += ` AND spl.[ZREQ_SDAT] >= ? AND spl.[ZREQ_SDAT] <= ?`;
            params.push(startDate, endDate);
        }

        // Execute the main query
        console.log("Executing main query:", query, "with params:", params);
        const results = await db.query(query, params);
        console.log("Main query results:", results);

        // Calculate delays and format date fields for each row
        const today = new Date();
        const formattedResults = await Promise.all(results.map(async row => {
            try {
                // Convert ZREQ_SDAT to 'YYYY-MM-DD' format if it's in 'YYYYMMDD' format
                let zreq_sdat;
                if (row.ZREQ_SDAT && /^[0-9]{8}$/.test(row.ZREQ_SDAT)) { // Check if it matches 'YYYYMMDD'
                    const formattedDate = `${row.ZREQ_SDAT.slice(0, 4)}-${row.ZREQ_SDAT.slice(4, 6)}-${row.ZREQ_SDAT.slice(6, 8)}`;
                    zreq_sdat = new Date(formattedDate);
                } else {
                    zreq_sdat = new Date(row.ZREQ_SDAT); // Try to parse as-is if format is different
                }

                // Check if the parsed date is valid
                if (isNaN(zreq_sdat)) {
                    console.warn(`Invalid ZREQ_SDAT date value: ${row.ZREQ_SDAT}`);
                    row.delay = null;
                    row.ZREQ_SDAT = null;
                } else {
                    // Calculate delay and format the date
                    row.delay = Math.floor((today - zreq_sdat) / (1000 * 60 * 60 * 24));
                    row.ZREQ_SDAT = zreq_sdat.toISOString().slice(0, 10); // Format date to YYYY-MM-DD
                }

                // Log processed row for debugging
                console.log(`Processed row:`, row);
            } catch (dateError) {
                console.error(`Error processing ZREQ_SDAT: ${row.ZREQ_SDAT}`, dateError.message);
                row.delay = null;
                row.ZREQ_SDAT = null;
            }

            return row;
        }));

        // Return JSON response with formatted results
        console.log("Final formatted results:", formattedResults);
        res.json(formattedResults);
    } catch (error) {
        console.error('Main DB connection error:', error.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
