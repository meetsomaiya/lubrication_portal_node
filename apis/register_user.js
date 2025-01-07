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

// Handle POST request for registering a new user
router.post('/', async (req, res) => {
    const { domainId, state, area, site, access } = req.body;

    try {
        // Connect to the database
        const connection = await connectToDatabase();

        // Check if the domainId already exists in the login table
        const checkDomainQuery = `SELECT * FROM login WHERE domain_id = ?`;
        const existingUser = await connection.query(checkDomainQuery, [domainId]);

        // If domainId exists, prevent registration
        if (existingUser.length > 0) {
            return res.status(400).json({
                message: 'User with this domain_id already exists. Registration not allowed.',
            });
        }

        // Prepare the data to be inserted into the database
        const insertQuery = `
            INSERT INTO login (domain_id, state, area, site, access)
            VALUES (?, ?, ?, ?, ?)
        `;

        // Insert the data into the login table
        await connection.query(insertQuery, [domainId, state, area, site, access]);

        // Close the database connection
        await connection.close();

        // Log the data to a JSON file for verification (optional)
        const dataToSave = { domainId, state, area, site, access };
        fs.writeFileSync('./register_user.json', JSON.stringify(dataToSave, null, 2), 'utf8');

        // Send a success response
        res.status(200).json({
            message: 'User registered successfully!',
            data: dataToSave,
        });

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({
            message: 'Internal Server Error',
            error: err.message,
        });
    }
});

// Export the router
module.exports = router;
