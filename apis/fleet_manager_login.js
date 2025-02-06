const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const moment = require('moment-timezone');
const { connectToMSSQL } = require('./connect7.js');
const { v4: uuidv4 } = require('uuid');

router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '3600');
    next();
});

router.use(express.json());

router.post('/', async (req, res) => {
    const { name, domainId } = req.body;

    if (!name || !domainId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Fetch user details from login table
        const userQuery = `SELECT name, email, access, id FROM login WHERE domain_id = '${domainId}'`;
        console.log('Executing SQL Query:', userQuery);
        const userResult = await connectToMSSQL(userQuery);

        if (!userResult || userResult.length === 0) {
            return res.status(404).json({ error: 'User not found for this domain' });
        }

        const { id: userId, access, email, name: fetchedName } = userResult[0];

        // Generate a random session ID
        const sessionId = uuidv4();

        // Get current IST time
        const istTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

        // Update login table
        const updateLoginQuery = `UPDATE login SET id = '${sessionId}', last_login_time = '${istTime}' WHERE domain_id = '${domainId}'`;
        console.log('Executing SQL Query:', updateLoginQuery);
        await connectToMSSQL(updateLoginQuery);

        // Update admins table
        const updateAdminsQuery = `UPDATE admins SET name = '${fetchedName}', email = '${email}', id = '${sessionId}' WHERE domain_id = '${domainId}'`;
        console.log('Executing SQL Query:', updateAdminsQuery);
        await connectToMSSQL(updateAdminsQuery);

        // Prepare response data
        const responseData = {
            name: fetchedName,
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
    }
});

module.exports = router;
