const express = require('express');
const { connectToDatabase } = require('./connect.js');

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

// Define the get_sites API endpoint
router.get('/', async (req, res) => {
    const selectedState = req.query.state;
    const selectedArea = req.query.area;

    // Check if state and area parameters are provided
    if (!selectedState || !selectedArea) {
        return res.status(400).json({ error: 'State and area parameters are required' });
    }

    try {
        const db = await connectToDatabase();
        const query = `
            SELECT DISTINCT site 
            FROM installedbase 
            WHERE state = ? AND area = ?`;

        const sites = await db.query(query, [selectedState, selectedArea]);

        // If no sites found, return an empty array
        if (sites.length === 0) {
            return res.json([]);
        }

        // Send the sites back as the response
        res.json(sites);
    } catch (error) {
        console.error('Error fetching sites:', error);
        res.status(500).json({ error: 'Failed to fetch sites from the database' });
    }
});

// Export the router
module.exports = router;
