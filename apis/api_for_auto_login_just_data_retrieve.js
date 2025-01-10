const express = require('express');
const fs = require('fs'); // For file operations
const moment = require('moment-timezone'); // For handling timezones
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

// API for auto login
router.post('/', (req, res) => {
    try {
        // Retrieve the domain_id from the request body
        const { domain_id } = req.body;

        // Check if domain_id is provided
        if (!domain_id) {
            return res.status(400).json({ error: 'domain_id is required' });
        }

        // Prepare data to write into the JSON file
        const dataToWrite = {
            domain_id: domain_id,
            timestamp: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
        };

        // Write the data to a JSON file
        fs.writeFile('api_for_auto_login.json', JSON.stringify(dataToWrite, null, 2), (err) => {
            if (err) {
                console.error('Error writing to file:', err);
                return res.status(500).json({ error: 'Error saving data to file' });
            }
            console.log('Data saved to api_for_auto_login.json');
            return res.status(200).json({ message: 'Auto login data saved successfully' });
        });

    } catch (error) {
        console.error('Error in api_for_auto_login:', error);
        return res.status(500).json({ error: 'An error occurred' });
    }
});

// Export the router
module.exports = router;
