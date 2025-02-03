const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
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

        // Retrieve admin ID
        const adminQuery = `SELECT id FROM login WHERE domain_id = ?`;
        console.log('Executing SQL Query:', adminQuery.replace('?', `"${domainId}"`)); // Log SQL query
        const adminResult = await connection.query(adminQuery, [domainId]);

        if (adminResult.length === 0) {
            return res.status(404).json({ error: 'Admin not found for this domain' });
        }

        const adminId = adminResult[0].id;

        // Generate a random session ID
        const sessionId = uuidv4();

        // Update login table with session ID
        const updateQuery = `UPDATE login SET id = ? WHERE domain_id = ?`;
        console.log('Executing SQL Query:', updateQuery.replace('?', `"${sessionId}"`).replace('?', `"${adminId}"`)); // Log SQL query
        await connection.query(updateQuery, [sessionId, domainId]);

        // Prepare response data
        const responseData = {
            name,
            domainId,
            sessionId,
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
