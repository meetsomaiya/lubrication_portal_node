const sql = require('mssql');

// ODBC Connection String
const config = {
    user: 'FleetM',
    password: 'Suzlon@123',
    server: 'SELPUNMBDWEB01',
    port: 7002,
    database: 'Fleet_Manager_DB',
    options: {
        encrypt: false, // Use 'true' if SSL is enabled on your server
        trustServerCertificate: true,
        rowCollectionOnRequestCompletion: true, // Ensures rows are collected correctly
        enableArithAbort: true, // Ensure ArithAbort is set for reliable query execution
    },
    connectionTimeout: 30000,  // Set connection timeout (in ms)
    requestTimeout: 30000,  // Set request timeout (in ms)
};

async function connectToMSSQL(qry) {
    let pool;
    try {
        pool = await sql.connect(config);
        console.log('Connected to MSSQL database');
        
        // Execute the query and return the result
        const result = await pool.request().query(qry);
        console.log('Query result:', result.recordset);
        return result.recordset;  // Return the query results
    } catch (err) {
        console.error('Error executing query:', err);
        throw err; // Re-throw error for further handling in route
    } finally {
        if (pool) {
            pool.close(); // Ensure the pool is closed even on error
        }
    }
}

module.exports = { connectToMSSQL };
