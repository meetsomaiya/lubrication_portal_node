const express = require('express');
const fs = require('fs'); // For file operations
const moment = require('moment-timezone'); // For handling timezones
const router = express.Router(); // Define the router
const fetch = require('node-fetch'); // Assuming you're using node-fetch for the API request
//const { connectToDatabase } = require('./connect5.js'); // Database connection module
const { connectToDatabase } = require('./connect6.js');
const crypto = require('crypto'); // For generating random session ID
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

        console.log('Received Domain ID:', domain_id);
        console.log('Base64 Encoded Domain ID:', encodedDomainId);

        // Prepare the data to send to the Fleet Manager API
        const postData = JSON.stringify({
            domainId: encodedDomainId, // Using Base64 encoded 'domain_id'
            password: 'a', // Fixed password
        });

        console.log('Sending data to Fleet Manager API:', postData);

        // Send the request to the Fleet Manager API using fetch
        // const apiUrl = 'https://suzomsapps.suzlon.com/Services/SuzlonActiveUser/api/SuzlonActiveUser/IsUserActive';
        const apiUrl = 'https://suzomsuatapps.suzlon.com:7003/Services/SuzlonActiveUser/api/SuzlonActiveUser/IsUserActive/';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: postData,
        });

        if (!response.ok) {
            console.error('Error in Fleet Manager API request:', response.status);
            return res.status(response.status).json({ error: 'Error from Fleet Manager API' });
        }

        // Parse the response from the Fleet Manager API
        const apiResponse = await response.json();
        console.log('Response from Fleet Manager API:', apiResponse);

        // Generate a random session ID
        const sessionId = crypto.randomBytes(16).toString('hex');

        // Get the current time in IST
        const lastLoginTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

        // Connect to the database
        const dbConnection = await connectToDatabase();

        // Update the login table
        const updateQuery = `
            UPDATE login
            SET 
                id = ?, 
                name = ?, 
                email = ?, 
                last_login_time = ?
            WHERE 
                domain_id = ?;
        `;

        await dbConnection.query(updateQuery, [
            sessionId,
            apiResponse.Name,
            apiResponse.EmailId,
            lastLoginTime,
            domain_id,
        ]);

        // Query additional fields
        const selectQuery = `
        SELECT state, area, site, access 
        FROM login
        WHERE domain_id = ?;
        `;
        const result = await dbConnection.query(selectQuery, [domain_id]);

        if (!result.length) {
            return res.status(404).json({ error: 'Domain ID not found in login table' });
        }

        const { state, area, site, access } = result[0];

        // Close the database connection
        await dbConnection.close();

        // Prepare the final response data
        const finalResponse = {
            id: sessionId,            // From generated session ID
            domain_id,                // Original domain_id from request
            name: apiResponse.Name,   // From Fleet Manager API response
            email: apiResponse.EmailId, // From Fleet Manager API response
            state,                    // From database query result
            area,                     // From database query result
            site,                     // From database query result
            access                    // From database query result
        };

        // Write the response to a JSON file
        fs.writeFile('auto_login_api_response.json', JSON.stringify(finalResponse, null, 2), (err) => {
            if (err) {
                console.error('Error writing to file:', err);
            } else {
                console.log('Response saved to auto_login_api_response.json');
            }
        });

        // Send the final response back to the client
        return res.status(200).json(finalResponse);

    } catch (error) {
        console.error('Error in API request:', error);
        return res.status(500).json({ error: 'An error occurred while processing the request' });
    }
});

// Export the router
module.exports = router;
