const express = require('express');
const moment = require('moment-timezone');
const { connectToMSSQL } = require('./connect8.js'); // Updated connection file
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
        const pool = await connectToMSSQL();

        const financialYear = req.query.financial_year || '';
        const month = req.query.month || '';

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

        // Fetch orders with LEFT JOIN for reasons
        while (hasMoreData) {
            const sqlQuery = `
                SELECT 
                    o.[id], 
                    CONVERT(VARCHAR, o.[Posting Date], 23) AS [Posting Date], 
                    CONVERT(VARCHAR, o.[Entry Date], 23) AS [Entry Date], 
                    o.[Quantity], 
                    CONVERT(VARCHAR, o.[date_of_insertion], 23) AS [date_of_insertion], 
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
                    CONVERT(VARCHAR, o.[Current Oil Change Date], 23) AS [Current Oil Change Date], 
                    o.[Order Status],
                    r.[Reason] -- Fetch reason directly with LEFT JOIN
                FROM [dbo].[dispute_all_orders] o
                LEFT JOIN (
                    SELECT [Order No], MIN([Reason]) AS [Reason] 
                    FROM [dbo].[reason_for_dispute_and_pending_teco] 
                    GROUP BY [Order No]
                ) r ON o.[Order No] = r.[Order No]
                WHERE o.[Posting Date] >= @postingDateStart 
                AND o.[Posting Date] <= @postingDateEnd 
                AND o.[date_of_insertion] = @currentDate
                ORDER BY o.[id]
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
            `;

            const result = await pool.request()
                .input('postingDateStart', postingDateStart)
                .input('postingDateEnd', postingDateEnd)
                .input('currentDate', currentDate)
                .input('offset', offset)
                .input('limit', limit)
                .query(sqlQuery);

            allData = allData.concat(result.recordset);

            if (result.recordset.length < limit) {
                hasMoreData = false;
            } else {
                offset += limit;
            }
        }

        // Extract unique site values
        const siteSet = new Set(allData.map(order => order.Site).filter(Boolean));

        if (siteSet.size > 0) {
            const siteArray = Array.from(siteSet);

            // Fetch site details
            const siteDetailsQuery = `
                SELECT 
                    [SITE], 
                    [STATE ENGG HEAD], 
                    [AREA INCHARGE], 
                    [SITE INCHARGE], 
                    [STATE PMO]
                FROM [dbo].[site_area_incharge_mapping]
                WHERE [SITE] IN (${siteArray.map((_, i) => `@site${i}`).join(', ')});
            `;

            const siteRequest = pool.request();
            siteArray.forEach((site, i) => siteRequest.input(`site${i}`, site));

            const siteDetails = await siteRequest.query(siteDetailsQuery);

            // Create a map for site details
            const siteDetailsMap = {};
            siteDetails.recordset.forEach(site => {
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
        console.error('❌ Error:', error);
        res.status(500).json({ message: 'Server error occurred' });
    }
});

module.exports = router;
