const express = require('express');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const router = express.Router();
const multer = require('multer');
const { connectToDatabase } = require('./connect6.js');

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

// Configure multer for file upload
const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('file'), async (req, res) => {
  const filePath = req.file.path;
  console.log('Uploaded file path:', filePath);

  try {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    let sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);

    console.log('Original Excel Data:', sheetData);

    // Remove "extra" column if present
    sheetData = sheetData.map(({ extra, ...row }) => row);

    // Save the processed data for verification
    const jsonFilePath = path.join(__dirname, 'site_area_incharge_data_read.json');
    fs.writeFileSync(jsonFilePath, JSON.stringify(sheetData, null, 2));
    console.log('Data saved to site_area_incharge_data_read.json');

    const dbConnection = await connectToDatabase();

    for (const row of sheetData) {
      const {
        'SAP FUNCTIONAL LOCATION': functionalLocation,
        STATE,
        'NEW AREA': AREA,
        'NEW MAIN SITE': SITE,
        'Maintenance Plant': maintenancePlant, // Mapping to "Maintenance Plant"
        'STATE ENGG HEAD': stateEnggHead,
        'AREA INCHARGE ( NEW)': areaIncharge, // Mapping to "AREA INCHARGE"
        'SITE INCHARGES': siteIncharge, // Mapping to "SITE INCHARGE"
        'STATE PM0': statePmo,
        'MAINTENNACE INCHARGES': maintenanceIncharges,
        'GEAR BOX TEAM': gearBoxTeam,
      } = row;

      const sql = `
        MERGE INTO site_area_incharge_mapping AS target
        USING (VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)) AS source 
          ([Functional Location], [STATE], [AREA], [SITE], [Maintenance Plant], [STATE ENGG HEAD], [AREA INCHARGE], [SITE INCHARGE], [STATE PMO], [MAINTENNACE INCHARGES], [GEAR BOX TEAM])
        ON target.[STATE] = source.[STATE]
        AND target.[AREA] = source.[AREA]
        AND target.[SITE] = source.[SITE]
        WHEN MATCHED THEN
          UPDATE SET 
            target.[Functional Location] = source.[Functional Location],
            target.[STATE ENGG HEAD] = source.[STATE ENGG HEAD],
            target.[AREA INCHARGE] = source.[AREA INCHARGE],
            target.[SITE INCHARGE] = source.[SITE INCHARGE],
            target.[STATE PMO] = source.[STATE PMO],
            target.[MAINTENNACE INCHARGES] = source.[MAINTENNACE INCHARGES],
            target.[GEAR BOX TEAM] = source.[GEAR BOX TEAM],
            target.[Maintenance Plant] = source.[Maintenance Plant]
        WHEN NOT MATCHED THEN
          INSERT ([Functional Location], [STATE], [AREA], [SITE], [Maintenance Plant], [STATE ENGG HEAD], [AREA INCHARGE], [SITE INCHARGE], [STATE PMO], [MAINTENNACE INCHARGES], [GEAR BOX TEAM])
          VALUES (source.[Functional Location], source.[STATE], source.[AREA], source.[SITE], source.[Maintenance Plant], source.[STATE ENGG HEAD], source.[AREA INCHARGE], source.[SITE INCHARGE], source.[STATE PMO], source.[MAINTENNACE INCHARGES], source.[GEAR BOX TEAM]);
      `;

      console.log('Executing SQL query:', sql);
      console.log('With parameters:', [
        functionalLocation,
        STATE,
        AREA,
        SITE,
        maintenancePlant,
        stateEnggHead,
        areaIncharge,
        siteIncharge,
        statePmo,
        maintenanceIncharges,
        gearBoxTeam,
      ]);

      try {
        await dbConnection.query(sql, [
          functionalLocation,
          STATE,
          AREA,
          SITE,
          maintenancePlant,
          stateEnggHead,
          areaIncharge,
          siteIncharge,
          statePmo,
          maintenanceIncharges,
          gearBoxTeam,
        ]);
        console.log(`Data for site: ${SITE} updated/inserted successfully.`);
      } catch (err) {
        console.error('Error executing query for row:', row, err);
      }
    }

    await dbConnection.close();
    console.log('Database connection closed.');

    // Delete the uploaded Excel file
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error deleting file:', err);
      } else {
        console.log('Uploaded file deleted successfully');
      }
    });

    res.json({
      success: true,
      message: 'File processed, data updated, and saved as JSON',
      data: sheetData,
    });

  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).send('Error processing file');
  }
});

module.exports = router;
