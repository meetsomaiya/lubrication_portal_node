const express = require('express');
const odbc = require('odbc');
const moment = require('moment-timezone');
const { connectToDatabase } = require('./connect3.js');
const router = express.Router();

moment.tz.setDefault('Asia/Kolkata');

// Set up CORS middleware
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '3600');
    next();
});

router.get('/', async (req, res) => {
    try {
        const db = await connectToDatabase();

        const financialYear = req.query.financial_year || '';
        const orderType = req.query.order_type || '';
        const month = req.query.month || '';
        const stateValue = req.query.state || ''; // Retrieve state value from the query params

        let postingDateStart, postingDateEnd;
        if (financialYear) {
            const yearParts = financialYear.replace('FY ', '').split('-');
            const startYear = yearParts[0].trim();
            const endYear = yearParts[1].trim();

            postingDateStart = `${startYear}-03-31`;
            postingDateEnd = `${endYear}-04-01`;
        }

        let currentDate = moment().format('YYYY-MM-DD');
        if (moment().hour() < 9) {
            currentDate = moment().subtract(1, 'days').format('YYYY-MM-DD');
        }

        const limit = 2000;
        let offset = 0;
        let allData = [];
        let hasMoreData = true;

        // Fetch orders first
        while (hasMoreData) {
            const sqlQuery = `
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
                    [Order Status]
                FROM [dbo].[ydpd_topup_all_orders]
                WHERE [Posting Date] >= ? AND [Posting Date] <= ? AND [date_of_insertion] = ?
                AND [State] = ?  -- Add the state value filter
                ORDER BY [id]
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY;
            `;

            const orders = await db.query(sqlQuery, [postingDateStart, postingDateEnd, currentDate, stateValue, offset, limit]);
            allData = allData.concat(orders);

            if (orders.length < limit) {
                hasMoreData = false;
            } else {
                offset += limit;
            }
        }

        // Extract unique site values
        const siteSet = new Set();
        allData.forEach(order => {
            if (order.Site) {
                siteSet.add(order.Site);
            }
        });

        // Convert the siteSet to an array and create placeholders for the IN clause
        const siteArray = Array.from(siteSet);
        const placeholders = siteArray.map(() => '?').join(', ');

        // Fetch site details for unique sites
        const siteDetailsQuery = `
            SELECT 
                [SITE], 
                [STATE ENGG HEAD], 
                [AREA INCHARGE], 
                [SITE INCHARGE], 
                [STATE PMO]
            FROM [dbo].[site_area_incharge_mapping]
            WHERE [SITE] IN (${placeholders});
        `;
        
        // Execute the query with all site values
        const siteDetails = await db.query(siteDetailsQuery, siteArray);

        // Create a map for site details based on site values
        const siteDetailsMap = {};
        siteDetails.forEach(site => {
            siteDetailsMap[site.SITE] = {
                stateEnggHead: site['STATE ENGG HEAD'],
                areaIncharge: site['AREA INCHARGE'],
                siteIncharge: site['SITE INCHARGE'],
                statePMO: site['STATE PMO'],
            };
        });

        // Add the site details to the orders
        allData = allData.map(order => {
            const siteData = siteDetailsMap[order.Site] || {};
            return {
                ...order,
                stateEnggHead: siteData.stateEnggHead || null,
                areaIncharge: siteData.areaIncharge || null,
                siteIncharge: siteData.siteIncharge || null,
                statePMO: siteData.statePMO || null,
            };
        });

        // Send the combined data as a single response
        res.json(allData);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error occurred' });
    }
});

module.exports = router;
