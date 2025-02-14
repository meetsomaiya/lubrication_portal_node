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

// Helper function to validate Maintenance Plant as a 4-digit number
const isValidMaintenancePlant = (value) => {
  return /^\d{4}$/.test(value.toString());
};

// Helper function to process nullable values
const getNullableValue = (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

router.post("/", upload.single("file"), async (req, res) => {
  const filePath = req.file.path;
  console.log("Uploaded file path:", filePath);

  try {
    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    let sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);

    console.log("Original Excel Data:", sheetData);

    const pool = await connectToMSSQL();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // **Step 1: Delete all records from the table**
      console.log("Deleting all records from site_area_incharge_mapping...");
      await new sql.Request(transaction).query("DELETE FROM site_area_incharge_mapping");
      console.log("All records deleted successfully.");

      // **Step 2: Insert new records**
      console.log("Inserting new records...");
      for (const row of sheetData) {
        // **Extract values and map correctly**
        const functionalLocation = row["SAP FUNCTIONAL LOCATION"];
        const state = row["STATE"];
        const area = row["NEW AREA"];
        const site = row["NEW MAIN SITE"];
        const maintenancePlant = row["Maintenance Plant"] ? parseInt(row["Maintenance Plant"]) : null;
        const stateEnggHead = getNullableValue(row["STATE ENGG HEAD"]);
        const areaIncharge = getNullableValue(row["AREA INCHARGE ( NEW)"]); // FIXED COLUMN NAME
        const siteIncharge = getNullableValue(row["SITE INCHARGES"]);
        const statePmo = getNullableValue(row["STATE PM0"]); // FIXED COLUMN NAME
        const maintenanceIncharges = getNullableValue(row["MAINTENNACE INCHARGES"]);
        const gearBoxTeam = getNullableValue(row["GEAR BOX TEAM"]);

        // **Debugging Console Log**
        console.log("\n---------------- INSERTING ROW ----------------");
        console.log("Functional Location   :", functionalLocation);
        console.log("STATE                :", state);
        console.log("AREA                 :", area);
        console.log("SITE                 :", site);
        console.log("Maintenance Plant    :", maintenancePlant, typeof maintenancePlant);
        console.log("STATE ENGG HEAD      :", stateEnggHead);
        console.log("AREA INCHARGE        :", areaIncharge);
        console.log("SITE INCHARGE        :", siteIncharge);
        console.log("STATE PMO            :", statePmo);
        console.log("MAINTENANCE INCHARGES:", maintenanceIncharges);
        console.log("GEAR BOX TEAM        :", gearBoxTeam);
        console.log("-----------------------------------------------\n");

        // **Validate Maintenance Plant**
        if (!maintenancePlant || !isValidMaintenancePlant(maintenancePlant)) {
          console.error(Skipping row due to invalid Maintenance Plant: ${row["Maintenance Plant"]});
          continue; // Skip invalid rows
        }

        // **Insert Query**
        const insertQuery = 
          INSERT INTO site_area_incharge_mapping 
          ([Functional Location], [STATE], [AREA], [SITE], [Maintenance Plant], [STATE ENGG HEAD], 
          [AREA INCHARGE], [SITE INCHARGE], [STATE PMO], [MAINTENNACE INCHARGES], [GEAR BOX TEAM])
          VALUES 
          (@FunctionalLocation, @STATE, @AREA, @SITE, @MaintenancePlant, @StateEnggHead, 
          @AreaIncharge, @SiteIncharge, @StatePmo, @MaintenanceIncharges, @GearBoxTeam)
        ;

        const insertRequest = new sql.Request(transaction);
        insertRequest.input("FunctionalLocation", sql.NVarChar, functionalLocation);
        insertRequest.input("STATE", sql.NVarChar, state);
        insertRequest.input("AREA", sql.NVarChar, area);
        insertRequest.input("SITE", sql.NVarChar, site);
        insertRequest.input("MaintenancePlant", sql.Int, maintenancePlant);
        insertRequest.input("StateEnggHead", sql.NVarChar, stateEnggHead);
        insertRequest.input("AreaIncharge", sql.NVarChar, areaIncharge);
        insertRequest.input("SiteIncharge", sql.NVarChar, siteIncharge);
        insertRequest.input("StatePmo", sql.NVarChar, statePmo);
        insertRequest.input("MaintenanceIncharges", sql.NVarChar, maintenanceIncharges);
        insertRequest.input("GearBoxTeam", sql.NVarChar, gearBoxTeam);

        try {
          await insertRequest.query(insertQuery);
        } catch (error) {
          console.error("Error executing INSERT query for row:", row, "Error:", error);
          throw error;
        }
      }

      // **Commit transaction after all insertions**
      await transaction.commit();
      console.log("Transaction committed successfully!");
      res.status(200).json({ success: true, message: "File processed successfully!" });

    } catch (error) {
      await transaction.rollback();
      console.error("Error during transaction:", error);
      res.status(500).json({ success: false, message: "Error during processing" });
    }
  } catch (error) {
    console.error("Error processing the file:", error);
    res.status(500).json({ success: false, message: "Error reading or parsing the file" });
  } finally {
    // Cleanup uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting uploaded file:", err);
      else console.log("Uploaded file deleted successfully.");
    });
  }
});

module.exports = router;