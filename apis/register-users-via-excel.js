const express = require('express');
const fs = require('fs'); // For file operations
const multer = require('multer'); // For handling file uploads
const xlsx = require('xlsx'); // For reading Excel files
const router = express.Router(); // Define the router
//const { connectToDatabase } = require('./connect5.js'); // Your database connection module
const { connectToDatabase } = require('./connect6.js');

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
router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const dbConnection = await connectToDatabase(); // Connect to the database

    try {
        // Read the uploaded Excel file
        const filePath = req.file.path;
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // Read the first sheet
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]); // Convert sheet to JSON

        // Iterate over the Excel data and insert into database if necessary
        for (const row of sheetData) {
            const { domain_id, name, email, state, area, site } = row;

            // Check if the domain_id already exists in the login table
            const checkQuery = `SELECT COUNT(*) AS count FROM login WHERE domain_id = ?`;
            const checkResult = await dbConnection.query(checkQuery, [domain_id]);

            if (checkResult[0].count === 0) {
                // If domain_id does not exist, insert the data
                const insertQuery = `
                    INSERT INTO login (domain_id, name, email, state, area, site, access, last_login_time)
                    VALUES (?, ?, ?, ?, ?, ?, 'user', NULL)
                `;
                await dbConnection.query(insertQuery, [domain_id, name, email, state, area, site]);
                console.log(`Inserted: ${domain_id}`);
            } else {
                console.log(`Skipped: ${domain_id} (already exists)`);
            }
        }

        // Clean up the uploaded file after processing
        fs.unlinkSync(filePath);

        // Send response
        res.status(200).json({
            message: 'File uploaded and processed successfully',
        });
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ message: 'Error processing file', error: error.message });
    } finally {
        // Close the database connection
        await dbConnection.close();
    }
});

// Export the router
module.exports = router;
