// db.js — PostgreSQL wrapper with SQLite-compatible API
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Convert SQLite-style ? placeholders to PostgreSQL $1, $2, ...
function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Convert SQLite-specific SQL to PostgreSQL
function convertSQL(sql) {
  let converted = convertPlaceholders(sql);
  
  // INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING
  if (/INSERT OR IGNORE/i.test(converted)) {
    converted = converted.replace(/INSERT OR IGNORE/gi, 'INSERT');
    // We add ON CONFLICT DO NOTHING if it doesn't have one
    if (!/ON CONFLICT/i.test(converted)) {
      converted += ' ON CONFLICT DO NOTHING';
    }
  }

  // DATETIME → TIMESTAMP
  converted = converted.replace(/DATETIME/gi, 'TIMESTAMP');
  // INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY
  converted = converted.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
  return converted;
}

const db = {
  // db.run(sql, params, callback) — for INSERT/UPDATE/DELETE
  run(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    const pgSQL = convertSQL(sql);
    const pgParams = params || [];

    // For INSERT statements, add RETURNING id to get lastID if not present
    let finalSQL = pgSQL;
    if (/^\s*INSERT/i.test(pgSQL) && !/RETURNING/i.test(pgSQL) && !/ON CONFLICT DO NOTHING/i.test(pgSQL)) {
      finalSQL = pgSQL + ' RETURNING id';
    }

    pool.query(finalSQL, pgParams)
      .then(result => {
        if (callback) {
          const context = {
            lastID: result.rows?.[0]?.id || 0,
            changes: result.rowCount || 0
          };
          callback.call(context, null);
        }
      })
      .catch(err => {
        // Silently ignore duplicate key / conflict errors (like INSERT OR IGNORE)
        if (err.code === '23505') {
          if (callback) {
            const context = { lastID: 0, changes: 0 };
            callback.call(context, null);
          }
          return;
        }
        // Silently ignore "column already exists" (for ALTER TABLE ADD COLUMN)
        if (err.code === '42701') {
          if (callback) callback.call({ lastID: 0, changes: 0 }, null);
          return;
        }
        if (callback) callback(err);
        else console.error('DB run error:', err.message);
      });
  },

  // db.get(sql, params, callback) — for SELECT single row
  get(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    const pgSQL = convertSQL(sql);
    pool.query(pgSQL, params || [])
      .then(result => {
        if (callback) callback(null, result.rows[0] || null);
      })
      .catch(err => {
        if (callback) callback(err, null);
        else console.error('DB get error:', err.message);
      });
  },

  // db.all(sql, params, callback) — for SELECT multiple rows
  all(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    const pgSQL = convertSQL(sql);
    pool.query(pgSQL, params || [])
      .then(result => {
        if (callback) callback(null, result.rows || []);
      })
      .catch(err => {
        if (callback) callback(err, []);
        else console.error('DB all error:', err.message);
      });
  },

  // db.serialize(fn) — just execute immediately (PostgreSQL handles concurrency)
  serialize(fn) {
    if (fn) fn();
  },

  // Close the pool
  close() {
    pool.end();
  }
};

module.exports = db;
