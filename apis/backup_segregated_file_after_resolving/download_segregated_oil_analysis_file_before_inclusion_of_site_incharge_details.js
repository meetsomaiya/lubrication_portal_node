const express = require('express');
const fs = require('fs');
const xlsx = require('xlsx'); // Excel library
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

    // Parse financial year
    const matches = financialYear.match(/FY (\d{4})-(\d{4})/);
    if (!matches) {
        return res.status(400).json({ error: 'Invalid financial year format. Use "FY YYYY-YYYY".' });
    }

    const startYear = matches[1];
    const endYear = matches[2];
    const startDate = `${startYear}-03-31`;
    const endDate = `${endYear}-04-01`;
    const currentDate = new Date().toISOString().split('T')[0]; // Today's date

    // List of tables to fetch data from
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

        // Create a new workbook
        const workbook = xlsx.utils.book_new();

        for (const table of tables) {
            let offset = 0; // Reset offset for each table
            let moreData = true;
            let tableResults = [];

            console.log(`Processing table: ${table}`);

            while (moreData) {
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

                const result = await connection.query(query, [startDate, endDate, currentDate, offset, 2000]);

                if (result.length > 0) {
                    tableResults = tableResults.concat(result);
                    offset += 2000;
                } else {
                    moreData = false;
                }
            }

            if (tableResults.length > 0) {
                console.log(`Appending sheet: ${table} with ${tableResults.length} rows`);
                const worksheet = xlsx.utils.json_to_sheet(tableResults);
                xlsx.utils.book_append_sheet(workbook, worksheet, table);
            } else {
                console.log(`No data found for table: ${table}`);
            }
        }

        // Close the database connection
        await connection.close();

        // Save the workbook
        const excelFilePath = './segregated_data.xlsx';
        xlsx.writeFile(workbook, excelFilePath);
        console.log(`Data saved to ${excelFilePath}`);

        // Send the file for download
        res.download(excelFilePath, (err) => {
            if (err) {
                console.error('Error sending the file:', err);
                res.status(500).json({ error: 'Error downloading the file' });
            } else {
                console.log('File sent successfully');
            }
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({ error: 'Error fetching data from database' });
    }
});

// Export the router
module.exports = router;
