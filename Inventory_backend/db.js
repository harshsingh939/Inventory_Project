const mysql = require('mysql2');

const db = mysql.createConnection({
  host:  'localhost',
  user: 'root',
  password: 'Priya@2007',
  database: 'inventory_system',
   port: 3306
});

db.connect(err => {
  if (err) {
    console.log(err);
  } else {
    console.log('DB Connected ✅');
  }
});

module.exports = db;