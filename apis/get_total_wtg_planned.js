const express = require('express');
const odbc = require('odbc');
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

// Helper function to convert date from YYYYMMDD to YYYY-MM-DD
const formatDatabaseDate = (date) => {
    if (!date || date === 'Invalid Date') return null; // Handle invalid dates
    return date.slice(0, 4) + '-' + date.slice(4, 6) + '-' + date.slice(6, 8);
};

// Route to handle GET request
router.get('/', async (req, res) => {
    // Extract parameters from query
    const zextRNO = req.query.orderType || '';
    const selectedState = (req.query.state && req.query.state !== 'Select') ? req.query.state : '';
    const selectedArea = (req.query.area && req.query.area !== 'Select') ? req.query.area : '';
    const selectedSite = (req.query.site && req.query.site !== 'Select') ? req.query.site : '';
    const startDate = req.query.fromDate || null;
    const endDate = req.query.toDate || null;

    // Check if ZEXT_RNO is empty
    if (!zextRNO) {
        return res.send('');
    }

    // Prepare the base query
    let query = `
        SELECT [FUNCT_LOC], [PLANT], [CRM_ORDERH], [ZTEXT1], [ZACTENDT], [ZACTSTDT], [ZEXT_RNO], [ZREQ_SDAT]
        FROM Schedule_plan_lubrication
        WHERE ZEXT_RNO = ?
        AND ZTEXT1 NOT IN ('Deletion Flag')
        AND CONVERT(DATE, TRY_CAST([ZREQ_SDAT] AS DATE), 23) <= GETDATE()
        AND [PLANT] NOT LIKE 'T%'`;

    // Initialize parameters array for binding
    const params = [zextRNO];

    // Add conditions based on selected state, area, and site
    if (selectedState) {
        query += `
            AND [PLANT] IN (
                SELECT DISTINCT [Maintenance_Plant]
                FROM installedbase
                WHERE State = ?)`;
        params.push(selectedState);
    }

    if (selectedArea) {
        query += `
            AND [PLANT] IN (
                SELECT DISTINCT [Maintenance_Plant]
                FROM installedbase
                WHERE Area = ?)`;
        params.push(selectedArea);
    }

    if (selectedSite) {
        query += `
            AND [PLANT] IN (
                SELECT DISTINCT [Maintenance_Plant]
                FROM installedbase
                WHERE Site = ?)`;
        params.push(selectedSite);
    }

    // Check if start and end dates are set
    if (startDate && endDate) {
        // Convert startDate and endDate to YYYYMMDD format for the query
        const startDateFormatted = startDate.replace(/-/g, '');
        const endDateFormatted = endDate.replace(/-/g, '');
        query += ` AND [ZREQ_SDAT] >= ? AND [ZREQ_SDAT] <= ?`;
        params.push(startDateFormatted, endDateFormatted);
    }

    try {
        const db = await connectToDatabase(); // Assume connectToDatabase returns a valid ODBC connection
        const result = await db.query(query, params);

        const today = new Date();
        const rows = result.map(row => {
            const actEnd = new Date(formatDatabaseDate(row.ZACTENDT));
            const reqStart = new Date(formatDatabaseDate(row.ZREQ_SDAT));

            // Calculate the difference between ZACTENDT and ZREQ_SDAT
            let difference = Math.abs((reqStart - actEnd) / (1000 * 60 * 60 * 24));

            // Adjust the sign of the difference based on dates
            difference = reqStart < actEnd ? difference : -difference;
            row.delay = difference;

            // Check if ZTEXT1 is 'open' or 'in process'
            if (row.ZTEXT1.toLowerCase() === 'open' || row.ZTEXT1.toLowerCase() === 'in process') {
                row.ZACTENDT = '-';
                row.ZACTSTDT = '-';

                const zreqSdat = new Date(formatDatabaseDate(row.ZREQ_SDAT));
                if (zreqSdat) {
                    const delay = Math.floor((today - zreqSdat) / (1000 * 60 * 60 * 24));
                    row.delay = zreqSdat > today ? -delay : delay;
                } else {
                    row.delay = null; // Set delay as null if unable to calculate
                }

                // Format ZREQ_SDAT column
                if (row.ZREQ_SDAT) {
                    row.ZREQ_SDAT = zreqSdat.toLocaleDateString('en-GB'); // Format as dd-mm-yyyy
                }
            } else {
                // Format date columns
                if (row.ZACTENDT) {
                    row.ZACTENDT = actEnd.toLocaleDateString('en-GB'); // Format as dd-mm-yyyy
                }
                if (row.ZACTSTDT) {
                    row.ZACTSTDT = new Date(formatDatabaseDate(row.ZACTSTDT)).toLocaleDateString('en-GB');
                }
                if (row.ZREQ_SDAT) {
                    row.ZREQ_SDAT = reqStart.toLocaleDateString('en-GB');
                }
            }

            return row;
        });

        // Return the result as JSON
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Export the router
module.exports = router;
