const express = require('express');
const odbc = require('odbc');
const fs = require('fs');
const moment = require('moment-timezone');
const { connectToDatabase } = require('./connect3.js'); // Database connection
const router = express.Router();

moment.tz.setDefault("Asia/Kolkata");

router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '3600');
    next();
});

router.get('/', async (req, res) => {
    const financialYear = req.query.financial_year || '';
    const orderType = req.query.order_type || '';
    const month = req.query.month || '';
    const stateValue = req.query.state || ''; // Retrieve state value from the query params

    // Write retrieved data to a JSON file
    const retrievedData = { financial_year: financialYear, order_type: orderType, month: month };
    fs.writeFileSync('fc_data_retrieval_check.json', JSON.stringify(retrievedData, null, 2));

    // Determine posting date range based on financial year
    let postingDateStart, postingDateEnd;
    if (financialYear) {
        const [startYear, endYear] = financialYear.replace('FY ', '').split('-').map(year => year.trim());
        postingDateStart = `${startYear}-03-31`;
        postingDateEnd = `${endYear}-04-01`;
    }

    // Set current date (modified if current hour < 9)
    let currentDate = moment().format('YYYY-MM-DD');
    const currentHour = moment().hour();
    if (currentHour < 9) {
        currentDate = moment().subtract(1, 'day').format('YYYY-MM-DD');
    }

    try {
        const db = await connectToDatabase();
        const pendingTecoTables = ['gb_oil_change_all_orders', 'PD_OIL_CHG_ORDER_all_orders', 'YD_OIL_CHG_ORDER_all_orders', 'fc_oil_change_all_orders', 'dispute_all_orders'];
        let mergedData = [];
        const chunkSize = 2000; // Limit per chunk
        let offset = 0;
        let hasMoreData = true;

        // Fetch data in chunks from each of the tables
        while (hasMoreData) {
            for (const table of pendingTecoTables) {
                const sql = `
                    SELECT [id], [Posting Date], [Entry Date], [Quantity], [date_of_insertion], [Return] AS [Return],
                        [Return Percentage], [Plant], [State], [Area], [Site], [Material], [Storage Location], 
                        [Move Type], [Material Document], [Description], [Val Type], [Order Type], [Component], 
                        [WTG Model], [Order], [Current Oil Change Date], [Area Incharge], [State PMO], [Order Status], 
                        [Order No], [Function Loc], [Issue], [Material], [Storage Location], [Move Type], 
                        [Material Document], [Description], [Val Type]
                    FROM [NewDatabase].[dbo].[${table}]
                    WHERE [Posting Date] BETWEEN ? AND ?
                    AND [Order Status] IN ('Released', 'In Process')
                    AND [date_of_insertion] = ?
                    AND [State] = ?  -- Add the state value filter
                    ORDER BY [id]
                    OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
                `;

                const result = await db.query(sql, [postingDateStart, postingDateEnd, currentDate,stateValue, offset, chunkSize]);
                if (result.length > 0) {
                    mergedData.push(...result);
                    offset += chunkSize; // Increase offset for the next chunk
                } else {
                    hasMoreData = false; // No more data to fetch
                    break;
                }
            }
        }

        // Now, for each unique order, fetch additional data from the site_area_incharge_mapping table
        for (let i = 0; i < mergedData.length; i++) {
            const order = mergedData[i];
            const site = order.Site;

            // Fetch additional data for the current unique site
            const siteSql = `
                SELECT [STATE ENGG HEAD], [AREA INCHARGE], [SITE INCHARGE], [STATE PMO]
                FROM [NewDatabase].[dbo].[site_area_incharge_mapping]
                WHERE [SITE] = ?
            `;
            
            const siteData = await db.query(siteSql, [site]);
            if (siteData.length > 0) {
                // Attach the additional site data to the order
                order['stateEnggHead'] = siteData[0]['STATE ENGG HEAD'];
                order['areaIncharge'] = siteData[0]['AREA INCHARGE'];
                order['siteIncharge'] = siteData[0]['SITE INCHARGE'];
                order['statePMO'] = siteData[0]['STATE PMO'];
            }
        }

        // Send the merged data as the response, including additional data from the site_area_incharge_mapping table
        res.json(mergedData);

        // Optionally save the merged data to a JSON file
        fs.writeFileSync('pending_teco_data.json', JSON.stringify(mergedData, null, 2));
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

module.exports = router;
