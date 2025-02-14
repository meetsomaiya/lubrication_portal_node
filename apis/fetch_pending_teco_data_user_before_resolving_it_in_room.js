const express = require('express');
const fs = require('fs');
const moment = require('moment-timezone');
const { connectToMSSQL } = require('./connect7.js');
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
    const stateValue = req.query.state || '';

    fs.writeFileSync('fc_data_retrieval_check.json', JSON.stringify({ financial_year: financialYear, order_type: orderType, month }, null, 2));

    let postingDateStart, postingDateEnd;
    if (financialYear) {
        const [startYear, endYear] = financialYear.replace('FY ', '').split('-').map(year => year.trim());
        postingDateStart = `${startYear}-03-31`;
        postingDateEnd = `${endYear}-04-01`;
    }

    let currentDate = moment().format('YYYY-MM-DD');
    if (moment().hour() < 9) {
        currentDate = moment().subtract(1, 'day').format('YYYY-MM-DD');
    }

    try {
        const tables = ['gb_oil_change_all_orders', 'PD_OIL_CHG_ORDER_all_orders', 'YD_OIL_CHG_ORDER_all_orders', 'fc_oil_change_all_orders', 'dispute_all_orders'];
        let mergedData = [];

        for (const table of tables) {
            const sql = `
                SELECT * FROM [dbo].[${table}]
                WHERE [Posting Date] BETWEEN '${postingDateStart}' AND '${postingDateEnd}'
                AND [Order Status] IN ('Released', 'In Process')
                AND [date_of_insertion] = '${currentDate}'
                AND [State] = '${stateValue}'
                ORDER BY [id]`;
            
            console.log("Executing SQL Query:", sql);
            const result = await connectToMSSQL(sql);
            mergedData.push(...result);
        }

        for (let order of mergedData) {
            const siteSql = `
                SELECT [STATE ENGG HEAD], [AREA INCHARGE], [SITE INCHARGE], [STATE PMO]
                FROM [dbo].[site_area_incharge_mapping]
                WHERE [SITE] = '${order.Site}'
            `;
            
            console.log("Executing SQL Query:", siteSql);
            const siteData = await connectToMSSQL(siteSql);
            if (siteData.length > 0) {
                Object.assign(order, {
                    stateEnggHead: siteData[0]['STATE ENGG HEAD'],
                    areaIncharge: siteData[0]['AREA INCHARGE'],
                    siteIncharge: siteData[0]['SITE INCHARGE'],
                    statePMO: siteData[0]['STATE PMO']
                });
            }
        }

        res.json(mergedData);
        fs.writeFileSync('pending_teco_data.json', JSON.stringify(mergedData, null, 2));
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

module.exports = router;
