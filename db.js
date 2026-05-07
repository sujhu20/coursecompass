// db.js — Dual Database Wrapper
// Uses PostgreSQL when DATABASE_URL exists (Vercel/Production)
// Uses SQLite when DATABASE_URL is missing (Local Development)

let dbUrl = process.env.SUPABASE_URL || process.env.DATABASE_URL || '';

// STRICT SANITIZATION: Remove any whitespace or accidental '*' characters
dbUrl = dbUrl.trim().replace(/^\*+|\*+$/g, '');

const isPostgres = dbUrl.length > 10 && dbUrl.startsWith('postgres');

// Debug: log what URL we are using (hide password)
if (dbUrl) {
  const safeUrl = dbUrl.replace(/:([^@]+)@/, ':***@');
  console.log('Database Connection Attempt:', isPostgres ? 'PostgreSQL' : 'SQLite');
  if (isPostgres) console.log('URL Host:', safeUrl.split('@')[1]);
}

if (isPostgres) {
  // ════════════════ POSTGRESQL MODE ════════════════
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  // Test connection
  pool.query('SELECT NOW()')
    .then(() => console.log('✅ PostgreSQL connected (Production)'))
    .catch(err => console.error('❌ PostgreSQL connection failed:', err.message));

  // Convert SQLite ? placeholders to PostgreSQL $1, $2, ...
  function convertPlaceholders(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  // Convert SQLite-specific syntax to PostgreSQL
  function convertSQL(sql) {
    let converted = convertPlaceholders(sql);

    // INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING
    if (/INSERT OR IGNORE/i.test(converted)) {
      converted = converted.replace(/INSERT OR IGNORE/gi, 'INSERT');
      if (!/ON CONFLICT/i.test(converted)) {
        converted += ' ON CONFLICT DO NOTHING';
      }
    }

    // SQLite types → PostgreSQL types
    converted = converted.replace(/DATETIME/gi, 'TIMESTAMP');
    converted = converted.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');

    return converted;
  }

  const db = {
    run(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      const pgSQL = convertSQL(sql);

      // Add RETURNING id for INSERTs (to support this.lastID)
      let finalSQL = pgSQL;
      if (/^\s*INSERT/i.test(pgSQL) && !/RETURNING/i.test(pgSQL) && !/ON CONFLICT DO NOTHING/i.test(pgSQL)) {
        finalSQL = pgSQL + ' RETURNING id';
      }

      pool.query(finalSQL, params || [])
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
          // Silently ignore duplicate key errors (like INSERT OR IGNORE)
          if (err.code === '23505') {
            if (callback) callback.call({ lastID: 0, changes: 0 }, null);
            return;
          }
          // Silently ignore "column already exists"
          if (err.code === '42701') {
            if (callback) callback.call({ lastID: 0, changes: 0 }, null);
            return;
          }
          // Silently ignore "relation already exists"
          if (err.code === '42P07') {
            if (callback) callback.call({ lastID: 0, changes: 0 }, null);
            return;
          }
          if (callback) callback(err);
          else console.error('DB run error:', err.message);
        });
    },

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

    serialize(fn) { if (fn) fn(); },
    close() { pool.end(); }
  };

  module.exports = db;

} else {
  // ════════════════ SQLITE MODE ════════════════
  const sqlite3 = require('sqlite3').verbose();
  
  const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
      console.error('❌ SQLite connection failed:', err.message);
    } else {
      console.log('✅ SQLite connected (Local Development)');
    }
  });

  module.exports = db;
}
