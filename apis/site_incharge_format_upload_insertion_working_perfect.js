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

// // Validate if Maintenance Plant is a valid 4-digit integer
// const isValidMaintenancePlant = (value) => {
//   return Number.isInteger(value) && value >= 1000 && value <= 9999;
// };

// Function to handle STATE PMO (Ensure it's valid or NULL)
const getStatePmo = (value) => {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();  // Return the valid STATE PMO as a string
  }
  return null;  // Return null if empty or invalid
};

// Validate if Maintenance Plant is a 4-digit number (as a number or string)
const isValidMaintenancePlant = (value) => {
  if (typeof value === "string") {
    return /^\d{4}$/.test(value); // Check if it's exactly 4 digits
  }
  return Number.isInteger(value) && value.toString().length === 4; // Ensure it's a 4-digit number
};


// Function to handle GEAR BOX TEAM
const getGearBoxTeam = (value) => {
  if (value === "NA") {
    return "NA";  // Ensure "NA" is treated as a string
  } else if (typeof value === "string" && value.trim() !== "") {
    return value;  // Return the valid email or string as is
  }
  return null;  // If value is null or undefined, return NULL for SQL
};

// Add the check to ensure 'MaintenanceIncharges' is always a string or null
const getMaintenanceIncharges = (value) => {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();  // Return the email or string as is
  }
  return null;  // If value is invalid or empty, return NULL
};

// Function to handle AREA INCHARGE (NEW)
const getAreaIncharge = (value) => {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();  // Return the valid area incharge as string
  }
  return null;  // Return null if empty or invalid
};

