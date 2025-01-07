const express = require('express');
const fs = require('fs');
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

router.get('/', async (req, res) => {
    const financialYear = req.query.financialYear || '';

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

    const CHUNK_SIZE = 2000;
    const results = [];
    const db = await connectToDatabase();

    try {
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
                        [Posting Date] BETWEEN ? AND ?
                    ORDER BY id
                    OFFSET ? ROWS
                    FETCH NEXT ? ROWS ONLY;
                `;

                const rows = await db.query(query, [currentDate, startDate, endDate, offset, CHUNK_SIZE]);
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
            aggregatedRow.Issue += row.Issue || 0;
            aggregatedRow.Return += row.Return || 0;
        });

        consolidatedData.push(...dataMap.values());

        // Create Excel file
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Consolidated Data');

        // Add headers
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
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
            { header: 'Area Incharge', key: 'Area Incharge', width: 20 },
            { header: 'State PMO', key: 'State PMO', width: 15 },
            { header: 'Order Status', key: 'Order Status', width: 15 },
        ];

        // Add rows to worksheet
        consolidatedData.forEach(row => {
            worksheet.addRow(row);
        });

        // Send Excel file as a downloadable response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=consolidated_data_sent_back.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error fetching data:', error);
        return res.status(500).json({ error: 'Failed to fetch data.' });
    } finally {
        await db.close();
    }
});


module.exports = router;
