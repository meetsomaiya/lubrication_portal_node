const express = require('express');
const odbc = require('odbc');  // Required for ODBC database connection
const router = express.Router();
const { connectToDatabase } = require('./connect5.js'); // Your database connection module

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

// Handle POST request to update user details
router.post('/', async (req, res) => {
    // Retrieve the data sent from frontend
    const { domainId, name, access, state, area, site } = req.body;

    // Log the data to the console
    console.log('Received Data:', {
        domainId,
        name,
        access,
        state,
        area,
        site
    });

    try {
        // Connect to the database
        const connection = await connectToDatabase();

        // First, fetch the existing domainId from the 'login' table
        const query = 'SELECT domain_id FROM login WHERE domain_id = ?';
        const result = await connection.query(query, [domainId]);

        if (result.length === 0) {
            return res.status(404).json({ message: 'domain_id not found in the database' });
        }

        // Now that the domain_id exists, update the corresponding details
        const updateQuery = `
            UPDATE login 
            SET access = ?, state = ?, area = ?, site = ?
            WHERE domain_id = ?;
        `;
        const updateParams = [access, state, area, site, domainId];

        await connection.query(updateQuery, updateParams);

        // Respond back confirming the update was successful
        res.status(200).json({ 
            message: 'Data updated successfully',
            updatedData: { domainId, access, state, area, site }
        });

    } catch (err) {
        console.error('Error in database operation:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Export the router
module.exports = router;
