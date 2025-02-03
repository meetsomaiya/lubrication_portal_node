console.log('checkAdmin route module loaded');

const express = require('express');
const { connectToDatabase } = require('./connect.js');
const crypto = require('crypto'); // For generating a random session ID
const fs = require('fs'); // For file operations

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
    const { DomainId } = req.query; // Retrieve DomainId from query parameters

    // Validate the incoming data
    if (!DomainId) {
        return res.status(400).json({ message: 'DomainId is required.' });
    }

    // Log the retrieved DomainId
    console.log('Retrieved DomainId:', DomainId);

    try {
        const connection = await connectToDatabase();

        // SQL query to fetch admin details for the specified domain_id
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

        // Update the session ID in the database for the specific domain_id
        const updateQuery = `
            UPDATE [Lubrication_Dashboard].[dbo].[login]
            SET [id] = ?
            WHERE [domain_id] = ?
        `;

        // Execute the update query
        await connection.query(updateQuery, [sessionId, DomainId]);

        // Prepare the response data
        const responseData = {
            id: sessionId, // The new session ID
            domain_id: adminData.domain_id,
            name: adminData.name,
            email: adminData.email,
            state: adminData.state, // Added field
            area: adminData.area,   // Added field
            site: adminData.site,   // Added field
            access: adminData.access,
            last_login_time: adminData.last_login_time // Added field
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
