console.log('checkUser route module loaded');

const express = require('express');
const { connectToDatabase } = require('./connect6.js'); // Database connection
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

    // Save retrieved values to a JSON file for verification
    const receivedData = { DomainId, Name, EmailId, timestamp: new Date().toISOString() };
    fs.writeFileSync('checkAdminDataRetrieve.json', JSON.stringify(receivedData, null, 2));

    console.log('Received Query Params:', receivedData);

    // Validate the incoming data
    if (!DomainId || !Name || !EmailId) {
        return res.status(400).json({
            message: 'DomainId, Name, and EmailId are required.',
            received: receivedData
        });
    }

    const decodedName = decodeURIComponent(Name);

    console.log('Retrieved DomainId:', DomainId);
    console.log('Decoded Name:', decodedName);
    console.log('EmailId:', EmailId);

    let connection;
    try {
        connection = await connectToDatabase();

        // SQL query to fetch user details for the specified domain_id
    //     const selectQuery = `
    //     SELECT [last_login_time], [access], [area], [domain_id], [email], [id], [name], [site], [state]
    //     FROM [dbo].[login]
    //     WHERE [domain_id] = ?
    // `;

    const selectQuery = `
    SELECT [access], [area], [site], [state]
    FROM [dbo].[login]
    WHERE [domain_id] = ?
`;

    console.log('Executing SQL Query:', selectQuery, 'with values:', [DomainId]);
    

        // Execute the query
        const [rows] = await connection.query(selectQuery, [DomainId]);

        if (rows.length === 0) {
            const response = { checkAdmin: false, message: 'No user found for the given DomainId.' };
            fs.writeFileSync('checkUserProcessingResponse.json', JSON.stringify(response, null, 2));
            return res.status(404).json(response);
        }

        const adminData = rows[0];

        // Handle undefined/null values and ensure they are properly formatted
        const getValue = (val) => (val === null || val === undefined ? "" : val);
        const getArrayValue = (val) => (val ? val.split(",").map(v => v.trim()) : []);

        // Generate a new session ID
        const sessionId = crypto.randomBytes(16).toString('hex');

        // Get the current date and time in Indian Standard Time
        const lastLoginTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

        // Prepare data with safe handling for null/undefined values and comma-separated values
        const updatedData = {
            last_login_time: lastLoginTime,
            id: sessionId,
            name: getValue(decodedName),
            email: getValue(EmailId),
            state: getValue(adminData.state),
            area: getValue(adminData.area),
            site: getArrayValue(adminData.site), // Convert comma-separated values to an array
            access: getArrayValue(adminData.access) // Convert comma-separated values to an array
        };

        // SQL query to update user details in the database
        const updateQuery = `
            UPDATE [dbo].[login]
            SET [last_login_time] = ?, [id] = ?, [name] = ?, [email] = ?, 
                [state] = ?, [area] = ?, [site] = ?, [access] = ?
            WHERE [domain_id] = ?
        `;
        console.log('Executing SQL Query:', updateQuery, 'with values:', [
            updatedData.last_login_time, updatedData.id, updatedData.name, updatedData.email,
            updatedData.state, updatedData.area, updatedData.site.join(","), updatedData.access.join(","),
            DomainId
        ]);

        await connection.query(updateQuery, [
            updatedData.last_login_time, updatedData.id, updatedData.name, updatedData.email,
            updatedData.state, updatedData.area, updatedData.site.join(","), updatedData.access.join(","),
            DomainId
        ]);

        // Prepare the response data
        const responseData = {
            last_login_time: updatedData.last_login_time,
            domain_id: DomainId,
            id: updatedData.id,
            name: updatedData.name,
            email: updatedData.email,
            state: updatedData.state,
            area: updatedData.area,
            site: updatedData.site, // Array format
            access: updatedData.access // Array format
        };

        fs.writeFileSync('checkUserProcessingResponse.json', JSON.stringify(responseData, null, 2));

        res.status(200).json(responseData);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'An error occurred while processing the request.' });
    } finally {
        if (connection) {
            await connection.close(); // Ensure the database connection is closed
        }
    }
});

// Export the router
module.exports = router;
