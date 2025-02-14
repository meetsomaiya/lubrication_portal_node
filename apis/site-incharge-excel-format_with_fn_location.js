const express = require('express');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { connectToDatabase } = require('./connect6.js');
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

// Helper function to generate Excel file from the database result
async function generateExcelFile() {
  try {
    const dbConnection = await connectToDatabase();

    // Query the data from site_area_incharge_mapping
    const query = 'SELECT [id], [Functional Location], [STATE], [AREA], [SITE], [Maintenance Plant], [STATE ENGG HEAD], [AREA INCHARGE], [SITE INCHARGE], [STATE PMO], [MAINTENNACE INCHARGES], [GEAR BOX TEAM], [extra] FROM site_area_incharge_mapping';
    const rows = await dbConnection.query(query);

    // Map rows to the desired format
    const excelData = rows.map((row) => ({
      'SR NO': row.id,
      'SAP FUNCTIONAL LOCATION': row['Functional Location'],
      'STATE': row.STATE,
      'NEW AREA': row.AREA,
      'NEW MAIN SITE': row.SITE,
      'Maintenance Plant': row['Maintenance Plant'],
      'STATE ENGG HEAD': row['STATE ENGG HEAD'],
      'AREA INCHARGE (NEW)': row['AREA INCHARGE'],
      'SITE INCHARGES': row['SITE INCHARGE'],
      'STATE PMO': row['STATE PMO'],
      'MAINTENNACE INCHARGES': row['MAINTENNACE INCHARGES'],
      'GEAR BOX TEAM': row['GEAR BOX TEAM'],
    }));

    // Define the headers in the desired order
    const headers = [
      'SR NO',
      'SAP FUNCTIONAL LOCATION',
      'STATE',
      'NEW AREA',
      'NEW MAIN SITE',
      'Maintenance Plant',
      'STATE ENGG HEAD',
      'AREA INCHARGE (NEW)',
      'SITE INCHARGES',
      'STATE PMO',
      'MAINTENNACE INCHARGES',
      'GEAR BOX TEAM'
    ];

    // Create a worksheet from the excelData
    const ws = xlsx.utils.json_to_sheet(excelData, { header: headers });

    // Create a new workbook and append the worksheet
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Site Incharge Mapping');

    // Save the Excel file to a buffer
    const fileBuffer = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });

    return fileBuffer;
  } catch (error) {
    console.error('Error generating Excel file:', error);
    throw error;
  }
}

// Serve the Excel file for download
router.get('/', async (req, res) => {
  try {
    const excelFile = await generateExcelFile();

    // Set the response headers for downloading the file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=site_incharge_mapping.xlsx');

    // Send the generated file as a response
    res.send(excelFile);
  } catch (err) {
    console.error('Error downloading file:', err);
    res.status(500).send('File download failed');
  }
});

module.exports = router;