router.post("/", upload.single("file"), async (req, res) => {
  const filePath = req.file.path;
  console.log("Uploaded file path:", filePath);

  try {
    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    let sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);

    console.log("Original Excel Data:", sheetData);

    // Remove "extra" field from sheetData if it's not needed
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
      console.log("Executing SQL Query:", checkTableQuery);  // Log the SQL query
      const tableCheckResult = await new sql.Request(transaction).query(checkTableQuery);
      const totalCount = tableCheckResult.recordset[0].totalCount;

      if (totalCount === 0) {
        console.log("Table is empty. Inserting all rows...");

        for (const row of sheetData) {
          // Check if Maintenance Plant is a valid 4-digit number before inserting
          if (!isValidMaintenancePlant(row["Maintenance Plant"])) {
            console.error(`Invalid Maintenance Plant value for row: ${row["SAP FUNCTIONAL LOCATION"]}`);
            continue; // Skip this row if the value is invalid
          }

          const insertQuery = `
            INSERT INTO site_area_incharge_mapping 
            ([Functional Location], [STATE], [AREA], [SITE], [Maintenance Plant], [STATE ENGG HEAD], [AREA INCHARGE], [SITE INCHARGE], [STATE PMO], [MAINTENNACE INCHARGES], [GEAR BOX TEAM])
            VALUES 
            (@FunctionalLocation, @STATE, @AREA, @SITE, @MaintenancePlant, @StateEnggHead, @AreaIncharge, @SiteIncharge, @StatePmo, @MaintenanceIncharges, @GearBoxTeam)
          `;
          console.log("Executing SQL Query:", insertQuery);  // Log the SQL query

          const insertRequest = new sql.Request(transaction);
          insertRequest.input("FunctionalLocation", sql.NVarChar, row["SAP FUNCTIONAL LOCATION"]);
          insertRequest.input("STATE", sql.NVarChar, row["STATE"]);
          insertRequest.input("AREA", sql.NVarChar, row["NEW AREA"]);
          insertRequest.input("SITE", sql.NVarChar, row["NEW MAIN SITE"]);
          insertRequest.input("MaintenancePlant", sql.Int, row["Maintenance Plant"]);  // Corrected to sql.Int
          insertRequest.input("StateEnggHead", sql.NVarChar, row["STATE ENGG HEAD"]);
          insertRequest.input("AreaIncharge", sql.NVarChar, getAreaIncharge(row["AREA INCHARGE (NEW)"]));  // Handle AREA INCHARGE (NEW)
          insertRequest.input("SiteIncharge", sql.NVarChar, row["SITE INCHARGES"]);
          insertRequest.input("StatePmo", sql.NVarChar, row["STATE PM0"]);
          insertRequest.input("MaintenanceIncharges", sql.NVarChar, getMaintenanceIncharges(row["MAINTENNACE INCHARGES"]));  // Ensure it's a valid string
          insertRequest.input("GearBoxTeam", sql.NVarChar, getGearBoxTeam(row["GEAR BOX TEAM"]));  // Handle GEAR BOX TEAM correctly

          try {
            await insertRequest.query(insertQuery);
          } catch (error) {
            console.error("Error executing INSERT query:", error);  // Log the error
            throw error;  // Rethrow to be handled by the outer catch block
          }
        }
      } else {
        console.log("Table is not empty. Checking for updates...");

        for (const row of sheetData) {
          // Check if Maintenance Plant is a valid 4-digit number before processing
          if (!isValidMaintenancePlant(row["Maintenance Plant"])) {
            console.error(`Invalid Maintenance Plant value for row: ${row["SAP FUNCTIONAL LOCATION"]}`);
            continue; // Skip this row if the value is invalid
          }

          const checkQuery = `
            SELECT * FROM site_area_incharge_mapping 
            WHERE [Functional Location] = @FunctionalLocation
            AND [STATE] = @STATE
            AND [AREA] = @AREA
            AND [SITE] = @SITE
            AND [Maintenance Plant] = @MaintenancePlant
          `;
          console.log("Executing SQL Query:", checkQuery);  // Log the SQL query

          const checkRequest = new sql.Request(transaction);
          checkRequest.input("FunctionalLocation", sql.NVarChar, row["SAP FUNCTIONAL LOCATION"]);
          checkRequest.input("STATE", sql.NVarChar, row["STATE"]);
          checkRequest.input("AREA", sql.NVarChar, row["NEW AREA"]);
          checkRequest.input("SITE", sql.NVarChar, row["NEW MAIN SITE"]);
          checkRequest.input("MaintenancePlant", sql.Int, row["Maintenance Plant"]);  // Corrected to sql.Int

          try {
            const result = await checkRequest.query(checkQuery);

            if (result.recordset.length > 0) {
              const existingRow = result.recordset[0];

              let updateFields = [];
              let updateRequest = new sql.Request(transaction);

              const updateMappings = {
                "STATE ENGG HEAD": "StateEnggHead",
                "AREA INCHARGE (NEW)": "AreaIncharge",
                "SITE INCHARGES": "SiteIncharge",
                "STATE PM0": "StatePmo",
                "MAINTENNACE INCHARGES": "MaintenanceIncharges",
                "GEAR BOX TEAM": "GearBoxTeam",
              };

              Object.keys(updateMappings).forEach((dbColumn) => {
                const excelColumn = updateMappings[dbColumn];
                if (existingRow[dbColumn] !== row[excelColumn]) {
                  updateFields.push(`[${dbColumn}] = @${excelColumn}`);
                  updateRequest.input(excelColumn, sql.NVarChar, row[excelColumn]);
                }
              });

              if (updateFields.length > 0) {
                const updateRequest = new sql.Request(transaction);
            
                // Declare WHERE clause parameters
                updateRequest.input("FunctionalLocation", sql.NVarChar, row["SAP FUNCTIONAL LOCATION"]);
                updateRequest.input("STATE", sql.NVarChar, row["STATE"]);
                updateRequest.input("AREA", sql.NVarChar, row["NEW AREA"]);
                updateRequest.input("SITE", sql.NVarChar, row["NEW MAIN SITE"]);
                updateRequest.input("MaintenancePlant", sql.Int, parseInt(row["Maintenance Plant"]));
            
                // Correctly assign transformed values
                updateRequest.input("StateEnggHead", sql.NVarChar, row["STATE ENGG HEAD"] ? row["STATE ENGG HEAD"].trim() : null);
                updateRequest.input("AreaIncharge", sql.NVarChar, getAreaIncharge(row["AREA INCHARGE (NEW)"]));
                updateRequest.input("SiteIncharge", sql.NVarChar, row["SITE INCHARGES"]);
                updateRequest.input("StatePmo", sql.NVarChar, row["STATE PMO"]);
                updateRequest.input("MaintenanceIncharges", sql.NVarChar, getMaintenanceIncharges(row["MAINTENNACE INCHARGES"]));
                updateRequest.input("GearBoxTeam", sql.NVarChar, getGearBoxTeam(row["GEAR BOX TEAM"]));
            
                // Mapping database column names to request input variables
                const updateMappings = {
                    "STATE ENGG HEAD": "StateEnggHead",
                    "AREA INCHARGE": "AreaIncharge",
                    "SITE INCHARGES": "SiteIncharge",
                    "STATE PMO": "StatePmo",
                    "MAINTENNACE INCHARGES": "MaintenanceIncharges",
                    "GEAR BOX TEAM": "GearBoxTeam"
                };
            
                Object.keys(updateMappings).forEach((dbColumn) => {
                    const inputVariable = updateMappings[dbColumn];
            
                    // Ensure the column is only added once
                    if (!updateFields.includes(`[${dbColumn}] = @${inputVariable}`)) {
                        updateFields.push(`[${dbColumn}] = @${inputVariable}`);
                    }
                });
            
                const updateQuery = `
                    UPDATE site_area_incharge_mapping 
                    SET ${updateFields.join(", ")}
                    WHERE [Functional Location] = @FunctionalLocation
                    AND [STATE] = @STATE
                    AND [AREA] = @AREA
                    AND [SITE] = @SITE
                    AND [Maintenance Plant] = @MaintenancePlant
                `;
            
                console.log("Executing SQL Query:", updateQuery);
                await updateRequest.query(updateQuery);
                console.log("Updated record:", row["SAP FUNCTIONAL LOCATION"]);
            
            } else {
                console.log("Inserting new record:", row["SAP FUNCTIONAL LOCATION"]);
            
                const insertRequest = new sql.Request(transaction);
                insertRequest.input("FunctionalLocation", sql.NVarChar, row["SAP FUNCTIONAL LOCATION"]);
                insertRequest.input("STATE", sql.NVarChar, row["STATE"]);
                insertRequest.input("AREA", sql.NVarChar, row["NEW AREA"]);
                insertRequest.input("SITE", sql.NVarChar, row["NEW MAIN SITE"]);
                insertRequest.input("MaintenancePlant", sql.Int, parseInt(row["Maintenance Plant"]));
                insertRequest.input("StateEnggHead", sql.NVarChar, row["STATE ENGG HEAD"]);
                insertRequest.input("AreaIncharge", sql.NVarChar, getAreaIncharge(row["AREA INCHARGE (NEW)"]));
                insertRequest.input("SiteIncharge", sql.NVarChar, row["SITE INCHARGE"]);
                // insertRequest.input("StatePmo", sql.NVarChar, row["STATE PMO"]);
                insertRequest.input("StatePmo", sql.NVarChar, getStatePmo(row["STATE PMO"]));  // Handle STATE PMO here
                insertRequest.input("MaintenanceIncharges", sql.NVarChar, getMaintenanceIncharges(row["MAINTENNACE INCHARGES"]));
                insertRequest.input("GearBoxTeam", sql.NVarChar, getGearBoxTeam(row["GEAR BOX TEAM"]));
            
                const insertQuery = `
                    INSERT INTO site_area_incharge_mapping 
                    ([Functional Location], [STATE], [AREA], [SITE], [Maintenance Plant], [STATE ENGG HEAD], [AREA INCHARGE], [SITE INCHARGE], [STATE PMO], [MAINTENNACE INCHARGES], [GEAR BOX TEAM])
                    VALUES 
                    (@FunctionalLocation, @STATE, @AREA, @SITE, @MaintenancePlant, @StateEnggHead, @AreaIncharge, @SiteIncharge, @StatePmo, @MaintenanceIncharges, @GearBoxTeam)
                `;
            
                console.log("Executing SQL Query:", insertQuery);
                await insertRequest.query(insertQuery);
            }                        
            }              
          } catch (error) {
            console.error("Error executing SELECT query:", error);  // Log the error
            throw error;  // Rethrow to be handled by the outer catch block
          }
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
  }
});

module.exports = router;
