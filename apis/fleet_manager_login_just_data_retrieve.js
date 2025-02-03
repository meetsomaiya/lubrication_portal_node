const express = require('express');
const fs = require('fs');
const path = require('path');
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

// API Endpoint to receive and store data
router.post('/', (req, res) => {
    const { name, domainId } = req.body;

    // Validate received data
    if (!name || !domainId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Prepare data object
    const loginData = {
        name,
        domainId,
        timestamp: new Date().toISOString() // Add timestamp for tracking
    };

    // Define file path
    const filePath = path.join(__dirname, 'admin-auto_login.json');

    // Write data to JSON file
    fs.writeFile(filePath, JSON.stringify(loginData, null, 2), (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return res.status(500).json({ error: 'Failed to save login data' });
        }
        console.log('Login data saved successfully:', loginData);
        res.json({ success: true, message: 'Login data stored successfully', data: loginData });
    });
});

// Export the router
module.exports = router;
