const express = require('express');
const fs = require('fs'); // For file operations
const multer = require('multer'); // For handling file uploads
const xlsx = require('xlsx'); // For reading Excel files
const router = express.Router(); // Define the router
const { connectToDatabase } = require('./connect5.js'); // Your database connection module

// Middleware to parse JSON bodies
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

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' }); // Uploaded files will be stored in the 'uploads' folder

// API endpoint to handle Excel upload
router.post('/', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        // Read the uploaded Excel file
        const filePath = req.file.path;
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // Read the first sheet
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]); // Convert sheet to JSON

        // Save the data to a JSON file
        const jsonFilePath = 'register-users-via-excel.json';
        fs.writeFileSync(jsonFilePath, JSON.stringify(sheetData, null, 2));

        // Clean up the uploaded file after processing
        fs.unlinkSync(filePath);

        // Send response
        res.status(200).json({
            message: 'File uploaded and processed successfully',
            data: sheetData,
        });
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ message: 'Error processing file', error: error.message });
    }
});

// Export the router
module.exports = router;
