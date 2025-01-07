const express = require('express');
const odbc = require('odbc');
const fs = require('fs');
const moment = require('moment-timezone');
const { connectToDatabase } = require('./connect3.js'); // Your database connection module
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
        // Connect to the database
        const db = await connectToDatabase();

        // Retrieve query parameters
        const financialYear = req.query.financial_year || '';
        const orderType = req.query.order_type || '';
        const month = req.query.month || '';

        // Combine data into an object and write to a JSON file
        const retrievedData = { financial_year: financialYear, order_type: orderType, month: month };
        const filePath = 'fc_data_retrieval_check.json';
        fs.writeFileSync(filePath, JSON.stringify(retrievedData, null, 2));

        // Dynamically determine the posting date range based on financial year
        let postingDateStart, postingDateEnd;
        if (financialYear) {
            const yearParts = financialYear.replace('FY ', '').split('-');
            const startYear = yearParts[0].trim();
            const endYear = yearParts[1].trim();

            postingDateStart = `${startYear}-03-31`;
            postingDateEnd = `${endYear}-04-01`;
        }

        // Get today's date, adjusted for previous day if before 9 AM
        let currentDate = moment().format('YYYY-MM-DD');
        if (moment().hour() < 9) {
            currentDate = moment().subtract(1, 'days').format('YYYY-MM-DD');
        }

        // Query to fetch all data from the main table without site-related details
        const sql1 = `
        SELECT 
            [id], 
            [Posting Date], 
            [Entry Date], 
            [Quantity], 
            [date_of_insertion], 
            [Order No], 
            [Function Loc], 
            [Issue], 
            [Return], 
            [Return Percentage], 
            [Plant], 
            [State], 
            [Area], 
            [Site], 
            [Material], 
            [Storage Location], 
            [Move Type], 
            [Material Document], 
            [Description], 
            [Val Type], 
            [Order Type], 
            [Component], 
            [WTG Model], 
            [Order], 
            [Current Oil Change Date], 
            [Area Incharge], 
            [State PMO], 
            [Order Status]
        FROM [dbo].[YD_OIL_CHG_ORDER_all_orders]
        WHERE [Posting Date] >= ? AND [Posting Date] <= ? AND [date_of_insertion] = ?
    `;
        
        // Execute the query with dynamic parameters
        console.log('Posting Date Start:', postingDateStart);
        console.log('Posting Date End:', postingDateEnd);
        console.log('Current Date:', currentDate);

        const oilChangeData = await db.query(sql1, [postingDateStart, postingDateEnd, currentDate]);

        // Fetch site-related information for each order
        for (let i = 0; i < oilChangeData.length; i++) {
            const site = oilChangeData[i].Site;

            // Query to fetch additional site information from the mapping table
            const sql2 = `
            SELECT 
                [SITE], 
                [STATE ENGG HEAD], 
                [AREA INCHARGE], 
                [SITE INCHARGE], 
                [STATE PMO]
            FROM [dbo].[site_area_incharge_mapping]
            WHERE [SITE] = ?
            `;

            // Fetch the site-related data for each site
            const siteData = await db.query(sql2, [site]);

            // Add the site information to the corresponding order data
            if (siteData.length > 0) {
                oilChangeData[i].StateEnggHead = siteData[0]['STATE ENGG HEAD'];
                oilChangeData[i].AreaIncharge = siteData[0]['AREA INCHARGE'];
                oilChangeData[i].SiteIncharge = siteData[0]['SITE INCHARGE'];
                oilChangeData[i].MappedStatePMO = siteData[0]['STATE PMO'];
            } else {
                // If no site data is found, you can leave the fields empty or handle as needed
                oilChangeData[i].StateEnggHead = null;
                oilChangeData[i].AreaIncharge = null;
                oilChangeData[i].SiteIncharge = null;
                oilChangeData[i].MappedStatePMO = null;
            }
        }

        // Return the final data including the additional site-related information
        res.json(oilChangeData);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error occurred' });
    }
});

// Export the router
module.exports = router;
