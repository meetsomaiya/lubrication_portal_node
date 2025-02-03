console.log('checkUser route module loaded');

const express = require('express');
const { connectToDatabase } = require('./connect6.js'); // Database connection
const crypto = require('crypto'); // For generating a random session ID
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

// Define the GET route for checkAdmin
router.get('/', async (req, res) => {
    const { DomainId, Name, EmailId } = req.query; // Retrieve DomainId, Name, and EmailId from query parameters

    if (!DomainId || !Name || !EmailId) {
        return res.status(400).json({ error: 'Missing required query parameters' });
    }

    // Prepare the data to be written into the JSON file
    const data = {
        DomainId,
        Name,
        EmailId,
        timestamp: moment().format() // Add a timestamp to the data
    };

    // Write the data into checkuserdataretreive.json
    fs.writeFile('checkuserdataretreive.json', JSON.stringify(data, null, 2), (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to write to file' });
        }

        res.status(200).json({ message: 'Data successfully written to checkuserdataretreive.json', data });
    });
});

module.exports = router;
