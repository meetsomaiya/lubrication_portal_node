const express = require('express');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx'); // Import the xlsx library
const router = express.Router();
const multer = require('multer'); // To handle file uploads

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

// Configure multer to store the uploaded file in a temporary directory
const upload = multer({ dest: 'uploads/' });

// Handle the file upload
router.post('/', upload.single('file'), (req, res) => {
  // Retrieve the file path from the uploaded file
  const filePath = req.file.path;
  console.log('Uploaded file path:', filePath);

  // Read the Excel file
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];  // Get the first sheet
  const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);  // Convert sheet to JSON

  // Log the extracted data (for verification)
  console.log('Excel Data:', sheetData);

  // Write the data to a JSON file
  const jsonFilePath = path.join(__dirname, 'data_testing_site_incharge.json');
  fs.writeFile(jsonFilePath, JSON.stringify(sheetData, null, 2), (err) => {
    if (err) {
      console.error('Error writing JSON file:', err);
      return res.status(500).send('Error writing to JSON file');
    }
    console.log('Data saved to JSON file');
    res.json({ success: true, message: 'File processed and saved as JSON', data: sheetData });
  });
});

// Export the router
module.exports = router;
