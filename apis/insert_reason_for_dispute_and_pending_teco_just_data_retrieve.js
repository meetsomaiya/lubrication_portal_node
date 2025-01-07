const express = require('express');
const fs = require('fs');
const moment = require('moment-timezone');
const router = express.Router();

moment.tz.setDefault('Asia/Kolkata');

// Set up middleware to parse JSON request bodies
router.use(express.json());

// Set up CORS middleware
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '3600');
    next();
});

// POST endpoint at the default route
router.post('/', async (req, res) => {
  try {
    // Log the raw data received in the POST request
    console.log('Raw data received:', req.body);

    // Retrieve the data from the POST request
    const reasonsData = req.body;

    // Check if required fields are present
    if (!reasonsData || !reasonsData.orderNo || !reasonsData.reason || !reasonsData.domain_id || !reasonsData.name) {
      return res.status(400).json({ error: 'Invalid or incomplete data received' });
    }

    // Add a timestamp for tracking
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');

    // Prepare the data to be written to the JSON file
    const dataToWrite = {
      timestamp,
      reasons: reasonsData,
    };

    // Define the path where the data will be written
    const filePath = './reasons_retrieved_for_dispute.json';

    // Write the data to a JSON file
    fs.writeFile(filePath, JSON.stringify(dataToWrite, null, 2), (err) => {
      if (err) {
        console.error('Error writing to JSON file:', err);
        return res.status(500).json({ error: 'Failed to write data to file' });
      }

      // Log success and send response to the client
      console.log('Data successfully written to JSON file:', dataToWrite);
      res.status(200).json({
        message: 'Data received and written to JSON file successfully',
        writtenData: dataToWrite,
      });
    });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
