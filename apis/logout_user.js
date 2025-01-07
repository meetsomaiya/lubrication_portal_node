const express = require('express');
const fs = require('fs');
const router = express.Router();
const { connectToDatabase } = require('./connect5.js'); // Your database connection module

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

// Logout API endpoint
router.post('/', async (req, res) => {
    const { name, userId } = req.body; // Retrieve the data passed from the frontend

    if (!name || !userId) {
        return res.status(400).json({ error: 'Missing name or userId' });
    }

    try {
        const connection = await connectToDatabase(); // Connect to the database

        // 1. Update the `login` table
        const updateLoginQuery = `
            UPDATE login
            SET id = NULL
            WHERE name = ?;
        `;
        const loginResult = await connection.query(updateLoginQuery, [name]);

        // 2. Check and update the `admin` table
        const checkAdminQuery = `
            SELECT name FROM admins
            WHERE name = ?;
        `;
        const adminResult = await connection.query(checkAdminQuery, [name]);

        if (adminResult.length > 0) {
            const updateAdminQuery = `
                UPDATE admins
                SET id = NULL
                WHERE name = ?;
            `;
            await connection.query(updateAdminQuery, [name]);
        }

        // 3. Log the result to `logout_user.json`
        const logoutData = {
            name,
            userId,
            logoutTime: new Date().toISOString(),
            loginUpdate: loginResult,
            adminUpdate: adminResult.length > 0 ? 'Updated successfully' : 'Name not found in admin table',
        };

        fs.writeFileSync('logout_user.json', JSON.stringify(logoutData, null, 2));

        // Close the database connection
        await connection.close();

        res.status(200).json({ message: 'Logout process completed', data: logoutData });
    } catch (error) {
        console.error('Error handling logout:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export the router
module.exports = router;
