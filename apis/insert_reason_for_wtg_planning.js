const express = require('express');
const moment = require('moment-timezone'); // Import moment-timezone
const { connectToDatabase } = require('./connect4'); // Your database connection module

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

// Route to handle the reason submission
router.post('/', async (req, res) => {
    // Extract the data from the request body
    const { reason, orderNo, domainId, functionLoc, name } = req.body;

    if (!reason || !orderNo || !domainId || !functionLoc || !name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

        // Decode the name to handle the URL encoding
        const decodedName = decodeURIComponent(name);

    // Get the current timestamp in IST (Asia/Kolkata) and convert it to SQL-compatible datetime format
    const timestamp = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');  // Format to 'YYYY-MM-DD HH:mm:ss'

    try {
        // Connect to the database
        const dbConnection = await connectToDatabase();

        // Check if the reason already exists for the given functionLoc and orderNo
        const checkQuery = `
            SELECT COUNT(*) AS count
            FROM reason
            WHERE functional_location = ? AND order_number = ?
        `;
        const checkResult = await dbConnection.query(checkQuery, [functionLoc, orderNo]);

        // If a record with the same functional_location and order_number exists, return a response
        if (checkResult[0].count > 0) {
            return res.status(400).json({ error: 'Reason already exists for this functional location and order number' });
        }

        // If no record exists, insert the new reason data into the database
        const insertQuery = `
            INSERT INTO reason (domain_id, name, functional_location, order_number, reason, date)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const insertResult = await dbConnection.query(insertQuery, [
            domainId,  // domainId from request body
            decodedName,  // decoded name,      // name from request body
            functionLoc,  // functional_location
            orderNo,     // order_number
            reason,      // reason
            timestamp    // Proper datetime format
        ]);

        // Close the database connection
        await dbConnection.close();

        // Send success response
        res.status(200).json({ message: 'Reason added successfully', data: { reason, orderNo, domainId, functionLoc, name, timestamp } });
    } catch (err) {
        console.error('Error inserting reason:', err);
        res.status(500).json({ error: 'Failed to insert the reason. Please try again.' });
    }
});

module.exports = router;
