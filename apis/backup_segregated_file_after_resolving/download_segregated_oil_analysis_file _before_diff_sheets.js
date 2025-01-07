const express = require('express');
const fs = require('fs');
const { connectToDatabase } = require('./connect3.js'); // Your database connection module

const router = express.Router();

// Set up CORS middleware
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '3600');
    next();
});

// Middleware to parse JSON bodies
router.use(express.json());

// Route to handle GET request
router.get('/', async (req, res) => {
    const financialYear = req.query.financialYear || '';

    if (!financialYear) {
        return res.status(400).json({ error: 'Financial year is required' });
    }

    // Calculate the posting date range based on the financial year
    const matches = financialYear.match(/FY (\d{4})-(\d{4})/);
    if (!matches) {
        return res.status(400).json({ error: 'Invalid financial year format. Use "FY YYYY-YYYY".' });
    }

    const startYear = matches[1];
    const endYear = matches[2];
    const startDate = `${startYear}-03-31`;
    const endDate = `${endYear}-04-01`;
    const currentDate = new Date().toISOString().split('T')[0]; // Today's date in 'YYYY-MM-DD' format

    // Tables to fetch data from
    const tables = [
        'gb_oil_change_all_orders',
        'gb_topup_all_orders',
        'PD_OIL_CHG_ORDER_all_orders',
        'YD_OIL_CHG_ORDER_all_orders',
        'ydpd_topup_all_orders',
        'fc_topup_all_orders',
        'fc_oil_change_all_orders',
        'dispute_all_orders',
    ];

    try {
        // Connect to the database
        const connection = await connectToDatabase();

        let allResults = [];
        let chunkSize = 2000; // Set the chunk size to 2000 records
        let offset = 0; // Start from the first record

        for (const table of tables) {
            let moreData = true;

            while (moreData) {
                // Construct and execute query for each table with LIMIT and OFFSET
                const query = `
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
                    FROM [dbo].[${table}]
                    WHERE [Posting Date] >= ?
                    AND [Posting Date] <= ?
                    AND [date_of_insertion] = ?
                    ORDER BY [id]
                    OFFSET ? ROWS
                    FETCH NEXT ? ROWS ONLY;
                `;

                // Execute the query with parameters (startDate, endDate, currentDate, offset, chunkSize)
                const result = await connection.query(query, [startDate, endDate, currentDate, offset, chunkSize]);

                if (result.length > 0) {
                    allResults = allResults.concat(result);
                    offset += chunkSize; // Move to the next chunk
                } else {
                    moreData = false; // No more data to fetch
                }
            }
        }

        // Close the database connection
        await connection.close();

        // Write the consolidated data to a JSON file
        const jsonFilePath = './segregated_data_retrieved.json';
        fs.writeFileSync(jsonFilePath, JSON.stringify(allResults, null, 2));
        console.log(`Data saved to ${jsonFilePath}`);

        // Send the consolidated data as a response
        res.status(200).json({ message: 'Data fetched successfully', data: allResults });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({ error: 'Error fetching data from database' });
    }
});

// Export the router
module.exports = router;
