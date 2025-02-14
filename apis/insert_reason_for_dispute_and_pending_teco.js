const express = require('express');
const moment = require('moment-timezone');
const { connectToMSSQL, sql } = require('./connect8.js'); // Use the updated connection function
const router = express.Router();

moment.tz.setDefault('Asia/Kolkata');

router.use(express.json());

// CORS Middleware
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '3600');
    next();
});

router.post('/', async (req, res) => {
    const { orderNo, reason, domain_id, name } = req.body;

    if (!orderNo || !reason || !domain_id || !name) {
        return res.status(400).json({ error: 'Invalid or incomplete data received' });
    }

    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    let pool;

    try {
        pool = await connectToMSSQL(); // Get DB connection pool

        // **Check if the reason already exists for the order number (EXCLUDING domain_id)**
        const checkQuery = `
            SELECT COUNT(*) AS count
            FROM [dbo].[reason_for_dispute_and_pending_teco]
            WHERE [Order No] = @orderNo AND [Reason] = @reason
        `;

        const checkResult = await pool.request()
            .input('orderNo', sql.NVarChar, orderNo)
            .input('reason', sql.NVarChar, reason)
            .query(checkQuery);

        if (checkResult.recordset[0].count > 0) {
            return res.status(400).json({ error: 'Reason already exists for this order number' });
        }

        // **Insert if not exists**
        const insertQuery = `
            INSERT INTO [dbo].[reason_for_dispute_and_pending_teco] 
            ([Order No], [Reason], [domain_id], [name], [date_of_insertion])
            VALUES (@orderNo, @reason, @domain_id, @name, @timestamp)
        `;

        await pool.request()
            .input('orderNo', sql.NVarChar, orderNo)
            .input('reason', sql.NVarChar, reason)
            .input('domain_id', sql.NVarChar, domain_id)
            .input('name', sql.NVarChar, name)
            .input('timestamp', sql.DateTime, timestamp)
            .query(insertQuery);

        res.status(200).json({
            message: 'Data successfully inserted into the database',
            writtenData: { orderNo, reason, domain_id, name, timestamp },
        });

    } catch (error) {
        console.error('❌ Error processing request:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (pool) {
            pool.close(); // Close the DB connection after processing
        }
    }
});

module.exports = router;
