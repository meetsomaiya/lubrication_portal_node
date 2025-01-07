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

// Define the get_functional_locations API endpoint
router.get('/', async (req, res) => {
    const selectedState = req.query.state;
    const selectedArea = req.query.area;
    const selectedSite = req.query.site;

    // Check if state, area, and site parameters are provided
    if (!selectedState || !selectedArea || !selectedSite) {
        return res.status(400).json({ error: 'State, area, and site parameters are required' });
    }

    try {
        const db = await connectToDatabase();
        const query = `
            SELECT DISTINCT Functional_Location 
            FROM installedbase
            WHERE State = ? AND Area = ? AND Site = ?`;

        // Log the SQL query and parameters
        console.log('Executing SQL Query:', query);
        console.log('With parameters:', [selectedState, selectedArea, selectedSite]);

        const functionalLocations = await db.query(query, [selectedState, selectedArea, selectedSite]);

        // If no functional locations found, return an empty array
        if (functionalLocations.length === 0) {
            return res.json([]);
        }

        // Send the functional locations back as the response
        res.json(functionalLocations);
    } catch (error) {
        console.error('Error fetching functional locations:', error);
        res.status(500).json({ error: 'Failed to fetch functional locations from the database' });
    }
});

// Export the router
module.exports = router;
