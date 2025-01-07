const express = require('express');
const { connectToDatabase } = require('./connect.js');
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
const parseDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 8) return null;
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1; // Month is zero-based in JS Date
    const day = parseInt(dateStr.substring(6, 8), 10);
    return new Date(year, month, day);
};

// Route to handle GET request
router.get('/', async (req, res) => {
    const funcLoc = req.query.func_loc || '';

    if (!funcLoc) {
        return res.json([]);
    }

    try {
        const db = await connectToDatabase();

        const query = `
            SELECT 
                [FUNCT_LOC], [PLANT], [CRM_ORDERH], [ZTEXT1], [ZACTENDT], 
                [ZACTSTDT], [ZEXT_RNO], [ZREQ_SDAT], [CRM_CRD_AT]
            FROM 
                schedule_plan_lubrication
            WHERE 
                [FUNCT_LOC] = ? 
                AND ZTEXT1 NOT IN ('Deletion Flag')
                AND TRY_CAST([ZREQ_SDAT] AS DATE) IS NOT NULL
                AND CONVERT(DATE, TRY_CAST([ZREQ_SDAT] AS DATE), 23) <= CONVERT(DATE, GETDATE(), 23)
                AND CONVERT(DATE, TRY_CAST([ZREQ_SDAT] AS DATE), 23) >= DATEADD(year, -2, GETDATE())
                AND ZEXT_RNO NOT LIKE 'yd%'
                AND ZEXT_RNO NOT LIKE 'pd%'
        `;

        console.log('Executing query:', query, 'With parameter funcLoc:', funcLoc);

        // Execute the query with the parameter
        const result = await db.query(query, [funcLoc]);

        const formattedData = result.map((row) => {
            const today = new Date();

            // Format and calculate delay for rows with 'open' or 'in process' status
            if (['open', 'in process'].includes(row.ZTEXT1.toLowerCase())) {
                row.ZACTENDT = '-';
                row.ZACTSTDT = '-';

                const zreqSdat = parseDate(row.ZREQ_SDAT);
                row.delay = zreqSdat ? Math.floor((today - zreqSdat) / (1000 * 60 * 60 * 24)) : null;

                if (zreqSdat && zreqSdat > today) {
                    row.delay *= -1; // Make delay negative if ZREQ_SDAT is in the future
                }
            } else {
                // Calculate delay based on ZACTENDT and ZREQ_SDAT difference
                const zactEndt = parseDate(row.ZACTENDT);
                const zreqSdat = parseDate(row.ZREQ_SDAT);

                row.delay = (zactEndt && zreqSdat)
                    ? Math.floor((zactEndt - zreqSdat) / (1000 * 60 * 60 * 24))
                    : null;
            }

            // Date formatting for specific columns
            const formatDate = (dateStr) => {
                const date = parseDate(dateStr);
                return date ? date.toLocaleDateString('en-GB') : ''; // d-m-Y format
            };

            row.ZREQ_SDAT = formatDate(row.ZREQ_SDAT);
            row.ZACTENDT = formatDate(row.ZACTENDT);
            row.ZACTSTDT = formatDate(row.ZACTSTDT);
            row.CRM_CRD_AT = formatDate(row.CRM_CRD_AT);

            return row;
        });

        res.json(formattedData);

        // Close the database connection after query execution
        await db.close();
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
