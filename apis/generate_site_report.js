const express = require('express');
const odbc = require('odbc');
// const { connectToDatabase } = require('./connect.js');
const { connectToDatabase } = require('./connect6.js');
const router = express.Router();
const fs = require('fs');

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
    const selectedState = req.query.state || '';
    const selectedArea = req.query.area || '';
    const selectedSite = req.query.site || '';

    try {
        const connection = await connectToDatabase(); // Connect to the database

        // Initialize the results array
        const results = [];

        // Construct the base query
        let base_query = `
            SELECT
                COUNT(*) AS total_count,
                SUM(CASE WHEN TRY_CAST(ZREQ_SDAT AS DATE) IS NOT NULL AND ZTEXT1 NOT IN ('Deletion Flag') THEN 1 ELSE 0 END) AS planned_count,
                SUM(CASE WHEN ZTEXT1 IN ('Open', 'In Process')
                          AND TRY_CAST(ZREQ_SDAT AS DATE) IS NOT NULL
                          AND TRY_CAST(ZREQ_SDAT AS DATE) <= GETDATE()
                          AND ZTEXT1 NOT IN ('Deletion Flag')
                          THEN 1 ELSE 0 END) AS open_count,
                SUM(CASE WHEN ZTEXT1 NOT IN ('Open', 'In Process', 'Deletion Flag')
                          AND TRY_CAST(ZREQ_SDAT AS DATE) IS NOT NULL
                          AND TRY_CAST(ZREQ_SDAT AS DATE) <= GETDATE()
                          AND ZTEXT1 NOT IN ('Deletion Flag')
                          THEN 1 ELSE 0 END) AS completed_count,
                SUM(CASE WHEN ZTEXT1 NOT IN ('Open', 'In Process', 'Deletion Flag')
                          AND TRY_CAST(ZREQ_SDAT AS DATE) IS NOT NULL
                          AND TRY_CAST(ZACTENDT AS DATE) IS NOT NULL
                          AND TRY_CAST(ZREQ_SDAT AS DATE) < TRY_CAST(ZACTENDT AS DATE)
                          AND DATEDIFF(DAY, TRY_CAST(ZREQ_SDAT AS DATE), TRY_CAST(ZACTENDT AS DATE)) > 7
                          AND CAST(ZREQ_SDAT AS DATE) BETWEEN DATEADD(YEAR, -2, GETDATE()) AND DATEADD(YEAR, 2, GETDATE())
                          AND ZTEXT1 NOT IN ('Deletion Flag') THEN 1 ELSE 0 END) AS grace_count ,
                          ZEXT_RNO
            FROM
                Schedule_plan_lubrication
            WHERE DATEDIFF(day, DATEADD(YEAR, -2, GETDATE()), CONVERT(DATE, TRY_CAST(ZREQ_SDAT AS DATE), 23)) >= 0
            AND ZEXT_RNO IS NOT NULL AND ZEXT_RNO <> ''
            AND ZTEXT1 NOT IN ('Deletion Flag')
        `;

        // console.log('Base query constructed:', base_query);

        // Prepare conditions
        const conditions = [];
        const params = [];

        if (selectedState) {
            conditions.push("PLANT IN (SELECT DISTINCT Maintenance_Plant FROM installedbase WHERE State = ?)");
            params.push(selectedState);
        }

        if (selectedArea) {
            conditions.push("PLANT IN (SELECT DISTINCT Maintenance_Plant FROM installedbase WHERE Area = ?)");
            params.push(selectedArea);
        }

        if (selectedSite) {
            conditions.push("PLANT IN (SELECT DISTINCT Maintenance_Plant FROM installedbase WHERE Site = ?)");
            params.push(selectedSite);
        }

        // Add conditions to the base query
        if (conditions.length) {
            base_query += " AND " + conditions.join(" AND ");
            // console.log('Updated base query with conditions:', base_query);
        }

        // Group by ZEXT_RNO
        base_query += " GROUP BY ZEXT_RNO";

        // console.log('Final query before execution:', base_query, 'with parameters:', params);

        // Execute the query
        const queryResult = await connection.query(base_query, params);
        // console.log('Query executed successfully, result:', queryResult);

        results.push(...queryResult); // Spread the result into the results array

        // Calculate percentages
        results.forEach(result => {
            const planned_percentage = result.total_count > 0 ? Math.round((result.planned_count / result.total_count) * 10000) / 100 : 0;
            const open_percentage = planned_percentage > 0 ? Math.round(((result.planned_count - result.open_count) / result.planned_count) * 10000) / 100 : 0;
            const completed_percentage = planned_percentage > 0 ? Math.round((result.completed_count / result.planned_count) * 10000) / 100 : 0;
            const grace_percentage = planned_percentage > 0 ? Math.round((result.grace_count / result.planned_count) * 10000) / 100 : 0;

            result.total_percentage = 100;
            result.planned_percentage = planned_percentage;
            result.open_percentage = open_percentage;
            result.completed_percentage = completed_percentage;
            result.grace_percentage = grace_percentage;
        });

        // Write the JSON data to a file
        const file_path = 'site_report.json'; // Change this to your desired file path
        fs.writeFileSync(file_path, JSON.stringify(results, null, 2));

        // Output the results in JSON format
        res.json(results);
    } catch (err) {
        console.error('Error:', err);
        // Log the exception details into a JSON file
        const error_data = {
            error_message: err.message,
            error_code: err.code,
            error_file: err.stack.split('\n')[1], // Get the file name from the stack trace
            error_line: err.stack.split('\n')[2], // Get the line number from the stack trace
            error_trace: err.stack
        };

        const error_log_file = 'database_error_site_report.json'; // Choose your desired error log file path
        fs.writeFileSync(error_log_file, JSON.stringify(error_data, null, 2));

        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        // Uncomment to close the database connection if needed
        // if (connection) {
        //     await connection.close(); // Close the database connection
        // }
    }
});

// Export the router
module.exports = router;
