const express = require('express');
const router = express.Router();
// const { connectToDatabase } = require('./connect5.js'); // Database connection module

const { connectToDatabase } = require('./connect6.js'); // Database connection module

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

// API endpoint to delete an admin
router.post('/', async (req, res) => {
    const { domainId } = req.body; // Extract domain_id from the request body
    console.log('Received domainId:', domainId);

    if (!domainId) {
        return res.status(400).json({ success: false, message: 'DomainId is required.' });
    }

    try {
        const dbConnection = await connectToDatabase(); // Establish a connection to the database

        // Check if the domainId exists in the [admins] table
        const checkQuery = `SELECT COUNT(*) AS count FROM login WHERE domain_id = ?`;
        const checkResult = await dbConnection.query(checkQuery, [domainId]);
        const { count } = checkResult[0];

        if (count === 0) {
            // If no matching domain_id found
            console.log(`No admin found with domainId: ${domainId}`);
            await dbConnection.close();
            return res.status(404).json({ success: false, message: 'Admin not found.' });
        }

        // Delete the row with the matching domain_id
        const deleteQuery = `DELETE FROM login WHERE domain_id = ?`;
        await dbConnection.query(deleteQuery, [domainId]);
        console.log(`Admin with domainId: ${domainId} deleted successfully.`);

        // Close the database connection
        await dbConnection.close();

        // Send a success response
        res.status(200).json({ success: true, message: 'user deleted successfully.' });
    } catch (error) {
        console.error('Error processing delete request:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// Export the router
module.exports = router;
