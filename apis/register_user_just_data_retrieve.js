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
router.post('/', (req, res) => {
    const { domainId, state, area, site, access } = req.body;

    // Prepare the data to be saved in register_user.json
    const dataToSave = {
        domainId,
        state,
        area,
        site,
        access
    };

    // Log the data to the console (for verification)
    console.log('Data received:', dataToSave);

    // Write the data to register_user.json file
    fs.writeFileSync('./register_user.json', JSON.stringify(dataToSave, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('Error writing to file', err);
            return res.status(500).send('Internal Server Error');
        }
    });

    // Send a success response back to the client
    res.status(200).json({
        message: 'User registered successfully!',
        data: dataToSave
    });
});

// Export the router
module.exports = router;
