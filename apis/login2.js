const express = require('express');
const fs = require('fs');
const cors = require('cors');
const fetch = require('node-fetch');

const router = express.Router();

// Enable CORS for all origins
router.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware to parse JSON bodies
router.use(express.json());

router.post('/', async (req, res) => {
    const { domain_id, password } = req.body;

    // Validate incoming request body
    if (!domain_id || !password) {
        return res.status(400).json({ error: 'domain_id and password are required' });
    }

    // Log incoming request data
    const requestData = {
        domain_id: domain_id,
        password: password,
    };

    // Write incoming request data to a JSON file named 'request_data.json'
    try {
        fs.writeFileSync('request_data.json', JSON.stringify(requestData, null, 2));
    } catch (err) {
        console.error('Error writing request data to file:', err);
    }

    // API URL for user authentication
   // const apiUrl = "https://uat-mob.suzlon.com/SuzlonActiveUser/api/SuzlonActiveUser/IsUserActive";

//    const apiUrl = 'https://suzomsuatapps.suzlon.com:7003/Services/SuzlonActiveUser/api/SuzlonActiveUser/IsUserActive/';

const apiUrl = 'https://suzomsapps.suzlon.com/Services/SuzlonActiveUser/api/SuzlonActiveUser/IsUserActive';

    // Encode domain ID using base64 for API request
    const encodedDomainId = Buffer.from(domain_id).toString('base64');

    // Prepare API data for the request
    const apiData = {
        domainId: encodedDomainId,
        password: password,
    };

    try {
        // Send the HTTP request and get the API response
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(apiData),
        });

        // Check if the response is OK (status 200-299)
        if (!apiResponse.ok) {
            throw new Error(`API responded with status ${apiResponse.status}`);
        }

        // Parse the API response as JSON
        const responseData = await apiResponse.json();

        // Write API response to JSON file
        try {
            fs.writeFileSync('api_response.json', JSON.stringify(responseData, null, 2));
        } catch (err) {
            console.error('Error writing API response to file:', err);
            return res.status(500).json({ error: 'Error writing API response to file' });
        }

        // Echo the full API response back to the frontend
        res.json(responseData);
    } catch (error) {
        console.error('Error occurred:', error);  // Log the error details
        // Handle errors and throw the actual error back
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

module.exports = router;
