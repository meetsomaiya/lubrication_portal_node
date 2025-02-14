const express = require('express');
const odbc = require('odbc');
const moment = require('moment-timezone');
// const { connectToDatabase } = require('./connect6.js');
const { connectToDatabase } = require('./connect8.js');
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
        const stateValue = req.query.state || ''; // Retrieve state value from query params

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

        while (hasMoreData) {
            const sqlQuery = `
                SELECT 
                    o.[id], 
                    o.[Posting Date], 
                    o.[Entry Date], 
                    o.[Quantity], 
                    o.[date_of_insertion], 
                    o.[Order No], 
                    o.[Function Loc], 
                    o.[Issue], 
                    o.[Return], 
                    o.[Return Percentage], 
                    o.[Plant], 
                    o.[State], 
                    o.[Area], 
                    o.[Site], 
                    o.[Material], 
                    o.[Storage Location], 
                    o.[Move Type], 
                    o.[Material Document], 
                    o.[Description], 
                    o.[Val Type], 
                    o.[Order Type], 
                    o.[Component], 
                    o.[WTG Model], 
                    o.[Order], 
                    o.[Current Oil Change Date], 
                    o.[Order Status],
                    COALESCE(r.[Reason], NULL) AS [Reason] -- Ensure NULL if no matching reason
                FROM [dbo].[dispute_all_orders] o
                LEFT JOIN [dbo].[reason_for_dispute_and_pending_teco] r
                ON o.[Order No] = r.[Order No]
                WHERE o.[Posting Date] >= ? 
                AND o.[Posting Date] <= ? 
                AND o.[date_of_insertion] = ?
                AND (o.[State] = ? OR ? = '') -- Allows filtering by state if provided
                ORDER BY o.[id]
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY;
            `;

            console.log("Executing Order Query:", sqlQuery);
            console.log("Query Parameters:", [postingDateStart, postingDateEnd, currentDate, stateValue, stateValue, offset, limit]);

            const orders = await db.query(sqlQuery, [postingDateStart, postingDateEnd, currentDate, stateValue, stateValue, offset, limit]);
            
            console.log("Fetched Orders:", orders.length); // Debugging output

            allData = allData.concat(orders);

            if (orders.length < limit) {
                hasMoreData = false;
            } else {
                offset += limit;
            }
        }

        if (allData.length === 0) {
            console.log("No orders found.");
            return res.json([]);
        }

        // Extract unique site values
        const siteSet = new Set();
        allData.forEach(order => {
            if (order.Site) {
                siteSet.add(order.Site);
            }
        });

        const siteArray = Array.from(siteSet);
        if (siteArray.length > 0) {
            const placeholders = siteArray.map(() => '?').join(', ');

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

            console.log("Executing Site Details Query:", siteDetailsQuery);
            console.log("Query Parameters:", siteArray);

            const siteDetails = await db.query(siteDetailsQuery, siteArray);

            console.log("Fetched Site Details:", siteDetails.length); // Debugging output

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
        }

        res.json(allData);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error occurred' });
    }
});

module.exports = router;
