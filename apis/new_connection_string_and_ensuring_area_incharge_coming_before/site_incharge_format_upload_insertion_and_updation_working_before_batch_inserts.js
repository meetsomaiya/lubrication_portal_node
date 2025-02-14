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

    // Remove "extra" field from sheetData
    sheetData = sheetData.map(({ extra, ...row }) => row);

    const jsonFilePath = path.join(__dirname, "site_area_incharge_data_read.json");
    fs.writeFileSync(jsonFilePath, JSON.stringify(sheetData, null, 2));
    console.log("Data saved to site_area_incharge_data_read.json");

    const pool = await connectToMSSQL();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Check if table is empty
      const checkTableQuery = `SELECT COUNT(*) AS totalCount FROM site_area_incharge_mapping`;
      const tableCheckResult = await new sql.Request(transaction).query(checkTableQuery);
      const totalCount = tableCheckResult.recordset[0].totalCount;

      if (totalCount === 0) {
        console.log("Table is empty. Inserting all rows...");

        for (const row of sheetData) {
          const insertQuery = `
            INSERT INTO site_area_incharge_mapping 
            ([Functional Location], [STATE], [AREA], [SITE], [Maintenance Plant], [STATE ENGG HEAD], [AREA INCHARGE], [SITE INCHARGE], [STATE PMO], [MAINTENNACE INCHARGES], [GEAR BOX TEAM], [extra])
            VALUES 
            (@FunctionalLocation, @STATE, @AREA, @SITE, @MaintenancePlant, @StateEnggHead, @AreaIncharge, @SiteIncharge, @StatePmo, @MaintenanceIncharges, @GearBoxTeam, @Extra)
          `;

          const insertRequest = new sql.Request(transaction);
          insertRequest.input("FunctionalLocation", sql.NVarChar, row["SAP FUNCTIONAL LOCATION"]);
          insertRequest.input("STATE", sql.NVarChar, row["STATE"]);
          insertRequest.input("AREA", sql.NVarChar, row["NEW AREA"]);
          insertRequest.input("SITE", sql.NVarChar, row["NEW MAIN SITE"]);
          insertRequest.input("MaintenancePlant", sql.NVarChar, row["Maintenance Plant"]);
          insertRequest.input("StateEnggHead", sql.NVarChar, row["STATE ENGG HEAD"]);
          insertRequest.input("AreaIncharge", sql.NVarChar, row["AREA INCHARGE ( NEW )"]);
          insertRequest.input("SiteIncharge", sql.NVarChar, row["SITE INCHARGES"]);
          insertRequest.input("StatePmo", sql.NVarChar, row["STATE PM0"]);
          insertRequest.input("MaintenanceIncharges", sql.NVarChar, row["MAINTENNACE INCHARGES"]);
          insertRequest.input("GearBoxTeam", sql.NVarChar, row["GEAR BOX TEAM"]);
          insertRequest.input("Extra", sql.NVarChar, row["extra"]);

          await insertRequest.query(insertQuery);
        }
      } else {
        console.log("Table is not empty. Checking for updates...");

        for (const row of sheetData) {
          const checkQuery = `
            SELECT * FROM site_area_incharge_mapping 
            WHERE [Functional Location] = @FunctionalLocation
            AND [STATE] = @STATE
            AND [AREA] = @AREA
            AND [SITE] = @SITE
            AND [Maintenance Plant] = @MaintenancePlant
          `;

          const checkRequest = new sql.Request(transaction);
          checkRequest.input("FunctionalLocation", sql.NVarChar, row["SAP FUNCTIONAL LOCATION"]);
          checkRequest.input("STATE", sql.NVarChar, row["STATE"]);
          checkRequest.input("AREA", sql.NVarChar, row["NEW AREA"]);
          checkRequest.input("SITE", sql.NVarChar, row["NEW MAIN SITE"]);
          checkRequest.input("MaintenancePlant", sql.NVarChar, row["Maintenance Plant"]);

          const result = await checkRequest.query(checkQuery);

          if (result.recordset.length > 0) {
            const existingRow = result.recordset[0];

            let updateFields = [];
            let updateRequest = new sql.Request(transaction);

            const updateMappings = {
              "STATE ENGG HEAD": "StateEnggHead",
              "AREA INCHARGE": "AreaIncharge",
              "SITE INCHARGE": "SiteIncharge",
              "STATE PMO": "StatePmo",
              "MAINTENNACE INCHARGES": "MaintenanceIncharges",
              "GEAR BOX TEAM": "GearBoxTeam",
              "extra": "Extra",
            };

            Object.keys(updateMappings).forEach((dbColumn) => {
              const excelColumn = updateMappings[dbColumn];
              if (existingRow[dbColumn] !== row[excelColumn]) {
                updateFields.push(`[${dbColumn}] = @${excelColumn}`);
                updateRequest.input(excelColumn, sql.NVarChar, row[excelColumn]);
              }
            });

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

              await updateRequest.query(updateQuery);
              console.log("Updated record:", row["SAP FUNCTIONAL LOCATION"]);
            }
          } else {
            console.log("Inserting new record:", row["SAP FUNCTIONAL LOCATION"]);

            const insertRequest = new sql.Request(transaction);
            insertRequest.input("FunctionalLocation", sql.NVarChar, row["SAP FUNCTIONAL LOCATION"]);
            insertRequest.input("STATE", sql.NVarChar, row["STATE"]);
            insertRequest.input("AREA", sql.NVarChar, row["NEW AREA"]);
            insertRequest.input("SITE", sql.NVarChar, row["NEW MAIN SITE"]);
            insertRequest.input("MaintenancePlant", sql.NVarChar, row["Maintenance Plant"]);
            insertRequest.input("StateEnggHead", sql.NVarChar, row["STATE ENGG HEAD"]);
            insertRequest.input("AreaIncharge", sql.NVarChar, row["AREA INCHARGE ( NEW )"]);
            insertRequest.input("SiteIncharge", sql.NVarChar, row["SITE INCHARGES"]);
            insertRequest.input("StatePmo", sql.NVarChar, row["STATE PM0"]);
            insertRequest.input("MaintenanceIncharges", sql.NVarChar, row["MAINTENNACE INCHARGES"]);
            insertRequest.input("GearBoxTeam", sql.NVarChar, row["GEAR BOX TEAM"]);
            insertRequest.input("Extra", sql.NVarChar, row["extra"]);

            const insertQuery = `
              INSERT INTO site_area_incharge_mapping 
              ([Functional Location], [STATE], [AREA], [SITE], [Maintenance Plant], [STATE ENGG HEAD], [AREA INCHARGE], [SITE INCHARGE], [STATE PMO], [MAINTENNACE INCHARGES], [GEAR BOX TEAM], [extra])
              VALUES 
              (@FunctionalLocation, @STATE, @AREA, @SITE, @MaintenancePlant, @StateEnggHead, @AreaIncharge, @SiteIncharge, @StatePmo, @MaintenanceIncharges, @GearBoxTeam, @Extra)
            `;

            await insertRequest.query(insertQuery);
          }
        }
      }

      await transaction.commit();
      res.json({ success: true, message: "Data updated/inserted successfully." });
    } catch (error) {
      await transaction.rollback();
      res.status(500).send("Error processing file");
    }
  } catch (error) {
    res.status(500).send("Error processing file");
  } finally {
    // Ensure file deletion after processing
    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting file:", err);
      else console.log("File deleted successfully:", filePath);
    });
  }
});


module.exports = router;
