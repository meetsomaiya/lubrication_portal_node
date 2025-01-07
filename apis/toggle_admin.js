const express = require('express');
const fs = require('fs'); // For file operations
const moment = require('moment-timezone'); // For handling timezones
const { connectToDatabase } = require('./connect5.js'); // Your database connection module
const router = express.Router(); // Define the router
const crypto = require('crypto'); // For generating random session IDs

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

// Route to handle adminId, name, email, update sessionId and fetch additional details
router.post('/', async (req, res) => {
    const { adminId, name, email } = req.body; // Retrieve adminId, name, and email from request body

    if (!adminId || !name || !email) {
        return res.status(400).json({ error: 'adminId, name, and email are required in the request body' });
    }

    try {
        const connection = await connectToDatabase(); // Connect to the database

        // Fetch domain_id from the admins table
        const adminQuery = `SELECT domain_id FROM admins WHERE id = ?`;
        const adminResult = await connection.query(adminQuery, [adminId]);

        if (adminResult.length === 0) {
            await connection.close();
            return res.status(404).json({ error: 'adminId not found in the admins table' });
        }

        const domainId = adminResult[0].domain_id;

        // Generate a random session ID
        const sessionId = crypto.randomBytes(16).toString('hex');

        // Decode the name (as it might be URL-encoded)
        const decodedName = decodeURIComponent(name);

        // Get the current date and time in Indian Standard Time (Asia/Kolkata)
        const lastLoginTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'); // Format: YYYY-MM-DD HH:mm:ss

        // Update sessionId, name, email, and last_login_time in the login table for the retrieved domain_id
        const updateQuery = `UPDATE login SET id = ?, name = ?, email = ?, last_login_time = ? WHERE domain_id = ?`;
        await connection.query(updateQuery, [sessionId, decodedName, email, lastLoginTime, domainId]);

        // Fetch additional details from the login table for the given domain_id
        const loginQuery = `SELECT domain_id, name, email, state, area, site, access, last_login_time FROM login WHERE domain_id = ?`;
        const loginDetails = await connection.query(loginQuery, [domainId]);

        if (loginDetails.length === 0) {
            await connection.close();
            return res.status(404).json({ error: 'No login details found for the given domain_id' });
        }

        const userDetails = loginDetails[0];

        // Close the database connection
        await connection.close();

        // Return the generated sessionId and user details
        return res.status(200).json({
            message: 'Session ID, name, email, and last login time updated successfully',
            sessionId,
            domainId: domainId,
            name: decodedName,
            email: userDetails.email,
            state: userDetails.state,
            area: userDetails.area,
            site: userDetails.site,
            access: userDetails.access,
            lastLoginTime: userDetails.last_login_time
        });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Export the router
module.exports = router;
