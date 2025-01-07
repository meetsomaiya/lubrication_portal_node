const express = require('express');
const odbc = require('odbc');
const fs = require('fs');
const { connectToDatabase } = require('./connect3.js'); // Import database connection
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

// Route to handle GET request
router.get('/', async (req, res) => {
    try {
        const db = await connectToDatabase();

        // Array of allowed order types
        const allowedOrderTypes = ['GB_OIL_CHANGE ORDER', 'FC_OIL_CHANGE ORDER', 'y', 'pd'];

        // SQL query to fetch unique order types based on allowed types and patterns
        const query = `
            SELECT DISTINCT order_type 
            FROM consumption_analysis_table 
            WHERE order_type IN (${allowedOrderTypes.map(type => `'${type}'`).join(', ')}) 
            OR order_type LIKE 'y%' 
            OR order_type LIKE 'pd%'
        `;

        // Execute the query
        const result = await db.query(query);
        const orderTypes = result.map(row => row.order_type);

        // Additional order types to be added manually
        const additionalOrderTypes = ['gb_topup', 'fc_topup', 'ydpd_topup', 'dispute', 'Pending Teco'];
        const allOrderTypes = [...new Set([...orderTypes, ...additionalOrderTypes])];

        // Response object
        const response = { order_types: allOrderTypes };
        const responseJson = JSON.stringify(response);

        // Send the response as JSON
        res.json(response);

        // Write the JSON response to order_types_sent_back.json file
        fs.writeFileSync('order_types_sent_back.json', responseJson, 'utf8');
    } catch (error) {
        // Handle database errors
        const errorResponse = { error: 'Database error: ' + error.message };
        const errorResponseJson = JSON.stringify(errorResponse);

        // Send error response as JSON
        res.json(errorResponse);

        // Write the error response to order_types_sent_back.json file
        fs.writeFileSync('order_types_sent_back.json', errorResponseJson, 'utf8');
    }
});

module.exports = router;
