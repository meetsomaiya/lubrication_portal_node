const sql = require('mssql');

// MSSQL Connection Configuration (Matching ODBC)
const config = {
    user: 'LubricationPortal_UAT',
    password: 'Suzlon@123',
    server: 'SELPUNMBDWEB01', // Use only the main server name
    database: 'LubricationPortal',
    port: 7002, // Use explicit port
    options: {
        encrypt: false, // Same as ODBC `Encrypt=no`
        trustServerCertificate: true, // Same as ODBC `TrustServerCertificate=yes`
        enableArithAbort: true, // Prevents certain query issues
        rowCollectionOnRequestCompletion: true, // Ensures proper row handling
    },
    connectionTimeout: 30000,  // 30 seconds
    requestTimeout: 30000,
};

// Function to connect to MSSQL
async function connectToMSSQL(qry) {
    let pool;
    try {
        pool = await sql.connect(config);
        console.log('✅ Connected to MSSQL database');

        // Execute the query
        const result = await pool.request().query(qry);
        console.log('✅ Query result:', result.recordset);
        return result.recordset;
    } catch (err) {
        console.error('❌ Error executing query:', err);
        throw err;
    } finally {
        if (pool) {
            pool.close(); // Always close the connection pool
        }
    }
}

module.exports = { connectToMSSQL };
