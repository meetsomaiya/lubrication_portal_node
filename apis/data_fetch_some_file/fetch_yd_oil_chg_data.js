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

        // Combined data query with JOIN
        const sql = `
            SELECT 
                o.[id], o.[Posting Date], o.[Entry Date], o.[Quantity], o.[date_of_insertion], 
                o.[Order No], o.[Function Loc], o.[Issue], o.[Return], o.[Return Percentage], 
                o.[Plant], o.[State], o.[Area], o.[Site], o.[Material], o.[Storage Location], 
                o.[Move Type], o.[Material Document], o.[Description], o.[Val Type], 
                o.[Order Type], o.[Component], o.[WTG Model], o.[Order], 
                o.[Current Oil Change Date], o.[Area Incharge], o.[State PMO], o.[Order Status],
                s.[STATE ENGG HEAD] AS StateEnggHead,
                s.[AREA INCHARGE] AS AreaIncharge,
                s.[SITE INCHARGE] AS SiteIncharge,
                s.[STATE PMO] AS MappedStatePMO
            FROM [dbo].[YD_OIL_CHG_ORDER_all_orders] AS o
            LEFT JOIN [dbo].[site_area_incharge_mapping] AS s
            ON o.[Site] = s.[SITE]
            WHERE o.[Posting Date] >= ? AND o.[Posting Date] <= ? AND o.[date_of_insertion] = ?
        `;
        
        const oilChangeData = await db.query(sql, [postingDateStart, postingDateEnd, currentDate]);

        // Return the final data
        res.json(oilChangeData);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error occurred' });
    }
});

// Export the router
module.exports = router;
