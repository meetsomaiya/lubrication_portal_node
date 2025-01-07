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


// Export the router
module.exports = router;