const express = require('express');
const fs = require('fs'); // For file operations
const moment = require('moment-timezone'); // For handling timezones
//const { connectToDatabase } = require('./connect5.js'); // Your database connection module
const { connectToDatabase } = require('./connect6.js');
const router = express.Router(); // Define the router

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

// Logout admin route
router.post('/', async (req, res) => {
    const { adminId, userId } = req.body; // Retrieve adminId and userId from the POST request body

    // Database and JSON file operations
    const connection = await connectToDatabase(); // Establish database connection

    try {
        // Fetch `name` from `admins` table using the `adminId`
        const adminQuery = `
            SELECT name 
            FROM admins 
            WHERE id = ?`;
        const adminResult = await connection.query(adminQuery, [adminId]);

        if (adminResult.length === 0) {
            return res.status(404).json({ message: 'Admin ID not found in admins table' });
        }

        const adminName = adminResult[0].name;

        // Update `login` table: Set `id` to NULL for the retrieved `name`
        const updateLoginQuery = `
            UPDATE login 
            SET id = NULL 
            WHERE name = ?`;
        await connection.query(updateLoginQuery, [adminName]);

        // Update `admins` table: Set `id` to NULL for the retrieved `name`
        const updateAdminsQuery = `
            UPDATE admins 
            SET id = NULL 
            WHERE name = ?`;
        await connection.query(updateAdminsQuery, [adminName]);

        // Write data to JSON file
        const filePath = './id_retrieved_for_admin_logout.json';
        const data = {
            adminId: adminId || 'Not provided',
            userId: userId || 'Not provided',
            adminName: adminName,
            timestamp: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'), // Add timestamp for tracking
        };

        fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
            if (err) {
                console.error('Error writing to file:', err);
                return res.status(500).json({ message: 'Failed to write data to file', error: err.message });
            }

            console.log('IDs and name successfully written to file:', data);
        });

        res.status(200).json({
            message: 'Admin logout handled successfully',
            data,
        });
    } catch (error) {
        console.error('Error handling logout:', error);
        res.status(500).json({ message: 'Error handling logout', error: error.message });
    } finally {
        await connection.close(); // Close database connection
    }
});

// Export the router
module.exports = router;
