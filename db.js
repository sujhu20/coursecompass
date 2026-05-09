// db.js — Dual Database Wrapper (MySQL + SQLite)
// Uses MySQL when MYSQL_URL exists (Vercel/Production)
// Uses SQLite when MYSQL_URL is missing (Local Development)

const isMySQL = !!process.env.MYSQL_URL;

if (isMySQL) {
  // ════════════════ MYSQL MODE ════════════════
  const mysql = require('mysql2/promise');

  // Parse the MYSQL_URL and fix SSL for Aiven
  // Aiven uses "ssl-mode=REQUIRED" which mysql2 doesn't understand.
  // We need to strip it and add proper ssl config.
  let connectionUrl = process.env.MYSQL_URL;
  
  // Remove ssl-mode from URL query string (mysql2 doesn't support it)
  connectionUrl = connectionUrl.replace(/[?&]ssl-mode=[^&]*/gi, '');
  // Clean up trailing ? if we removed the only param
  connectionUrl = connectionUrl.replace(/\?$/, '');

  // Create pool with proper SSL config for Aiven
  const pool = mysql.createPool({
    uri: connectionUrl,
    ssl: { rejectUnauthorized: false }, // Required for Aiven cloud MySQL
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    connectTimeout: 10000
  });

  console.log('✅ MySQL Pool Created (Production)');

  const db = {
    async run(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }

      // Convert SQLite syntax to MySQL
      let mySQL = sql.replace(/INSERT OR IGNORE INTO/gi, 'INSERT IGNORE INTO');
      mySQL = mySQL.replace(/INSERT OR IGNORE/gi, 'INSERT IGNORE');
      mySQL = mySQL.replace(/AUTOINCREMENT/gi, 'AUTO_INCREMENT');
      // ON CONFLICT → ON DUPLICATE KEY UPDATE (basic conversion)
      mySQL = mySQL.replace(
        /ON\s+CONFLICT\s*\([^)]+\)\s*DO\s+UPDATE\s+SET\s+/gi,
        'ON DUPLICATE KEY UPDATE '
      );
      // Remove any "excluded." prefix from ON DUPLICATE KEY UPDATE values
      mySQL = mySQL.replace(/excluded\./gi, 'VALUES(');

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
        console.error('MySQL run error:', err.code, err.message, '| SQL:', mySQL.substring(0, 120));
        if (callback) callback(err);
        else console.error('MySQL run error (no callback):', err.message);
      }
    },

    async get(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      try {
        const [rows] = await pool.execute(sql, params || []);
        if (callback) callback(null, rows[0] || null);
      } catch (err) {
        console.error('MySQL get error:', err.code, err.message, '| SQL:', sql.substring(0, 120));
        if (callback) callback(err, null);
      }
    },

    async all(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      try {
        const [rows] = await pool.execute(sql, params || []);
        if (callback) callback(null, rows || []);
      } catch (err) {
        console.error('MySQL all error:', err.code, err.message, '| SQL:', sql.substring(0, 120));
        if (callback) callback(err, []);
      }
    },

    serialize(fn) { if (fn) fn(); },
    close() { pool.end(); }
  };

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
