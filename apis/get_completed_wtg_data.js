const express = require('express');
const odbc = require('odbc');
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
    // Extract parameters from query
    const zextRNO = req.query.orderType || '';
    const selectedState = (req.query.state && req.query.state !== 'Select') ? req.query.state : '';
    const selectedArea = (req.query.area && req.query.area !== 'Select') ? req.query.area : '';
    const selectedSite = (req.query.site && req.query.site !== 'Select') ? req.query.site : '';
    const startDate = req.query.fromDate || null;
    const endDate = req.query.toDate || null;

    // Construct the base SQL query
    let query = `
        SELECT [FUNCT_LOC], [PLANT], [CRM_ORDERH], [ZTEXT1], [ZACTENDT], [ZACTSTDT], [ZEXT_RNO], [ZREQ_SDAT]
        FROM Schedule_plan_lubrication
        WHERE ZEXT_RNO = ?
        AND ZTEXT1 NOT IN ('Open', 'In Process', 'Deletion Flag')
        AND TRY_CAST([ZREQ_SDAT] AS DATE) IS NOT NULL
        AND CONVERT(DATE, TRY_CAST([ZREQ_SDAT] AS DATE), 23) <= CONVERT(DATE, GETDATE(), 23)
        AND [PLANT] NOT LIKE 'T%'
    `;
    
    const params = [zextRNO];

    // Add conditions for state, area, and site
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

    // Add date range condition if start and end dates are provided
    if (startDate && endDate) {
        query += ` AND [ZREQ_SDAT] >= ? AND [ZREQ_SDAT] <= ?`;
        params.push(startDate, endDate);
    }

    try {
        const db = await connectToDatabase();
        const results = await db.query(query, params);

        const today = new Date();
        
        // Process results to calculate delay and format dates
        const formattedResults = results.map(row => {
            const formattedRow = { ...row };
            
            const zactendt = parseDate(row.ZACTENDT, 'Ymd');
            const zreq_sdat = parseDate(row.ZREQ_SDAT, 'Ymd');
            
            // Calculate delay if both dates are valid
            if (zactendt && zreq_sdat) {
                const delay = Math.floor((zactendt - zreq_sdat) / (1000 * 60 * 60 * 24));
                formattedRow.delay = (zreq_sdat < zactendt) ? Math.abs(delay) : -delay;
            } else {
                formattedRow.delay = null;
            }

            // Format date columns
            formattedRow.ZACTENDT = zactendt ? formatDate(zactendt, 'DD-MM-YYYY') : null;
            formattedRow.ZACTSTDT = parseDate(row.ZACTSTDT, 'Ymd') ? formatDate(parseDate(row.ZACTSTDT, 'Ymd'), 'DD-MM-YYYY') : null;
            formattedRow.ZREQ_SDAT = zreq_sdat ? formatDate(zreq_sdat, 'DD-MM-YYYY') : null;

            return formattedRow;
        });

        res.json(formattedResults);
    } catch (error) {
        console.error('Database query error:', error.message);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

// Helper function to parse dates in a specific format
function parseDate(dateString, format) {
    if (!dateString || typeof dateString !== 'string') return null;
    if (format === 'Ymd' && /^\d{8}$/.test(dateString)) {
        const year = dateString.slice(0, 4);
        const month = dateString.slice(4, 6) - 1; // JS months are 0-based
        const day = dateString.slice(6, 8);
        return new Date(year, month, day);
    }
    return null;
}

// Helper function to format dates to 'DD-MM-YYYY'
function formatDate(date, format) {
    if (!(date instanceof Date) || isNaN(date)) return null;
    if (format === 'DD-MM-YYYY') {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // JS months are 0-based
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }
    return null;
}

// Export the router
module.exports = router;
