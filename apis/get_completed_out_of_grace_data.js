const express = require('express');
const odbc = require('odbc');
const { connectToDatabase } = require('./connect'); // Your database connection module
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

    // Exit if ZEXT_RNO is empty
    if (!zextRNO) {
        return res.status(400).send('');
    }

    // Base query with placeholders
    let query = `
        SELECT [FUNCT_LOC], [PLANT], [CRM_ORDERH], [ZTEXT1], [ZACTENDT], [ZACTSTDT], [ZEXT_RNO], [ZREQ_SDAT]
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
    
    // Parameters array for query binding
    const params = [zextRNO];

    // Add conditions for state, area, and site
    if (selectedState) {
        query += ` AND PLANT IN (
                        SELECT DISTINCT Maintenance_Plant 
                        FROM installedbase 
                        WHERE State = ?
                    )`;
        params.push(selectedState);
    }

    if (selectedArea) {
        query += ` AND PLANT IN (
                        SELECT DISTINCT Maintenance_Plant 
                        FROM installedbase 
                        WHERE Area = ?
                    )`;
        params.push(selectedArea);
    }

    if (selectedSite) {
        query += ` AND PLANT IN (
                        SELECT DISTINCT Maintenance_Plant 
                        FROM installedbase 
                        WHERE Site = ?
                    )`;
        params.push(selectedSite);
    }

    // Add date range filter
    if (startDate && endDate) {
        query += " AND [ZREQ_SDAT] >= ? AND [ZREQ_SDAT] <= ?";
        params.push(startDate, endDate);
    }

    try {
        // Connect to the database
        const db = await connectToDatabase();
        
        // Execute the query with parameters
        const result = await db.query(query, params);

        // Process data for date formatting and delay calculation
        const data = result.map(row => {
            let delay = null;
            const zactendt = parseDate(row.ZACTENDT);
            const zreq_sdat = parseDate(row.ZREQ_SDAT);

            if (zactendt && zreq_sdat) {
                delay = calculateDelay(zreq_sdat, zactendt);
            }

            return {
                ...row,
                ZACTENDT: formatDate(zactendt),
                ZACTSTDT: formatDate(parseDate(row.ZACTSTDT)),
                ZREQ_SDAT: formatDate(zreq_sdat),
                delay: delay,
            };
        });

        res.json(data);

    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Error retrieving data');
    }
});

// Utility functions
function parseDate(dateStr) {
    return dateStr ? new Date(dateStr.slice(0, 4), dateStr.slice(4, 6) - 1, dateStr.slice(6, 8)) : null;
}

function formatDate(date) {
    if (!date) return null;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function calculateDelay(startDate, endDate) {
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return startDate < endDate ? diffDays : -diffDays;
}

module.exports = router;
