const express = require('express');
const moment = require('moment-timezone');
const router = express.Router();
//const { connectToDatabase } = require('./connect3.js'); // Your database connection module
const { connectToDatabase } = require('./connect6.js');

moment.tz.setDefault('Asia/Kolkata');

// Set up middleware to parse JSON request bodies
router.use(express.json());

// Set up CORS middleware
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '3600');
    next();
});

// POST endpoint at the default route
router.post('/', async (req, res) => {
  const { orderNo, reason, domain_id, name } = req.body;

  try {
    // Check if required fields are present
    if (!orderNo || !reason || !domain_id || !name) {
      return res.status(400).json({ error: 'Invalid or incomplete data received' });
    }

    // Add a timestamp for tracking
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');

    // Connect to the database
    const connection = await connectToDatabase();

    // Check if the reason already exists for this order number
    // const checkQuery = `
    //   SELECT COUNT(*) AS count
    //   FROM [dbo].[reason_for_dispute_and_pending_teco]
    //   WHERE [Order No] = ? AND [Reason] = ? AND [domain_id] = ?`;

    const checkQuery = `
    SELECT COUNT(*) AS count
    FROM [dbo].[reason_for_dispute_and_pending_teco]
    WHERE [Order No] = ? AND [Reason] = ?`;

   // const checkResult = await connection.query(checkQuery, [orderNo, reason, domain_id]);

    const checkResult = await connection.query(checkQuery, [orderNo, reason]);

    if (checkResult[0].count > 0) {
      return res.status(400).json({ error: 'Reason already exists for this order number' });
    }

    // Insert the new reason into the database if it doesn't already exist
    const insertQuery = `
      INSERT INTO [dbo].[reason_for_dispute_and_pending_teco] ([Order No], [Reason], [domain_id], [name], [date_of_insertion])
      VALUES (?, ?, ?, ?, ?)`;

    const result = await connection.query(insertQuery, [orderNo, reason, domain_id, name, timestamp]);

    // Data to be returned in the response
    const dataToReturn = {
      timestamp,
      reasons: {
        orderNo,
        reason,
        domain_id,
        name,
      },
    };

    // Close the database connection
    await connection.close();

    // Respond to the client
    res.status(200).json({
      message: 'Data successfully inserted into the database',
      writtenData: dataToReturn,
    });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
