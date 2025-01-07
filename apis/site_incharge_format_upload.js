const express = require('express');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx'); // Import the xlsx library
const router = express.Router();
const multer = require('multer'); // To handle file uploads
const { connectToDatabase } = require('./connect4.js'); // Your database connection module

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
router.post('/', upload.single('file'), async (req, res) => {
  // Retrieve the file path from the uploaded file
  const filePath = req.file.path;
  console.log('Uploaded file path:', filePath);

  // Read the Excel file
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];  // Get the first sheet
  const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);  // Convert sheet to JSON

  // Log the extracted data (for verification)
  console.log('Excel Data:', sheetData);

  // Connect to the database
  try {
    const dbConnection = await connectToDatabase();

    // Iterate through the rows of Excel data
    for (let row of sheetData) {
      // Extract each field from the Excel row
      const {
        STATE, 
        AREA, 
        SITE, 
        'STATE ENGG HEAD': stateEnggHead, 
        'AREA INCHARGE': areaIncharge, 
        'SITE INCHARGE': siteIncharge, 
        'STATE PMO': statePmo, 
        extra
      } = row;

      // SQL MERGE INTO statement
      const sql = `
        MERGE INTO site_area_incharge_mapping AS target
        USING (VALUES (?, ?, ?, ?, ?, ?, ?, ?)) AS source ([STATE], [AREA], [SITE], [STATE ENGG HEAD], [AREA INCHARGE], [SITE INCHARGE], [STATE PMO], [extra])
        ON target.[STATE] = source.[STATE]
        AND target.[AREA] = source.[AREA]
        AND target.[SITE] = source.[SITE]
        WHEN MATCHED THEN
          UPDATE SET 
            target.[STATE ENGG HEAD] = source.[STATE ENGG HEAD],
            target.[AREA INCHARGE] = source.[AREA INCHARGE],
            target.[SITE INCHARGE] = source.[SITE INCHARGE],
            target.[STATE PMO] = source.[STATE PMO],
            target.[extra] = source.[extra]
        WHEN NOT MATCHED THEN
          INSERT ([STATE], [AREA], [SITE], [STATE ENGG HEAD], [AREA INCHARGE], [SITE INCHARGE], [STATE PMO], [extra])
          VALUES (source.[STATE], source.[AREA], source.[SITE], source.[STATE ENGG HEAD], source.[AREA INCHARGE], source.[SITE INCHARGE], source.[STATE PMO], source.[extra]);
      `;

      // Log the query before execution
      console.log('Executing SQL query:', sql);
      console.log('With parameters:', [STATE, AREA, SITE, stateEnggHead, areaIncharge, siteIncharge, statePmo, extra]);

      // Execute the query for each row
      try {
        await dbConnection.query(sql, [STATE, AREA, SITE, stateEnggHead, areaIncharge, siteIncharge, statePmo, extra]);
        console.log(`Data for site: ${SITE} updated/inserted successfully.`);
      } catch (err) {
        console.error('Error executing query for row:', row, err);
      }
    }

    // Close the database connection
    await dbConnection.close();
    console.log('Database connection closed.');

    // Write the data to a JSON file
    const jsonFilePath = path.join(__dirname, 'data_testing_site_incharge.json');
    fs.writeFile(jsonFilePath, JSON.stringify(sheetData, null, 2), (err) => {
      if (err) {
        console.error('Error writing JSON file:', err);
        return res.status(500).send('Error writing to JSON file');
      }
      console.log('Data saved to JSON file');
      res.json({ success: true, message: 'File processed, data updated, and saved as JSON', data: sheetData });
    });

  } catch (error) {
    console.error('Database connection failed:', error);
    res.status(500).send('Error connecting to database');
  }
});

// Export the router
module.exports = router;
