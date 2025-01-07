const express = require('express');
const fs = require('fs');
const xlsx = require('xlsx'); // Excel library
const { connectToDatabase } = require('./connect3.js'); // Your database connection module
const ExcelJS = require('exceljs');

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

// Helper function to convert a date into Excel's serial number format
const excelDate = (dateStr) => {
    if (!dateStr) return null;

    // Convert DD-MM-YYYY to YYYY-MM-DD
    const toIsoFormat = (date) => {
        const [day, month, year] = date.split('-');
        return `${year}-${month}-${day}`;
    };

    const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
    const europeanDatePattern = /^\d{2}-\d{2}-\d{4}$/; // DD-MM-YYYY

    let date;
    if (isoDatePattern.test(dateStr)) {
        date = new Date(dateStr);
    } else if (europeanDatePattern.test(dateStr)) {
        date = new Date(toIsoFormat(dateStr));
    } else {
        return null; // Return null if the format is invalid
    }

    // Excel-compatible serial number for the date
    return date;
};
    
    


    

    // function groupDatesByMonth(data) {
    //     const grouped = {};
    //     for (const order of data) {
    //         const postingDate = new Date(order['Posting Date']);
    //         const monthYear = `${postingDate.toLocaleString('default', { month: 'short' })} ${postingDate.getFullYear()}`;
    
    //         if (!grouped[monthYear]) {
    //             grouped[monthYear] = [];
    //         }
    //         grouped[monthYear].push(order);
    //     }
    //     return grouped;
    // }
    
    

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
                        [Posting Date], 
                        [Entry Date], 
                        [Quantity], 
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

             // Group the results by month and year
    // const groupedData = groupDatesByMonth(tableResults)

            // Fetch corresponding site incharge details only once per site
            const siteDetailsMap = {}; // To store site details to avoid duplicate queries

            // Fetch unique sites for the current table
            const uniqueSites = [...new Set(tableResults.map(order => order.Site))];

            for (const site of uniqueSites) {
                const siteQuery = `
                    SELECT 
                        [AREA INCHARGE],
                        [SITE INCHARGE],
                        [STATE PMO]
                    FROM [NewDatabase].[dbo].[site_area_incharge_mapping]
                    WHERE [SITE] = ?;
                `;
                
                const siteDetails = await connection.query(siteQuery, [site]);
                
                if (siteDetails.length > 0) {
                    siteDetailsMap[site] = siteDetails[0];
                }
            }

      // Append site details to the orders based on SITE
for (const order of tableResults) {
    if (order['Posting Date']) {
        order['Posting Date'] = excelDate(order['Posting Date']);
    }
    if (order['Entry Date']) {
        order['Entry Date'] = excelDate(order['Entry Date']);
    }
    if (order['Current Oil Change Date']) {
        order['Current Oil Change Date'] = excelDate(order['Current Oil Change Date']);
    }
                
                const siteDetails = siteDetailsMap[order.Site];
                if (siteDetails) {
                    order['AREA INCHARGE'] = siteDetails['AREA INCHARGE'];
                    order['SITE INCHARGE'] = siteDetails['SITE INCHARGE'];
                    order['STATE PMO'] = siteDetails['STATE PMO'];
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

        // New query for Pending Teco Orders
        const pendingTecoOrdersTables = [
            'gb_oil_change_all_orders', 
            'PD_OIL_CHG_ORDER_all_orders', 
            'YD_OIL_CHG_ORDER_all_orders', 
            'fc_oil_change_all_orders', 
            'dispute_all_orders'
        ];

        let pendingTecoResults = [];

        for (const table of pendingTecoOrdersTables) {
            let offset = 0; // Reset offset for each table
            let moreData = true;

            console.log(`Processing Pending Teco table: ${table}`);

            while (moreData) {
                const pendingTecoQuery = `
                    SELECT 
                        [Posting Date], 
                        [Entry Date], 
                        [Quantity], 
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
                    WHERE [Order Status] IN ('Released', 'In Process')
                    AND [Posting Date] >= ?
                    AND [Posting Date] <= ?
                    AND [date_of_insertion] = ?
                    ORDER BY [id]
                    OFFSET ? ROWS
                    FETCH NEXT ? ROWS ONLY;
                `;

                const result = await connection.query(pendingTecoQuery, [startDate, endDate, currentDate, offset, 2000]);

                if (result.length > 0) {
                    pendingTecoResults = pendingTecoResults.concat(result);
                    offset += 2000;
                } else {
                    moreData = false;
                }
            }
        }

        // Fetch corresponding site incharge details for Pending Teco orders
        const pendingTecoSiteDetailsMap = {}; // To store site details to avoid duplicate queries
        const uniquePendingTecoSites = [...new Set(pendingTecoResults.map(order => order.Site))];

        for (const site of uniquePendingTecoSites) {
            const siteQuery = `
                SELECT 
                    [AREA INCHARGE],
                    [SITE INCHARGE],
                    [STATE PMO]
                FROM [NewDatabase].[dbo].[site_area_incharge_mapping]
                WHERE [SITE] = ?;
            `;
            
            const siteDetails = await connection.query(siteQuery, [site]);
            
            if (siteDetails.length > 0) {
                pendingTecoSiteDetailsMap[site] = siteDetails[0];
            }
        }

        // Append site details to the pending teco orders based on SITE
        for (const order of pendingTecoResults) {
            const siteDetails = pendingTecoSiteDetailsMap[order.Site];
            if (siteDetails) {
                order['AREA INCHARGE'] = siteDetails['AREA INCHARGE'];
                order['SITE INCHARGE'] = siteDetails['SITE INCHARGE'];
                order['STATE PMO'] = siteDetails['STATE PMO'];
            }
        }

        // Append the Pending Teco sheet
        if (pendingTecoResults.length > 0) {
            console.log(`Appending Pending Teco sheet with ${pendingTecoResults.length} rows`);
            const pendingTecoWorksheet = xlsx.utils.json_to_sheet(pendingTecoResults);
            xlsx.utils.book_append_sheet(workbook, pendingTecoWorksheet, 'Pending Teco');
        } else {
            console.log('No Pending Teco data found');
        }

        // Save the workbook to a file
        const filePath = './PendingOrders.xlsx';
        xlsx.writeFile(workbook, filePath);

        // Return file as response
        res.download(filePath, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).json({ error: 'Failed to download the file.' });
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
