const express = require('express');
const odbc = require('odbc');
const fs = require('fs'); // Import the file system module
// const { connectToDatabase } = require('./connect.js'); // Your database connection module
// const { connectToDatabase } = require('./connect_prod.js'); // Your database connection module
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

// Middleware to parse JSON bodies
router.use(express.json());

// Route to handle GET request
router.get('/', async (req, res) => {
    // Extract parameters from query
    // const zextRNO = req.query.orderType || '';
    // const selectedState = req.query.state || '';
    // const selectedArea = req.query.area || '';
    // const selectedSite = req.query.site || '';
    // const startDate = req.query.fromDate || null;
    // const endDate = req.query.toDate || null;

    const zextRNO = req.query.orderType || '';
    const selectedState = (req.query.state && req.query.state !== 'Select') ? req.query.state : '';
    const selectedArea = (req.query.area && req.query.area !== 'Select') ? req.query.area : '';
    const selectedSite = (req.query.site && req.query.site !== 'Select') ? req.query.site : '';
    const startDate = req.query.fromDate || null;
    const endDate = req.query.toDate || null;

    // Check if ZEXT_RNO is empty
    if (!zextRNO) {
        return res.status(400).json({ message: 'ZEXT_RNO is required.' });
    }

    // Prepare the base query to fetch the desired columns based on ZEXT_RNO
    let query = `SELECT [FUNCT_LOC], [PLANT], [CRM_ORDERH], [ZTEXT1], [ZACTENDT], [ZACTSTDT], [ZEXT_RNO], [ZREQ_SDAT]
                 FROM Schedule_plan_lubrication 
                 WHERE ZEXT_RNO = ? 
                 AND ZTEXT1 NOT IN ('Deletion Flag')
                 AND [PLANT] NOT LIKE 'T%'`;
    const params = [zextRNO];

    // Add conditions based on selected state, area, and site
    if (selectedState) {
        query += ` AND [PLANT] IN (SELECT DISTINCT [Maintenance_Plant] FROM installedbase WHERE State = ?)`;
        params.push(selectedState);
    }

    if (selectedArea) {
        query += ` AND [PLANT] IN (SELECT DISTINCT [Maintenance_Plant] FROM installedbase WHERE Area = ?)`;
        params.push(selectedArea);
    }

    if (selectedSite) {
        query += ` AND [PLANT] IN (SELECT DISTINCT [Maintenance_Plant] FROM installedbase WHERE Site = ?)`;
        params.push(selectedSite);
    }

    // Check if start and end dates are set
    if (startDate && endDate) {
        query += ` AND [ZREQ_SDAT] >= ? AND [ZREQ_SDAT] <= ?`;
        params.push(startDate);
        params.push(endDate);
    }

    try {
        const connection = await connectToDatabase();
        const rows = await connection.query(query, params);

          // Create an object to hold state-wise counts
        //   const stateWiseCounts = {};

        //   // Fetch the state for each plant and accumulate counts
        //   for (const row of rows) {
        //       const plant = row.PLANT;
  
        //       // Query to get the state for the current plant
        //       const stateQuery = `SELECT State FROM installedbase WHERE Maintenance_Plant = ?`;
        //       const stateResult = await connection.query(stateQuery, [plant]);
  
        //       if (stateResult.length > 0) {
        //           const state = stateResult[0].State;
        //           stateWiseCounts[state] = (stateWiseCounts[state] || 0) + 1; // Increment the count for this state
        //       }
        //   }
  

        // Process the fetched rows
        const today = new Date();
        rows.forEach(row => {
            const actEnd = new Date(`${row.ZACTENDT.slice(0, 4)}-${row.ZACTENDT.slice(4, 6)}-${row.ZACTENDT.slice(6, 8)}`);
            const reqStart = new Date(`${row.ZREQ_SDAT.slice(0, 4)}-${row.ZREQ_SDAT.slice(4, 6)}-${row.ZREQ_SDAT.slice(6, 8)}`);

            // Calculate the difference between ZACTENDT and ZREQ_SDAT
            let difference = Math.floor((reqStart - actEnd) / (1000 * 60 * 60 * 24));

            // Check if ZREQ_SDAT is earlier than ZACTENDT
            if (reqStart < actEnd) {
                difference = Math.abs(difference);
            } else {
                difference = -difference;
            }

            row.delay = difference;

            // Formatting dates and handling 'open' or 'in process' status
            if (['open', 'in process'].includes(row.ZTEXT1.toLowerCase())) {
                row.ZACTENDT = '-';
                row.ZACTSTDT = '-';
                const zreq_sdat = new Date(`${row.ZREQ_SDAT.slice(0, 4)}-${row.ZREQ_SDAT.slice(4, 6)}-${row.ZREQ_SDAT.slice(6, 8)}`);
                if (zreq_sdat) {
                    row.delay = Math.floor((zreq_sdat - today) / (1000 * 60 * 60 * 24));
                    if (zreq_sdat > today) {
                        row.delay = -row.delay;
                    }
                } else {
                    row.delay = null; // Set delay as null if unable to calculate
                }
                row.ZREQ_SDAT = zreq_sdat.toLocaleDateString('en-GB'); // Format as dd-mm-yyyy
            } else {
                // Format ZACTENDT and ZACTSTDT columns
                if (row.ZACTENDT) {
                    row.ZACTENDT = actEnd.toLocaleDateString('en-GB'); // Format as dd-mm-yyyy
                }
                if (row.ZACTSTDT) {
                    row.ZACTSTDT = new Date(`${row.ZACTSTDT.slice(0, 4)}-${row.ZACTSTDT.slice(4, 6)}-${row.ZACTSTDT.slice(6, 8)}`).toLocaleDateString('en-GB');
                }
                if (row.ZREQ_SDAT) {
                    row.ZREQ_SDAT = reqStart.toLocaleDateString('en-GB'); // Format as dd-mm-yyyy
                }
            }
        });

        // Create a result array containing the total count and fetched rows
        const result = {
            total_count: rows.length,
            // stateWiseCounts, // Include state-wise counts
            data: rows
        };

        // Write the result to total_count_sent_back.json file
        fs.writeFile('total_count_sent_back.json', JSON.stringify(result, null, 2), (err) => {
            if (err) {
                console.error('Error writing to file:', err);
            } else {
                console.log('Data written to total_count_sent_back.json');
            }
        });

        // Return the result as JSON
        res.json(result);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ message: 'An error occurred while fetching data.' });
    }
});

// Export the router
module.exports = router;
