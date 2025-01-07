const express = require('express');
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

// POST route to handle the registration data
router.post('/', async (req, res) => {
    try {
        // Get the data sent from the frontend
        const { domainId, name, email, access, adminType } = req.body;

        // Log the received data
        console.log("Received data:", { domainId, name, email, access, adminType });

        // Establish database connection
        const connection = await connectToDatabase();

        // Check if the domainId already exists in the admins table
        const checkQuery = `
            SELECT COUNT(*) AS count FROM admins WHERE domain_id = ?
        `;
        
        const checkResult = await connection.query(checkQuery, [domainId]);

        // If domainId already exists, return a response and prevent further registration
        if (checkResult[0].count > 0) {
            await connection.close();
            return res.status(400).json({
                success: false,
                message: 'Domain ID already exists in the admins table. Registration not allowed.'
            });
        }

        // Prepare the SQL query to insert the data into the admins table
        const query = `
            INSERT INTO admins (domain_id, access, admin_type)
            VALUES (?, ?, ?)
        `;

        // Execute the query to insert the data
        await connection.query(query, [domainId, access, adminType]);

        // Close the database connection
        await connection.close();

        // Return success response
        res.status(200).json({ success: true, message: "Registration saved successfully" });
    } catch (error) {
        // Handle any errors that occurred during the process
        console.error("Error:", error);
        res.status(500).json({
            success: false,
            message: 'Error handling the registration request.',
            error: error.message,
        });
    }
});

// Export the router
module.exports = router;
