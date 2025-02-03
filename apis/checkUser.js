console.log('checkUser route module loaded');

const express = require('express');
const { connectToMSSQL } = require('./connect7.js'); // Database connection
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
    const { DomainId } = req.query; // Retrieve DomainId from query parameters

    // Save retrieved values to a JSON file for verification
    const receivedData = { DomainId, timestamp: new Date().toISOString() };
    fs.writeFileSync('checkAdminDataRetrieve.json', JSON.stringify(receivedData, null, 2));

    console.log('Received Query Params:', receivedData);

    // Validate the incoming data
    if (!DomainId) {
        return res.status(400).json({
            message: 'DomainId is required.',
            received: receivedData
        });
    }

    try {
        // SQL query to fetch user details with correct column ordering
        const selectQuery = `
            SELECT 
                [id], 
                [domain_id], -- Varchar(20) before varchar(255)
                [name], 
                [email], 
                [state], 
                [area], 
                [site], 
                [access],
                [last_login_time] -- Non-varchar column first
            FROM [dbo].[login]
            WHERE [domain_id] = '${DomainId}'
        `;

        console.log('Executing SQL Query:', selectQuery);

        // Execute the query
        const result = await connectToMSSQL(selectQuery);

        if (!result || result.length === 0) {
            const response = { checkAdmin: false, message: 'No user found for the given DomainId.' };
            fs.writeFileSync('checkUserProcessingResponse.json', JSON.stringify(response, null, 2));
            return res.status(404).json(response);
        }

        const adminData = result[0];

        // Handle undefined/null values and ensure they are properly formatted
        const getValue = (val) => (val === null || val === undefined ? "undefined" : val);
        const getArrayValue = (val) => (val ? val.split(",").map(v => v.trim()) : []);

        // Generate a new session ID
        const sessionId = crypto.randomBytes(16).toString('hex');

        // Get the current date and time in Indian Standard Time
        const lastLoginTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

        // Prepare data with safe handling for null/undefined values and comma-separated values
        const updatedData = {
            last_login_time: getValue(adminData.last_login_time),
            domain_id: getValue(adminData.domain_id),
            id: getValue(adminData.id),
            name: getValue(adminData.name),
            email: getValue(adminData.email),
            state: getValue(adminData.state),
            area: getValue(adminData.area),
            site: getArrayValue(adminData.site), // Convert comma-separated values to an array
            access: getArrayValue(adminData.access) // Convert comma-separated values to an array
        };

        // Prepare the response data
        fs.writeFileSync('checkUserProcessingResponse.json', JSON.stringify(updatedData, null, 2));

        res.status(200).json(updatedData);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'An error occurred while processing the request.' });
    }
});

// Export the router
module.exports = router;
