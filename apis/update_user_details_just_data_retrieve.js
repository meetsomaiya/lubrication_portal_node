const express = require('express');
const fs = require('fs');  // To write to a file
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

// Handle POST request to update user details
router.post('/', (req, res) => {
    // Retrieve the data sent from frontend
    const { domainId, name, access, state, area, site } = req.body;

    // Log the data to the console
    console.log('Received Data:', {
        domainId,
        name,
        access,
        state,
        area,
        site
    });

    // Write the received data into a JSON file for verification
    const dataToWrite = {
        domainId,
        name,
        access,
        state,
        area,
        site,
        timestamp: new Date().toISOString()  // Add timestamp for when data was received
    };

    // Ensure the data is written to the file
    fs.writeFile('./updat_data_retireved_on_backend.json', JSON.stringify(dataToWrite, null, 2), (err) => {
        if (err) {
            console.error('Error writing to file', err);
            return res.status(500).json({ message: 'Error writing to file' });
        }
        // Respond back that the data has been saved successfully
        res.status(200).json({ message: 'Data received and saved successfully' });
    });
});

// Export the router
module.exports = router;
