const sql = require('mssql');

// Configuration for the database connection
const config = {
    user: 'meetsomaiya', // update with your username
    password: 'Kitkat998', // update with your password
    server: 'SGHMHPUN03784L', // update with your server name
    database: 'Meet', // update with your database name
    options: {
        encrypt: false, // Use true if you want to encrypt the connection
        trustServerCertificate: true, // Use true if you want to trust self-signed certs
        connectionTimeout: 30000, // Set your connection timeout
    },
};

// Function to connect to the database using mssql
async function connectToDatabase() {
    try {
        // Create a connection pool
        const pool = await sql.connect(config);
        console.log('Connected to the database.');

        // Optional: Execute a simple query to test the connection
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
        const dbPool = await connectToDatabase();
        console.log('Hello from mssql!');
        // Use the dbPool as needed
        // Don't forget to close the connection pool when done
        await dbPool.close();
    } catch (error) {
        console.error('Error:', error);
    }
})();

// Export only the connectToDatabase function
module.exports = { connectToDatabase };
