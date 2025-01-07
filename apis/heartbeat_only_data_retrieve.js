const express = require('express');
const moment = require('moment-timezone'); // For working with IST timezone
const { connectToDatabase } = require('./connect.js');
const fetch = require('node-fetch'); // For HTTP requests
const fs = require('fs');
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

// Handle heartbeat request (post data to backend)
router.post('/', (req, res) => {
    const data = req.body; // Retrieve the JSON data sent in the request body

    // Log the incoming data to the console for verification
    console.log('Received heartbeat data:', data);

    // Create a timestamp for when the data was received
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss'); // Format in 'YYYY-MM-DD HH:mm:ss' (IST time)
    
    // Create the object with timestamp and received data
    const heartbeatData = {
        timestamp,
        ...data
    };

    // Write the data to 'heartbeat_user.json' file
    fs.writeFile('heartbeat.json', JSON.stringify(heartbeatData, null, 2), (err) => {
        if (err) {
            console.error('Error writing to file:', err);
            return res.status(500).json({ message: 'Error writing to file' });
        }
        
        console.log('Heartbeat data saved to heartbeat_user.json');
        return res.status(200).json({ message: 'Heartbeat data received and saved' });
    });
});

// Export the router
module.exports = router;
