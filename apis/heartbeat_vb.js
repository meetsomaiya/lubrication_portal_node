const express = require('express');
const moment = require('moment-timezone'); // For working with IST timezone
const { connectToDatabase } = require('./connect.js');
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

// Helper function to log data
function logData(message, file = 'error_log.log') {
    const logMessage = `${new Date().toISOString()} - ${message}\n`;
    fs.appendFileSync(file, logMessage);
}

// Heartbeat API route
router.get('/', async (req, res) => {
    const screenName = req.query.screen_name;

    if (!screenName) {
        return res.status(400).json({ error: 'screen_name parameter is required.' });
    }

    const screenFile = 'screen_retrieved_in_hearbeat.json';
    fs.writeFileSync(screenFile, JSON.stringify(screenName, null, 2));

    let dbConnection;
    try {
        dbConnection = await connectToDatabase();

        let domainId = null;
        let name = null;
        let lastLoginTime = '1970-01-01T00:00:00.000Z';

        const sessionId = req.cookies?.admin_session_id;
        if (sessionId) {
            // Fetch domain_id and name
            const adminQuery = `
                SELECT domain_id, name
                FROM admins
                WHERE id = ?`;
            const adminResult = await dbConnection.query(adminQuery, [sessionId]);

            if (adminResult.length > 0) {
                domainId = adminResult[0].domain_id;
                name = adminResult[0].name;

                // Fetch last_login_time
                const loginQuery = `
                    SELECT last_login_time
                    FROM total_logins
                    WHERE domain_id = ?`;
                const loginResult = await dbConnection.query(loginQuery, [domainId]);

                if (loginResult.length > 0) {
                    lastLoginTime = loginResult[0].last_login_time;
                }
            }
        }

        // Format last login time as ISO 8601
        const lastLoginTimeISO = moment(lastLoginTime).tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');

        // Get current date-time in IST
        const currentDateTimeISO = moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');

        // Prepare data for UserEngagement API
        const postData = [
            {
                AppID: 'LUBRICATION_PORTAL',
                ApplicationType: 'web',
                CustEmail: '',
                CustID: '',
                CustName: '',
                CustomData: '',
                DeviceID: '3385f58ecd5b7dbd',
                EndDateTime: currentDateTimeISO,
                Password: 'Suzlon@123',
                UserID: domainId,
                ScreenName: screenName,
                StartDateTime: lastLoginTimeISO,
                UserEngagementID: 0,
                UserName: name,
            },
        ];

        const apiUrl = 'https://suzomsapps.suzlon.com/Services/UserEngagement/api/UserEngagement';

        // Log the data sent to UserEngagement API
        const logFile = 'data_sent_userengagement_record_api-hearbeat.log';
        fs.appendFileSync(logFile, `${new Date().toISOString()} - Request: ${JSON.stringify(postData)}\n`);

        // Send POST request to UserEngagement API
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData),
        });

        const responseData = await response.text();
        fs.appendFileSync(logFile, `${new Date().toISOString()} - Response (${response.status}): ${responseData}\n`);

        res.json({ message: 'Heartbeat processed successfully.', responseData });
    } catch (error) {
        logData(`Error processing heartbeat: ${error.message}`);
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        if (dbConnection) {
            await dbConnection.close();
        }
    }
});

// Export the router
module.exports = router;
