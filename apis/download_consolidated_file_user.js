const express = require('express');
const fs = require('fs');
//const { connectToDatabase } = require('./connect4.js'); // Your database connection module
const { connectToDatabase } = require('./connect6.js');
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

    return date;
};

router.get('/', async (req, res) => {
    const financialYear = req.query.financialYear || '';
    const state = req.query.state || '';


    if (!financialYear) {
        return res.status(400).json({ error: 'Financial year is required' });
    }

    const matches = financialYear.match(/FY (\d{4})-(\d{4})/);
    if (!matches) {
        return res.status(400).json({ error: 'Invalid financial year format. Use "FY YYYY-YYYY".' });
    }

    const startYear = matches[1];
    const endYear = matches[2];
    const startDate = `${startYear}-03-31`;
    const endDate = `${endYear}-04-01`;
    const currentDate = new Date().toISOString().split('T')[0];

    const tables = [
        'gb_oil_change_all_orders',
        'gb_topup_all_orders',
        'PD_OIL_CHG_ORDER_all_orders',
        'YD_OIL_CHG_ORDER_all_orders',
        'ydpd_topup_all_orders',
        'fc_topup_all_orders',
        'fc_oil_change_all_orders',
        'dispute_all_orders'
    ];

    const CHUNK_SIZE = 10;
    const results = [];
    const db = await connectToDatabase();

    try {
        // Fetch site-related details once per site
        const siteDetailsMap = new Map();

        // Fetch site details for all sites once
        const siteDetailsQuery = `
            SELECT [Site], [STATE ENGG HEAD], [AREA INCHARGE], [SITE INCHARGE], [STATE PMO]
            FROM [site_area_incharge_mapping]
        `;
        const siteDetailsRows = await db.query(siteDetailsQuery);
        siteDetailsRows.forEach(row => {
            siteDetailsMap.set(row.Site, {
                STATE_ENGG_HEAD: row['STATE ENGG HEAD'],
                AREA_INCHARGE: row['AREA INCHARGE'],
                SITE_INCHARGE: row['SITE INCHARGE'],
                STATE_PMO: row['STATE PMO'],
            });
        });

        for (const table of tables) {
            let offset = 0;
            let hasMoreRows = true;

            while (hasMoreRows) {
                const query = `
                  SELECT 
                      [id],
                      [Quantity],
                      [Posting Date],
                      [Entry Date],
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
                      CASE 
                          WHEN [Order Type] IS NULL OR [Order Type] = '' THEN [Order]
                          ELSE [Order Type]
                      END AS [Order Type],
                      [Component],
                      [WTG Model],
                      [Order],
                      [Current Oil Change Date],
                      [Area Incharge],
                      [State PMO],
                      [Order Status]
                  FROM ${table}
                  WHERE 
                      [date_of_insertion] = ? AND 
                      [Posting Date] BETWEEN ? AND ? AND
                      [State] = ?
                  ORDER BY id
                  OFFSET ? ROWS
                  FETCH NEXT ? ROWS ONLY;
                `;

                const rows = await db.query(query, [currentDate, startDate, endDate, state, offset, CHUNK_SIZE]);
                if (rows.length === 0) {
                    hasMoreRows = false;
                } else {
                    results.push(...rows);
                    offset += CHUNK_SIZE;
                }
            }
        }

        // Consolidate Issue and Return values by Order No and Material
        const consolidatedData = [];
        const dataMap = new Map();

        results.forEach(row => {
            const key = `${row['Order No']}|${row['Material']}`;
            if (!dataMap.has(key)) {
                dataMap.set(key, { ...row, Issue: 0, Return: 0 });
            }
            const aggregatedRow = dataMap.get(key);

            // Convert Issue and Return values to numbers (if not NaN) and add them
            const issueValue = parseFloat(row.Issue);
            const returnValue = parseFloat(row.Return);

            // Only add if they are valid numbers (NaN check)
            if (!isNaN(issueValue)) aggregatedRow.Issue += issueValue;
            if (!isNaN(returnValue)) aggregatedRow.Return += returnValue;
        });

        consolidatedData.push(...dataMap.values());

        // Add the Site Incharge details for each order, fetched only once per site
        consolidatedData.forEach(row => {
            const site = row.Site;
            if (site && siteDetailsMap.has(site)) {
                const siteDetails = siteDetailsMap.get(site);
                row.STATE_ENGG_HEAD = siteDetails.STATE_ENGG_HEAD;
                row.AREA_INCHARGE = siteDetails.AREA_INCHARGE;
                row.SITE_INCHARGE = siteDetails.SITE_INCHARGE;
                row.STATE_PMO = siteDetails.STATE_PMO;
            }
        
            // Convert relevant dates to Excel serial format
            row['Posting Date'] = excelDate(row['Posting Date']);
            row['Entry Date'] = excelDate(row['Entry Date']);
            row['Current Oil Change Date'] = excelDate(row['Current Oil Change Date']);
        });
        

        // Create Excel file
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Consolidated Data');

        // Add headers
        worksheet.columns = [
            // { header: 'ID', key: 'id', width: 10 },
            { header: 'Quantity', key: 'Quantity', width: 15 },
            { header: 'Posting Date', key: 'Posting Date', width: 15 },
            { header: 'Entry Date', key: 'Entry Date', width: 15 },
            { header: 'Date of Insertion', key: 'date_of_insertion', width: 15 },
            { header: 'Order No', key: 'Order No', width: 20 },
            { header: 'Function Loc', key: 'Function Loc', width: 20 },
            { header: 'Issue', key: 'Issue', width: 30 },
            { header: 'Return', key: 'Return', width: 15 },
            { header: 'Return Percentage', key: 'Return Percentage', width: 20 },
            { header: 'Plant', key: 'Plant', width: 15 },
            { header: 'State', key: 'State', width: 15 },
            { header: 'Area', key: 'Area', width: 15 },
            { header: 'Site', key: 'Site', width: 15 },
            { header: 'Material', key: 'Material', width: 20 },
            { header: 'Storage Location', key: 'Storage Location', width: 20 },
            { header: 'Move Type', key: 'Move Type', width: 15 },
            { header: 'Material Document', key: 'Material Document', width: 20 },
            { header: 'Description', key: 'Description', width: 30 },
            { header: 'Val Type', key: 'Val Type', width: 15 },
            { header: 'Order Type', key: 'Order Type', width: 20 },
            { header: 'Component', key: 'Component', width: 20 },
            { header: 'WTG Model', key: 'WTG Model', width: 15 },
            { header: 'Order', key: 'Order', width: 15 },
            { header: 'Current Oil Change Date', key: 'Current Oil Change Date', width: 20 },
            // { header: 'Area Incharge', key: 'Area Incharge', width: 20 },
            // { header: 'State PMO', key: 'State PMO', width: 15 },
            { header: 'Order Status', key: 'Order Status', width: 15 },
            { header: 'STATE ENGG HEAD', key: 'STATE_ENGG_HEAD', width: 25 },
            { header: 'AREA INCHARGE', key: 'AREA_INCHARGE', width: 25 },
            { header: 'SITE INCHARGE', key: 'SITE_INCHARGE', width: 25 },
            { header: 'STATE PMO', key: 'STATE_PMO', width: 25 }
        ];

        // Add rows
        worksheet.addRows(consolidatedData);

        // Send Excel file as response
        const filePath = 'output.xlsx';
        await workbook.xlsx.writeFile(filePath);
        res.download(filePath, 'ConsolidatedData.xlsx', (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error downloading the file.');
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error processing the request.');
    }
});

module.exports = router;
