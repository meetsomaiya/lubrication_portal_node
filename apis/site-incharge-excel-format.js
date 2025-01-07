const express = require('express');
const path = require('path');
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

// Serve the Excel file for download
router.get('/', (req, res) => {
  const filePath = path.join(__dirname, './site_incharge_excel/excel_format.xlsx');
  
  // Check if file exists before sending the response
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('Error downloading file:', err);
      return res.status(500).send('File download failed');
    }

    // If the file exists, trigger the download
    res.download(filePath, 'excel_download.xlsx', (err) => {
      if (err) {
        console.error('Error during file download:', err);
        res.status(500).send('File download failed');
      }
    });
  });
});

module.exports = router;
