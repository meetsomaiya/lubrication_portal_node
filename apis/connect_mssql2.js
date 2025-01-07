const sql = require('mssql');

// SQL Server connection configuration
const config = {
    user: 'meetsomaiya',
    password: 'Kitkat998',
    server: 'SGHMHPUN03784L', // Use the IP address or server name
    database: 'Meet',
    options: {
        encrypt: false, // For Azure SQL Database
        trustServerCertificate: true, // Change to true for local dev / self-signed certs
    },
};

// Function to connect to the database using mssql
async function connectToDatabase() {
    try {
        // Establish a connection using mssql
        const pool = await sql.connect(config);
        console.log('Connected to the database using mssql.');

        // Optional: You can execute a simple query to test the connection
        const result = await pool.request().query('SELECT 1 AS test');
        console.log('Test query result:', result.recordset);

        return pool; // Return the pool for further use
    } catch (err) {
        console.error('Database connection failed:', err);
        throw err; // Re-throw the error for handling upstream
    }
}

// Example usage of the connectToDatabase function
(async () => {
    try {
        const dbConnection = await connectToDatabase();
        // Use the dbConnection as needed
        // Don't forget to close the connection when done
        await dbConnection.close();
    } catch (error) {
        console.error('Error:', error);
    }
})();

// Export only the connectToDatabase function
module.exports = { connectToDatabase };
