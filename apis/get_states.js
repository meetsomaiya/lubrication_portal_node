const express = require('express');
const fs = require('fs');
const path = require('path');
const { connectToDatabase } = require('./connect.js');

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

// Route to fetch distinct states
router.get('/', async (req, res) => {
    let connection;
    try {
        // Connect to the database
        connection = await connectToDatabase();

        // Query to fetch distinct states
        const query = 'SELECT DISTINCT State FROM installedbase'; // Adjust the column name based on your table schema
        const result = await connection.query(query);

        // Extract states from result
        const states = result.map(row => ({
            id: row.State, // Assuming the column name is "State"
            name: row.State // Modify if you want a different name or format
        }));

        // Write states to a JSON file
        const filePath = path.join(__dirname, './states_sent_back.json');
        fs.writeFileSync(filePath, JSON.stringify(states, null, 2), 'utf8');
        console.log('States written to states_sent_back.json');

        // Send the states as a response
        res.json(states);
    } catch (error) {
        console.error('Error fetching states:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        // Close the database connection if it was established
        if (connection) {
            await connection.close();
        }
    }
});

// Export the router
module.exports = router;
