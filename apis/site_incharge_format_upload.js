const express = require("express");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const multer = require("multer");
const { connectToMSSQL, sql } = require("./connect8.js");

const router = express.Router();

router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Max-Age", "3600");
  next();
});

router.use(express.json());

const upload = multer({ dest: "uploads/" });

const isValidMaintenancePlant = (value) => {
  return /^\d{4}$/.test(value.toString());
};

const getNullableValue = (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

const columnMapping = {
  "SAP FUNCTIONAL LOCATION": "Functional Location",
  "STATE": "STATE",
  "NEW AREA": "AREA",
  "NEW MAIN SITE": "SITE",
  "Maintenance Plant": "Maintenance Plant",
  "STATE ENGG HEAD": "STATE ENGG HEAD",
  "AREA INCHARGE (NEW)": "AREA INCHARGE",
  "SITE INCHARGES": "SITE INCHARGE",
  "STATE PMO": "STATE PMO",
  "MAINTENNACE INCHARGES": "MAINTENNACE INCHARGES",
  "GEAR BOX TEAM": "GEAR BOX TEAM"
};

router.post("/", upload.single("file"), async (req, res) => {
  const filePath = req.file.path;
  console.log("Uploaded file path:", filePath);

  try {
    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    let sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);

    console.log("Original Excel Data:", sheetData);

    sheetData = sheetData.map(row => {
      return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [columnMapping[key.trim()] || key.trim(), value])
      );
    });

    const pool = await connectToMSSQL();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      console.log("Deleting all records from site_area_incharge_mapping...");
      await new sql.Request(transaction).query("DELETE FROM site_area_incharge_mapping");
      console.log("All records deleted successfully.");

      console.log("Inserting new records...");
      for (const row of sheetData) {
        const maintenancePlant = row["Maintenance Plant"] ? parseInt(row["Maintenance Plant"], 10) : null;

        if (!row["Functional Location"] || !row["STATE"] || !row["SITE"] || !maintenancePlant || !isValidMaintenancePlant(maintenancePlant)) {
          console.warn("Skipping row due to missing or invalid fields:", row);
          continue;
        }

        console.log("Inserting:", row);

        const insertQuery = `
          INSERT INTO site_area_incharge_mapping 
          ([Functional Location], [STATE], [AREA], [SITE], [Maintenance Plant], [STATE ENGG HEAD], 
          [AREA INCHARGE], [SITE INCHARGE], [STATE PMO], [MAINTENNACE INCHARGES], [GEAR BOX TEAM])
          VALUES 
          (@FunctionalLocation, @STATE, @AREA, @SITE, @MaintenancePlant, @StateEnggHead, 
          @AreaIncharge, @SiteIncharge, @StatePmo, @MaintenanceIncharges, @GearBoxTeam)
        `;

        const insertRequest = new sql.Request(transaction);
        insertRequest.input("FunctionalLocation", sql.NVarChar, row["Functional Location"]);
        insertRequest.input("STATE", sql.NVarChar, row["STATE"]);
        insertRequest.input("AREA", sql.NVarChar, row["AREA"]);
        insertRequest.input("SITE", sql.NVarChar, row["SITE"]);
        insertRequest.input("MaintenancePlant", sql.Int, maintenancePlant);
        insertRequest.input("StateEnggHead", sql.NVarChar, getNullableValue(row["STATE ENGG HEAD"]));
        insertRequest.input("AreaIncharge", sql.NVarChar, getNullableValue(row["AREA INCHARGE"]));
        insertRequest.input("SiteIncharge", sql.NVarChar, getNullableValue(row["SITE INCHARGE"]));
        insertRequest.input("StatePmo", sql.NVarChar, getNullableValue(row["STATE PMO"]));
        insertRequest.input("MaintenanceIncharges", sql.NVarChar, getNullableValue(row["MAINTENNACE INCHARGES"]));
        insertRequest.input("GearBoxTeam", sql.NVarChar, getNullableValue(row["GEAR BOX TEAM"]));

        try {
          await insertRequest.query(insertQuery);
        } catch (error) {
          console.error("Error executing INSERT query for row:", row, "Error:", error);
          throw error;
        }
      }

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
    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting uploaded file:", err);
      else console.log("Uploaded file deleted successfully.");
    });
  }
});

module.exports = router;
