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

// API endpoint to handle delete requests
router.post('/', (req, res) => {
    const { domainId } = req.body; // Extract domain_id from the request body
    console.log('Received domainId:', domainId);

    // Write domainId to delete_admin.json
    const filePath = './delete_admin.json';
    const dataToWrite = { domainId };

    fs.writeFile(filePath, JSON.stringify(dataToWrite, null, 2), (err) => {
        if (err) {
            console.error('Error writing to file:', err);
            return res.status(500).json({ success: false, message: 'Failed to write to file' });
        }

        console.log('DomainId written to delete_admin.json');
        res.status(200).json({ success: true, message: 'DomainId logged successfully' });
    });
});

// Export the router
module.exports = router;
