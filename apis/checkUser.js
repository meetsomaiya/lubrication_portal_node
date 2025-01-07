console.log('checkAdmin route module loaded');

const express = require('express');
const { connectToDatabase } = require('./connect5.js');
const crypto = require('crypto'); // For generating a random session ID
const fs = require('fs'); // For file operations
const moment = require('moment-timezone'); // For handling timezones

const router = express.Router(); // Define the router

// Set up CORS middleware
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '3600');
    next();
});

// Define the GET route for checkAdmin
router.get('/', async (req, res) => {
    const { DomainId, Name, EmailId } = req.query; // Retrieve DomainId, Name, and EmailId from query parameters

    // Validate the incoming data
    if (!DomainId || !Name || !EmailId) {
        return res.status(400).json({ message: 'DomainId, Name, and EmailId are required.' });
    }

    // Decode the name if it is encoded
    const decodedName = decodeURIComponent(Name);

    // Log the retrieved DomainId, decoded Name, and EmailId
    console.log('Retrieved DomainId:', DomainId);
    console.log('Decoded Name:', decodedName);
    console.log('EmailId:', EmailId);

    try {
        const connection = await connectToDatabase();

        // SQL query to fetch user details for the specified domain_id
        const query = `
            SELECT [id], [domain_id], [name], [email], [state], [area], [site], [access], [last_login_time]
            FROM [Lubrication_Dashboard].[dbo].[login]
            WHERE [domain_id] = ?
        `;

        // Execute the query
        const result = await connection.query(query, [DomainId]);

        // Check if the user exists
        if (result.length === 0) {
            const response = { checkAdmin: false, message: 'No user found for the given DomainId.' };
            // Write response to JSON file
            fs.writeFileSync('checkUserProcessingResponse.json', JSON.stringify(response, null, 2));
            return res.status(404).json(response);
        }

        const adminData = result[0];

        // Generate a random session ID
        const sessionId = crypto.randomBytes(16).toString('hex');

        // Get the current date and time in Indian Standard Time (Asia/Kolkata)
        const lastLoginTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'); // Format: YYYY-MM-DD HH:mm:ss

        // Update the session ID, name, email, and last_login_time in the database for the specific domain_id
        const updateQuery = `
            UPDATE [Lubrication_Dashboard].[dbo].[login]
            SET [id] = ?, [name] = ?, [email] = ?, [last_login_time] = ?
            WHERE [domain_id] = ?
        `;

        // Execute the update query
        await connection.query(updateQuery, [sessionId, decodedName, EmailId, lastLoginTime, DomainId]);

        // Prepare the response data
        const responseData = {
            id: sessionId, // The new session ID
            domain_id: adminData.domain_id,
            name: decodedName, // Use decoded name if available
            email: EmailId, // Use the provided EmailId
            state: adminData.state,
            area: adminData.area,
            site: adminData.site,
            access: adminData.access,
            last_login_time: lastLoginTime // Include the updated last login time
        };

        // Write the successful response to the JSON file
        fs.writeFileSync('checkUserProcessingResponse.json', JSON.stringify(responseData, null, 2));

        // Send the response
        res.status(200).json(responseData);

        // Close the database connection
        await connection.close();
    } catch (error) {
        console.error('Error:', error);
        const errorResponse = { message: 'An error occurred while processing the request.' };
        fs.writeFileSync('checkUserProcessingResponse.json', JSON.stringify(errorResponse, null, 2));
        res.status(500).json(errorResponse);
    }
});

// Export the router
module.exports = router;
