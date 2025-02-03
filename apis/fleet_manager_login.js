const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const moment = require('moment-timezone'); // Added moment-timezone
const { connectToDatabase } = require('./connect6.js');
const { v4: uuidv4 } = require('uuid'); // For generating session ID

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

// API Endpoint to process login
router.post('/', async (req, res) => {
    const { name, domainId } = req.body;

    // Validate received data
    if (!name || !domainId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    let connection;
    try {
        // Connect to database
        connection = await connectToDatabase();

        // Retrieve user details including email
        const userQuery = `SELECT access,email, id FROM login WHERE domain_id = ?`;
        console.log('Executing SQL Query:', userQuery.replace('?', `"${domainId}"`)); // Log SQL query
        const userResult = await connection.query(userQuery, [domainId]);

        if (userResult.length === 0) {
            return res.status(404).json({ error: 'User not found for this domain' });
        }

        const { id: userId, access, email } = userResult[0];

        // Generate a random session ID
        const sessionId = uuidv4();

        // Get current IST time
        const istTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

        // Update login table with session ID and last login time
        const updateQuery = `UPDATE login SET id = ?, last_login_time = ? WHERE domain_id = ?`;
        console.log('Executing SQL Query:', updateQuery.replace('?', `"${sessionId}"`).replace('?', `"${istTime}"`).replace('?', `"${userId}"`)); // Log SQL query
        await connection.query(updateQuery, [sessionId, istTime, domainId]);

        // Prepare response data including access, email, and last login time
        const responseData = {
            name,
            domainId,
            email,
            sessionId,
            access,
            lastLoginTime: istTime,
            timestamp: new Date().toISOString(),
        };

        // Write response data to JSON file
        const filePath = path.join(__dirname, 'fleet-manager-admin_login_api.json');
        fs.writeFile(filePath, JSON.stringify(responseData, null, 2), (err) => {
            if (err) console.error('Error writing file:', err);
        });

        console.log('Response sent:', responseData);
        res.json({ success: true, message: 'Login successful', data: responseData });

    } catch (error) {
        console.error('Error processing login:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (connection) {
            await connection.close(); // Close DB connection
        }
    }
});

// Export the router
module.exports = router;
