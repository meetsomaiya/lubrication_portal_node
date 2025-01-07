const express = require('express');
const odbc = require('odbc');
const fs = require('fs').promises; // Use async file operations
const moment = require('moment-timezone');
const { connectToDatabase } = require('./connect3.js'); // Database connection module with pooling
const router = express.Router();

// Set timezone to Asia/Kolkata
moment.tz.setDefault('Asia/Kolkata');

// CORS middleware
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '3600');
    next();
});

// Route to handle GET request
router.get('/', async (req, res) => {
    try {
        // Connect to the database using a connection pool
        const db = await connectToDatabase();

        // Retrieve query parameters
        const { financial_year = '', order_type = '', month = '' } = req.query;

        // Write parameters to JSON file asynchronously
        const filePath = 'fc_data_retrieval_check.json';
        const retrievedData = { financial_year, order_type, month };
        fs.writeFile(filePath, JSON.stringify(retrievedData, null, 2)).catch(console.error);

        // Determine posting date range based on financial year
        let postingDateStart, postingDateEnd;
        if (financial_year) {
            const [startYear, endYear] = financial_year.replace('FY ', '').split('-').map(part => part.trim());
            postingDateStart = `${startYear}-03-31`;
            postingDateEnd = `${endYear}-04-01`;
        }

        // Get current date, adjusted if before 9 AM
        const currentDate = moment().hour() < 9
            ? moment().subtract(1, 'days').format('YYYY-MM-DD')
            : moment().format('YYYY-MM-DD');

        // Primary data query
        const sql1 = `
            SELECT 
                [id], [Posting Date], [Entry Date], [Quantity], [date_of_insertion], 
                [Order No], [Function Loc], [Issue], [Return], [Return Percentage], 
                [Plant], [State], [Area], [Site], [Material], [Storage Location], 
                [Move Type], [Material Document], [Description], [Val Type], 
                [Order Type], [Component], [WTG Model], [Order], 
                [Current Oil Change Date], [Area Incharge], [State PMO], [Order Status]
            FROM [dbo].[gb_oil_change_all_orders]
            WHERE [Posting Date] >= ? AND [Posting Date] <= ? AND [date_of_insertion] = ?
        `;
        
        const oilChangeData = await db.query(sql1, [postingDateStart, postingDateEnd, currentDate]);

        // Collect unique site names for batch querying
        const uniqueSites = [...new Set(oilChangeData.map(row => row.Site))];
        if (uniqueSites.length > 0) {
            // Batch query for site-related information
            const sql2 = `
                SELECT 
                    [SITE], [STATE ENGG HEAD], [AREA INCHARGE], [SITE INCHARGE], [STATE PMO]
                FROM [dbo].[site_area_incharge_mapping]
                WHERE [SITE] IN (${uniqueSites.map(() => '?').join(', ')})
            `;
            const siteDataRows = await db.query(sql2, uniqueSites);

            // Create a map for quick lookup of site information
            const siteDataMap = siteDataRows.reduce((map, row) => {
                map[row.SITE] = {
                    StateEnggHead: row['STATE ENGG HEAD'],
                    AreaIncharge: row['AREA INCHARGE'],
                    SiteIncharge: row['SITE INCHARGE'],
                    MappedStatePMO: row['STATE PMO'],
                };
                return map;
            }, {});

            // Merge site information back into the primary data
            oilChangeData.forEach(row => {
                const siteInfo = siteDataMap[row.Site] || {};
                row.StateEnggHead = siteInfo.StateEnggHead || null;
                row.AreaIncharge = siteInfo.AreaIncharge || null;
                row.SiteIncharge = siteInfo.SiteIncharge || null;
                row.MappedStatePMO = siteInfo.MappedStatePMO || null;
            });
        }

        // Return the final data
        res.json(oilChangeData);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error occurred' });
    }
});

// Export the router
module.exports = router;
