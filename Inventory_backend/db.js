const mysql = require('mysql2');

/**
 * Vercel / cloud: set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT in project env.
 * Local: defaults match typical dev (override with .env via loadEnvFiles).
 */
const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Root@123',
  database: process.env.DB_NAME || 'inventory_system',
  port: Number(process.env.DB_PORT) || 3306,
};

const db = mysql.createConnection(config);

db.connect((err) => {
  if (err) {
    console.log(err);
  } else {
    console.log('DB Connected ✅');
  }
});

module.exports = db;