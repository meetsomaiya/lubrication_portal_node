const express = require('express');
const fs = require('fs'); // For file operations
const moment = require('moment-timezone'); // For handling timezones
const router = express.Router(); // Define the router
const fetch = require('node-fetch'); // Assuming you're using node-fetch for the API request
const Buffer = require('buffer').Buffer; // To use Buffer for base64 encoding

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
router.post('/', async (req, res) => {
    try {
        // Retrieve the domain_id from the request body
        const { domain_id } = req.body;

        // Check if domain_id is provided
        if (!domain_id) {
            return res.status(400).json({ error: 'domain_id is required' });
        }

        // Base64 encode the domain_id
        const encodedDomainId = Buffer.from(domain_id).toString('base64');

        // Log the domain_id (Base64 encoded)
        console.log('Received Domain ID:', domain_id);
        console.log('Base64 Encoded Domain ID:', encodedDomainId);

        // Save the domainId and sessionId to the JSON file
        const userData = {
            domainId: encodedDomainId, // Store the Base64 encoded domain ID
            sessionId: 'a', // Fixed password
        };

        // Write to the first JSON file (api_for_auto_login.json)
        fs.writeFile('api_for_auto_login.json', JSON.stringify(userData, null, 2), (err) => {
            if (err) {
                console.error('Error writing to file:', err);
                return res.status(500).json({ error: 'Error saving data to file' });
            }
            console.log('Data saved to api_for_auto_login.json');
        });

        // Prepare the data to send to the Fleet Manager API
        const postData = JSON.stringify({
            domainId: encodedDomainId,  // Using Base64 encoded 'domain_id'
            password: 'a',  // Fixed password
        });

        // Log the data being sent to the Fleet Manager API
        console.log('Sending data to Fleet Manager API:', postData);

        // Send the request to the Fleet Manager API using fetch
        const apiUrl = 'https://suzomsapps.suzlon.com/Services/SuzlonActiveUser/api/SuzlonActiveUser/IsUserActive';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData), // Ensure proper content-length
            },
            body: postData,
        });

        // Check if the response is ok
        if (!response.ok) {
            console.error('Error in Fleet Manager API request:', response.status);
            return res.status(response.status).json({ error: 'Error from Fleet Manager API' });
        }

        // Get the response data
        const responseData = await response.json();

        // Log the response from the Fleet Manager API
        console.log('Response from Fleet Manager API:', responseData);

        // Write the response data to the JSON file (fleet_manager_api_response.json)
        fs.writeFile('fleet_manager_api_response.json', JSON.stringify(responseData, null, 2), (err) => {
            if (err) {
                console.error('Error writing to fleet_manager_api_response.json:', err);
                return res.status(500).json({ error: 'Error saving data to response file' });
            }
            console.log('Response data saved to fleet_manager_api_response.json');
        });

        // Send the response back to the client
        return res.status(200).json({
            message: 'Response from Fleet Manager API saved successfully',
            data: responseData,
        });

    } catch (error) {
        console.error('Error in API request:', error);
        return res.status(500).json({ error: 'An error occurred while sending the request' });
    }
});

// Export the router
module.exports = router;
