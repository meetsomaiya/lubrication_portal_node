const express = require('express');
// const { connectToDatabase } = require('./connect.js');
const { connectToDatabase } = require('./connect6.js');

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

// Define the get_areas API endpoint
router.get('/', async (req, res) => {
    const selectedState = req.query.state;

    // Check if state parameter is provided
    if (!selectedState) {
        return res.status(400).json({ error: 'State parameter is required' });
    }

    try {
        const db = await connectToDatabase();
        const query = `
            SELECT DISTINCT area 
            FROM installedbase 
            WHERE state = ?`;

        const areas = await db.query(query, [selectedState]);

        // If no areas found, return an empty array
        if (areas.length === 0) {
            return res.json([]);
        }

        // Send the areas back as the response
        res.json(areas);
    } catch (error) {
        console.error('Error fetching areas:', error);
        res.status(500).json({ error: 'Failed to fetch areas from the database' });
    }
});

// Export the router
module.exports = router;
