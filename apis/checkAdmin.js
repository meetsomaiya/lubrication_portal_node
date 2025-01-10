console.log('checkAdmin route module loaded');

const express = require('express');
// const { connectToDatabase } = require('./connect.js');
// const { connectToDatabase } = require('./connect5.js');
const { connectToDatabase } = require('./connect6.js');
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
    if (!DomainId || !EmailId) {
        return res.status(400).json({ message: 'DomainId and EmailId are required.' });
    }

    // Decode the name if it is encoded
    const decodedName = Name ? decodeURIComponent(Name) : null;

    // Log the retrieved DomainId, decoded Name, and EmailId
    console.log('Retrieved DomainId:', DomainId);
    console.log('Decoded Name:', decodedName);
    console.log('EmailId:', EmailId);

    try {
        const connection = await connectToDatabase();

        // SQL query to fetch admin details for the specified domain_id
        const query = `
            SELECT [id], [domain_id], [name], [email], [access], [admin_type], [last_login_time]
            FROM [dbo].[admins]
            WHERE [domain_id] = ?
        `;

        // Execute the query
        const result = await connection.query(query, [DomainId]);

        // Check if the user exists
        if (result.length === 0) {
            const response = { checkAdmin: false, message: 'No admin found for the given DomainId.' };
            // Write response to JSON file
            fs.writeFileSync('checkAdminProcessingResponse.json', JSON.stringify(response, null, 2));
            // Send response with status 200 instead of 404
            return res.status(200).json(response); // Changed from 404 to 200
        }

        const adminData = result[0];

        // Generate a random session ID
        const sessionId = crypto.randomBytes(16).toString('hex');

        // Get the current date and time in IST (Asia/Kolkata timezone)
        const currentDateTimeInIST = moment.tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

        // Update the session ID, last_login_time, name, and email in the database for the specific domain_id
        const updateQuery = `
            UPDATE [dbo].[admins]
            SET [id] = ?, [name] = ?, [email] = ?, [last_login_time] = ?
            WHERE [domain_id] = ?
        `;

        // Execute the update query
        await connection.query(updateQuery, [
            sessionId,
            decodedName || adminData.name,
            EmailId, // Update the email as well
            currentDateTimeInIST,
            DomainId
        ]);

        // Prepare the response data
        const responseData = {
            checkAdmin: true, // Indicating that the user is an admin
            id: sessionId, // The new session ID
            domain_id: adminData.domain_id,
            name: decodedName || adminData.name, // Use decoded name if available
            email: EmailId, // Use the provided EmailId
            access: adminData.access,
            admin_type: adminData.admin_type,
        };

        // Write the successful response to the JSON file
        fs.writeFileSync('checkAdminProcessingResponse.json', JSON.stringify(responseData, null, 2));

        // Send the response
        res.status(200).json(responseData);

        // Close the database connection
        await connection.close();
    } catch (error) {
        console.error('Error:', error);
        const errorResponse = { message: 'An error occurred while processing the request.' };
        fs.writeFileSync('checkAdminProcessingResponse.json', JSON.stringify(errorResponse, null, 2));
        res.status(500).json(errorResponse);
    }
});

// Export the router
module.exports = router;
