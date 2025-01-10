const express = require('express');
const moment = require('moment-timezone'); // For working with IST timezone
// const { connectToDatabase } = require('./connect.js');
const { connectToDatabase } = require('./connect6.js');
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
router.post('/', async (req, res) => {
    const data = req.body; // Retrieve the JSON data sent in the request body

    // Log the incoming data to the console for verification
    console.log('Received heartbeat data:', data);

    // Extract entryTime and exitTime from the incoming data
    const { entryTime, exitTime, domain_id, pathname, name } = data;

    if (!entryTime || !exitTime || !domain_id || !pathname || !name) {
        return res.status(400).json({ message: 'Missing required fields in the request body' });
    }

    // Convert entryTime and exitTime to IST timezone and then to ISO 8601 format (with 'Z' for UTC)
    const startDateTimeIST = moment(entryTime).tz('Asia/Kolkata').toISOString();  // Converts to '2025-01-07T15:07:13.000+05:30'
    const endDateTimeIST = moment(exitTime).tz('Asia/Kolkata').toISOString();    // Converts to '2025-01-07T15:07:13.000+05:30'

    // Log the IST formatted date times for verification
    console.log('Start DateTime in IST format:', startDateTimeIST);
    console.log('End DateTime in IST format:', endDateTimeIST);

    // Create the necessary data format for the API request
    const payload = [
        {
            "AppID": "LUBRICATION_PORTAL",
            "ApplicationType": "web",
            "CustEmail": "", 
            "CustID": "",
            "CustName": "",
            "CustomData": "",
            "DeviceID": "3385f58ecd5b7dbd",
            "EndDateTime": endDateTimeIST,  // Use IST formatted EndDateTime
            "Password": "Suzlon@123",
            "UserID": domain_id,
            "ScreenName": pathname,
            "StartDateTime": startDateTimeIST,  // Use IST formatted StartDateTime
            "UserEngagementID": 0,
            "UserName": name
        }
    ];

    // Log the data to be sent to the API
    console.log('Data to be sent to API:', payload);

    try {
        // Send POST request to the external API
        const response = await fetch('https://suzomsapps.suzlon.com/Services/UserEngagement/api/UserEngagement', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // Get the response from the API
        const apiResponse = await response.json();

        // Log the response for debugging
        console.log('API Response:', apiResponse);

        // Write both the sent data and API response to 'user_engagement.json'
        const userEngagementData = {
            sentData: payload,
            apiResponse: apiResponse
        };

        fs.writeFile('user_engagement.json', JSON.stringify(userEngagementData, null, 2), (err) => {
            if (err) {
                console.error('Error writing to file:', err);
                return res.status(500).json({ message: 'Error writing to file' });
            }
            
            console.log('User engagement data saved to user_engagement.json');
            return res.status(200).json({ message: 'User engagement data received and saved' });
        });

    } catch (err) {
        console.error('Error during API request:', err);
        return res.status(500).json({ message: 'Error during API request' });
    }
});

// Export the router
module.exports = router;
