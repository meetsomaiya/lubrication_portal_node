const express = require('express');
const odbc = require('odbc');
const moment = require('moment-timezone');
const { connectToDatabase } = require('./connect6.js');

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
        const stateValue = req.query.state || '';

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
                    r.[Reason]
                FROM [dbo].[dispute_all_orders] o
                LEFT JOIN [dbo].[reason_for_dispute_and_pending_teco] r
                ON o.[Order No] = r.[Order No]
                WHERE o.[Posting Date] >= ? 
                AND o.[Posting Date] <= ? 
                AND o.[date_of_insertion] = ?
                AND o.[State] = ?
                ORDER BY o.[id]
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY;
            `;

            console.log("Executing SQL Query for Orders:", sqlQuery);
            console.log("With Parameters:", [postingDateStart, postingDateEnd, currentDate, stateValue, offset, limit]);

            const orders = await db.query(sqlQuery, [postingDateStart, postingDateEnd, currentDate, stateValue, offset, limit]);
            allData = allData.concat(orders);

            if (orders.length < limit) {
                hasMoreData = false;
            } else {
                offset += limit;
            }
        }

        // Extract unique site values
        const siteSet = new Set(allData.map(order => order.Site).filter(site => site));
        const siteArray = Array.from(siteSet);

        let siteDetailsMap = {};
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

            console.log("Executing SQL Query for Site Details:", siteDetailsQuery);
            console.log("With Parameters:", siteArray);

            const siteDetails = await db.query(siteDetailsQuery, siteArray);

            siteDetailsMap = siteDetails.reduce((map, site) => {
                map[site.SITE] = {
                    stateEnggHead: site['STATE ENGG HEAD'] || null,
                    areaIncharge: site['AREA INCHARGE'] || null,
                    siteIncharge: site['SITE INCHARGE'] || null,
                    statePMO: site['STATE PMO'] || null,
                };
                return map;
            }, {});
        }

        // Add site details to orders
        allData = allData.map(order => ({
            ...order,
            stateEnggHead: siteDetailsMap[order.Site]?.stateEnggHead || null,
            areaIncharge: siteDetailsMap[order.Site]?.areaIncharge || null,
            siteIncharge: siteDetailsMap[order.Site]?.siteIncharge || null,
            statePMO: siteDetailsMap[order.Site]?.statePMO || null,
            reason: order.Reason || null, // Ensure null if no reason found
        }));

        res.json(allData);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error occurred' });
    }
});

module.exports = router;
