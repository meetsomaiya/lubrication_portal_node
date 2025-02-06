const express = require('express');
const fs = require('fs');
const moment = require('moment-timezone');
const router = express.Router();
const fetch = require('node-fetch');
const { connectToDatabase } = require('./connect6.js');
const crypto = require('crypto');
const Buffer = require('buffer').Buffer;

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
// API for auto login (Changed from POST to GET)
router.get('/', async (req, res) => {
    try {
        const { domain_id } = req.query; // Retrieve domain_id from query parameters

        if (!domain_id) {
            return res.status(400).json({ error: 'domain_id is required' });
        }

        const encodedDomainId = Buffer.from(domain_id).toString('base64');

        console.log('Received Domain ID:', domain_id);
        console.log('Base64 Encoded Domain ID:', encodedDomainId);

        const postData = JSON.stringify({
            domainId: encodedDomainId,
            password: 'a' // Assuming this remains the same
        });

        console.log('Sending data to Fleet Manager API:', postData);

     //   const apiUrl = 'https://uat-mob.suzlon.com/SuzlonActiveUser/api/SuzlonActiveUser/IsUserActive';

     const apiUrl = 'https://suzomsuatapps.suzlon.com:7003/Services/SuzlonActiveUser/api/SuzlonActiveUser/IsUserActive/';
        
        // Perform API request
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: postData,
        });

        if (!response.ok) {
            console.error('Error in Fleet Manager API request:', response.status);
            return res.status(response.status).json({ error: 'Error from Fleet Manager API' });
        }

        const apiResponse = await response.json();
        console.log('Response from Fleet Manager API:', apiResponse);

        if (!apiResponse || !apiResponse.Name || !apiResponse.EmailId) {
            console.error('Invalid API response:', apiResponse);
            return res.status(400).json({ error: 'Invalid API response: Missing Name or Email' });
        }

        fs.writeFile('api_for_auto_login2.json', JSON.stringify(apiResponse, null, 2), (err) => {
            if (err) console.error('Error writing API response to file:', err);
        });

        const userName = apiResponse.Name;
        const userEmail = apiResponse.EmailId;
        const sessionId = crypto.randomBytes(16).toString('hex');

        const dbConnection = await connectToDatabase();

        // Update user details in login table
        const updateLoginQuery = `
            UPDATE login 
            SET name = CASE WHEN name != ? THEN ? ELSE name END, 
                email = CASE WHEN email != ? THEN ? ELSE email END
            WHERE domain_id = ?;
        `;
        await dbConnection.query(updateLoginQuery, [userName, userName, userEmail, userEmail, domain_id]);

        // Update user details in admins table
        const updateAdminQuery = `
            UPDATE admins 
            SET name = CASE WHEN name != ? THEN ? ELSE name END, 
                email = CASE WHEN email != ? THEN ? ELSE email END
            WHERE domain_id = ?;
        `;
        await dbConnection.query(updateAdminQuery, [userName, userName, userEmail, userEmail, domain_id]);

        // Fetch user details from login table
        const selectQuery = `
            SELECT name, state, area, site, access 
            FROM login
            WHERE domain_id = ?;
        `;
        const [userInfo] = await dbConnection.query(selectQuery, [domain_id]);

        if (!userInfo) {
            return res.status(404).json({ error: 'Domain ID not found in login table' });
        }

        // Check if the user is an admin
        const adminCheckQuery = `SELECT COUNT(*) AS count FROM admins WHERE domain_id = ?;`;
        const [adminResult] = await dbConnection.query(adminCheckQuery, [domain_id]);
        const isAdmin = adminResult.count > 0;

        await dbConnection.close();

        const finalResponse = {
            id: sessionId,
            domain_id,
            name: userInfo.name,
            email: userEmail,
            state: userInfo.state,
            area: userInfo.area,
            site: userInfo.site,
            access: userInfo.access,
            isadmin: isAdmin
        };

        fs.writeFile('auto_login_api_response.json', JSON.stringify(finalResponse, null, 2), (err) => {
            if (err) console.error('Error writing final response to file:', err);
        });

        return res.status(200).json(finalResponse);

    } catch (error) {
        console.error('Error in API request:', error);
        return res.status(500).json({ error: 'An error occurred while processing the request' });
    }
});


// Export the router
module.exports = router;
