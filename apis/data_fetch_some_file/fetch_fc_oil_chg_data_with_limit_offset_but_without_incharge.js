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

        const limit = 500; // Adjust this based on your database's capabilities and response size.
        let offset = 0;
        let allData = [];
        let hasMoreData = true;

        // Fetch data in chunks until no more data is left
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
                    [Area Incharge], 
                    [State PMO], 
                    [Order Status]
                FROM [dbo].[fc_oil_change_all_orders]
                WHERE [Posting Date] >= ? AND [Posting Date] <= ? AND [date_of_insertion] = ?
                ORDER BY [id]
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY;
            `;

            const chunk = await db.query(sqlQuery, [postingDateStart, postingDateEnd, currentDate, offset, limit]);
            allData = allData.concat(chunk);

            if (chunk.length < limit) {
                hasMoreData = false;
            } else {
                offset += limit;
            }
        }

        res.json(allData); // Send the combined data as a single response
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error occurred' });
    }
});

module.exports = router;
