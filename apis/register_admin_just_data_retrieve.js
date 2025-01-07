const express = require('express');
const fs = require('fs');  // Required for file system operations
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

// POST route to handle the registration data
router.post('/', async (req, res) => {
    try {
        // Get the data sent from the frontend
        const { domainId, name, email, access, adminType } = req.body;

        // Log the received data
        console.log("Received data:", { domainId, name, email, access, adminType });

        // Prepare data to be saved in the JSON file
        const dataToSave = {
            domainId,
            name,
            email,
            access,
            adminType,
            registrationDate: new Date().toISOString() // Adding a timestamp for when the registration happened
        };

        // Read the existing data from the file
        fs.readFile('admin_registration.json', 'utf8', (err, data) => {
            if (err) {
                // If the file does not exist or is empty, create a new array
                fs.writeFile('admin_registration.json', JSON.stringify([dataToSave], null, 2), (err) => {
                    if (err) {
                        console.error("Error writing to file:", err);
                        return res.status(500).json({ success: false, message: "Error saving registration data" });
                    }
                    res.status(200).json({ success: true, message: "Registration saved successfully" });
                });
            } else {
                // If the file exists, append the new data
                const existingData = JSON.parse(data);
                existingData.push(dataToSave);

                // Write the updated data to the file
                fs.writeFile('admin_registration.json', JSON.stringify(existingData, null, 2), (err) => {
                    if (err) {
                        console.error("Error writing to file:", err);
                        return res.status(500).json({ success: false, message: "Error saving registration data" });
                    }
                    res.status(200).json({ success: true, message: "Registration saved successfully" });
                });
            }
        });
    } catch (error) {
        // Handle any errors that occurred during the process
        console.error("Error:", error);
        res.status(500).json({
            success: false,
            message: 'Error handling the registration request.',
            error: error.message,
        });
    }
});

// Export the router
module.exports = router;
