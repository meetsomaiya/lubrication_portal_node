const express = require('express');
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

// Middleware to parse JSON bodies
router.use(express.json());

// Logout API endpoint
router.post('/', (req, res) => {
    try {
        const { name, userId } = req.body; // Retrieve the data passed from the frontend

        if (!name || !userId) {
            return res.status(400).json({ error: 'Missing name or userId' });
        }

        // Create the data object
        const logoutData = {
            name,
            userId,
            logoutTime: new Date().toISOString(), // Include logout time for reference
        };

        // Write the data to a JSON file
        fs.writeFileSync('logout_user.json', JSON.stringify(logoutData, null, 2));

        // Respond with success
        res.status(200).json({ message: 'Logout data written successfully', data: logoutData });
    } catch (error) {
        console.error('Error handling logout:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export the router
module.exports = router;
