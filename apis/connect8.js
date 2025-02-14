const sql = require('mssql');

// MSSQL Connection Configuration
// const config = {
//     user: 'LubricationPortal_UAT',
//     password: 'Suzlon@123',
//     server: 'SELPUNMBDWEB01',
//     database: 'LubricationPortal',
//     port: 7002,
//     options: {
//         encrypt: false,
//         trustServerCertificate: true,
//         enableArithAbort: true,
//         rowCollectionOnRequestCompletion: true,
//     },
//     connectionTimeout: 30000,
//     requestTimeout: 30000,
// };

const config = {
    user: 'LubricationPortal',
    password: 'djiguhjsgyt2345dfg',
    server: 'SELPUNPWRBI02', // Use only the main server name
    database: 'LubricationPortal',
    port: 1433, // Use explicit port
    options: {
        encrypt: false, // Same as ODBC `Encrypt=no`
        trustServerCertificate: true, // Same as ODBC `TrustServerCertificate=yes`
        enableArithAbort: true, // Prevents certain query issues
        rowCollectionOnRequestCompletion: true, // Ensures proper row handling
    },
    connectionTimeout: 30000,  // 30 seconds
    requestTimeout: 30000,
};

// Function to connect to MSSQL and return a connection pool
async function connectToMSSQL() {
    try {
        const pool = await sql.connect(config);
        console.log('✅ Connected to MSSQL database');
        return pool; // Return the connection pool for further queries
    } catch (err) {
        console.error('❌ Database connection error:', err);
        throw err;
    }
}

module.exports = { connectToMSSQL, sql }; 
