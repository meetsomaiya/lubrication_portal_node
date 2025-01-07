const express = require('express');
const fs = require('fs');  // Required for file system operations
const { connectToDatabase } = require('./connect5.js'); // Your database connection module
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

// Middleware to parse JSON bodies
router.use(express.json());

// Handle the delete request
router.post('/', async (req, res) => {
    try {
        // Retrieve the domain_id from the request body
        const { domainId } = req.body;

        if (!domainId) {
            return res.status(400).json({ message: 'domainId is required' });
        }

        // Log the domain_id for debugging purposes
        console.log(`Received domainId for deletion: ${domainId}`);

        // Prepare the data to be saved in the JSON file
        const deleteData = {
            domainId,
            timestamp: new Date().toISOString(),
        };

        // Write the domain_id to delete_user.json file
        fs.writeFile('delete_user.json', JSON.stringify(deleteData, null, 2), (err) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to write to file', error: err });
            }

            // Respond to the client with success
            res.status(200).json({ message: 'User deletion data received', domainId });
        });
    } catch (error) {
        // Handle unexpected errors
        console.error('Error in delete_user API:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Export the router
module.exports = router;
