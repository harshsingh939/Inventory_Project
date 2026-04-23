const mysql = require('mysql2');

const db = mysql.createConnection({
  host:  'localhost',
  user: 'root',
  password: 'root123',
  database: 'inventory_system',
   port: 3307
});

db.connect(err => {
  if (err) {
    console.log(err);
  } else {
    console.log('DB Connected ✅');
  }
});

module.exports = db;