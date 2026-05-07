// db.js — Dual Database Wrapper (MySQL + SQLite)
// Uses MySQL when MYSQL_URL exists (Vercel/Production)
// Uses SQLite when MYSQL_URL is missing (Local Development)

const isMySQL = !!process.env.MYSQL_URL;

if (isMySQL) {
  // ════════════════ MYSQL MODE ════════════════
  const mysql = require('mysql2/promise');
  
  // Create a connection pool
  const pool = mysql.createPool(process.env.MYSQL_URL);

  console.log('✅ MySQL Pool Created (Production)');

  // Convert SQLite ? placeholders to MySQL (MySQL also uses ?)
  // So no placeholder conversion needed!
  
  const db = {
    async run(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      
      // Convert SQLite syntax to MySQL
      let mySQL = sql.replace(/INSERT OR IGNORE INTO/gi, 'INSERT IGNORE INTO');
      mySQL = mySQL.replace(/INSERT OR IGNORE/gi, 'INSERT IGNORE');
      mySQL = mySQL.replace(/AUTOINCREMENT/gi, 'AUTO_INCREMENT');
      
      try {
        const [result] = await pool.execute(mySQL, params || []);
        if (callback) {
          const context = {
            lastID: result.insertId || 0,
            changes: result.affectedRows || 0
          };
          callback.call(context, null);
        }
      } catch (err) {
        if (callback) callback(err);
        else console.error('MySQL run error:', err.message);
      }
    },

    async get(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      try {
        const [rows] = await pool.execute(sql, params || []);
        if (callback) callback(null, rows[0] || null);
      } catch (err) {
        console.error('MySQL get error:', err.message, '| SQL:', sql);
        if (callback) callback(err, null);
      }
    },

    async all(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      try {
        const [rows] = await pool.execute(sql, params || []);
        if (callback) callback(null, rows || []);
      } catch (err) {
        console.error('MySQL all error:', err.message, '| SQL:', sql);
        if (callback) callback(err, []);
      }
    },

    serialize(fn) { if (fn) fn(); },
    close() { pool.end(); }
  };

  db.isPostgres = false; // Flag for server.js
  db.isMySQL = true;
  module.exports = db;

} else {
  // ════════════════ SQLITE MODE ════════════════
  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database('./database.db', (err) => {
    if (!err) console.log('✅ SQLite connected (Local Development)');
  });
  db.isMySQL = false;
  module.exports = db;
}
