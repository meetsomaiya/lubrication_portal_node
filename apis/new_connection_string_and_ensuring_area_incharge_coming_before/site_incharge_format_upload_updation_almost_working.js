const express = require("express");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const multer = require("multer");
const { connectToMSSQL, sql } = require("./connect8.js");

const router = express.Router();

// Set up CORS middleware
router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Max-Age", "3600");
  next();
});

// Middleware to parse JSON bodies
router.use(express.json());

// Configure multer for file upload
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("file"), async (req, res) => {
  const filePath = req.file.path;
  console.log("Uploaded file path:", filePath);

  try {
    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    let sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);

    console.log("Original Excel Data:", sheetData);

    sheetData = sheetData.map(({ extra, ...row }) => row);

    const jsonFilePath = path.join(__dirname, "site_area_incharge_data_read.json");
    fs.writeFileSync(jsonFilePath, JSON.stringify(sheetData, null, 2));
    console.log("Data saved to site_area_incharge_data_read.json");

    const pool = await connectToMSSQL();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const row of sheetData) {
        const {
          "SAP FUNCTIONAL LOCATION": functionalLocation,
          STATE,
          "NEW AREA": AREA,
          "NEW MAIN SITE": SITE,
          "Maintenance Plant": maintenancePlant,
          "STATE ENGG HEAD": stateEnggHead,
          "AREA INCHARGE ( NEW )": areaIncharge,
          "SITE INCHARGES": siteIncharge,
          "STATE PM0": statePmo,
          "MAINTENNACE INCHARGES": maintenanceIncharges,
          "GEAR BOX TEAM": gearBoxTeam,
          extra,
        } = row;

        // Check if the row exists
        const checkQuery = `
          SELECT * FROM site_area_incharge_mapping 
          WHERE [Functional Location] = @FunctionalLocation
          AND [STATE] = @STATE
          AND [AREA] = @AREA
          AND [SITE] = @SITE
          AND [Maintenance Plant] = @MaintenancePlant
        `;

        const checkRequest = new sql.Request(transaction);
        checkRequest.input("FunctionalLocation", sql.NVarChar, functionalLocation);
        checkRequest.input("STATE", sql.NVarChar, STATE);
        checkRequest.input("AREA", sql.NVarChar, AREA);
        checkRequest.input("SITE", sql.NVarChar, SITE);
        checkRequest.input("MaintenancePlant", sql.NVarChar, maintenancePlant);

        const result = await checkRequest.query(checkQuery);

        if (result.recordset.length > 0) {
          // Row exists, update only changed fields dynamically
          const existingRow = result.recordset[0];

          let updateFields = [];
          let updateRequest = new sql.Request(transaction);

          if (existingRow["STATE ENGG HEAD"] !== stateEnggHead) {
            updateFields.push("[STATE ENGG HEAD] = @StateEnggHead");
            updateRequest.input("StateEnggHead", sql.NVarChar, stateEnggHead);
          }
          if (existingRow["AREA INCHARGE"] !== areaIncharge) {
            updateFields.push("[AREA INCHARGE] = @AreaIncharge");
            updateRequest.input("AreaIncharge", sql.NVarChar, areaIncharge);
          }
          if (existingRow["SITE INCHARGE"] !== siteIncharge) {
            updateFields.push("[SITE INCHARGE] = @SiteIncharge");
            updateRequest.input("SiteIncharge", sql.NVarChar, siteIncharge);
          }
          if (existingRow["STATE PMO"] !== statePmo) {
            updateFields.push("[STATE PMO] = @StatePmo");
            updateRequest.input("StatePmo", sql.NVarChar, statePmo);
          }
          if (existingRow["MAINTENNACE INCHARGES"] !== maintenanceIncharges) {
            updateFields.push("[MAINTENNACE INCHARGES] = @MaintenanceIncharges");
            updateRequest.input("MaintenanceIncharges", sql.NVarChar, maintenanceIncharges);
          }
          if (existingRow["GEAR BOX TEAM"] !== gearBoxTeam) {
            updateFields.push("[GEAR BOX TEAM] = @GearBoxTeam");
            updateRequest.input("GearBoxTeam", sql.NVarChar, gearBoxTeam);
          }
          if (existingRow["extra"] !== extra) {
            updateFields.push("[extra] = @Extra");
            updateRequest.input("Extra", sql.NVarChar, extra);
          }

          if (updateFields.length > 0) {
            const updateQuery = `
              UPDATE site_area_incharge_mapping 
              SET ${updateFields.join(", ")}
              WHERE [Functional Location] = @FunctionalLocation
              AND [STATE] = @STATE
              AND [AREA] = @AREA
              AND [SITE] = @SITE
              AND [Maintenance Plant] = @MaintenancePlant
            `;

            updateRequest.input("FunctionalLocation", sql.NVarChar, functionalLocation);
            updateRequest.input("STATE", sql.NVarChar, STATE);
            updateRequest.input("AREA", sql.NVarChar, AREA);
            updateRequest.input("SITE", sql.NVarChar, SITE);
            updateRequest.input("MaintenancePlant", sql.NVarChar, maintenancePlant);

            await updateRequest.query(updateQuery);
            console.log("Updated record:", functionalLocation);
          }
        } else {
          // Insert new row if no match found
          const insertQuery = `
            INSERT INTO site_area_incharge_mapping 
            ([Functional Location], [STATE], [AREA], [SITE], [Maintenance Plant], [STATE ENGG HEAD], [AREA INCHARGE], [SITE INCHARGE], [STATE PMO], [MAINTENNACE INCHARGES], [GEAR BOX TEAM], [extra])
            VALUES 
            (@FunctionalLocation, @STATE, @AREA, @SITE, @MaintenancePlant, @StateEnggHead, @AreaIncharge, @SiteIncharge, @StatePmo, @MaintenanceIncharges, @GearBoxTeam, @Extra)
          `;

          const insertRequest = new sql.Request(transaction);
          insertRequest.input("FunctionalLocation", sql.NVarChar, functionalLocation);
          insertRequest.input("STATE", sql.NVarChar, STATE);
          insertRequest.input("AREA", sql.NVarChar, AREA);
          insertRequest.input("SITE", sql.NVarChar, SITE);
          insertRequest.input("MaintenancePlant", sql.NVarChar, maintenancePlant);
          insertRequest.input("StateEnggHead", sql.NVarChar, stateEnggHead);
          insertRequest.input("AreaIncharge", sql.NVarChar, areaIncharge);
          insertRequest.input("SiteIncharge", sql.NVarChar, siteIncharge);
          insertRequest.input("StatePmo", sql.NVarChar, statePmo);
          insertRequest.input("MaintenanceIncharges", sql.NVarChar, maintenanceIncharges);
          insertRequest.input("GearBoxTeam", sql.NVarChar, gearBoxTeam);
          insertRequest.input("Extra", sql.NVarChar, extra);

          await insertRequest.query(insertQuery);
          console.log("Inserted new record:", functionalLocation);
        }
      }

      await transaction.commit();
      console.log("Transaction committed successfully.");
    } catch (error) {
      await transaction.rollback();
      console.error("Transaction rolled back due to error:", error);
      throw error;
    }

    fs.unlink(filePath, () => {});
    res.json({ success: true, message: "Data updated/inserted successfully." });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).send("Error processing file");
  }
});

module.exports = router;
