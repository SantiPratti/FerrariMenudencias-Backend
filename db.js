const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'santiinti7',
  database: 'ferrari_menudencias'
});

module.exports = pool;
