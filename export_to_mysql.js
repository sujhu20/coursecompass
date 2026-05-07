const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const db = new sqlite3.Database('./database.db');
const outputStream = fs.createWriteStream('./migration.sql');

outputStream.write('SET FOREIGN_KEY_CHECKS = 0;\n\n');

db.serialize(() => {
  // Get all tables
  db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, tables) => {
    if (err) throw err;

    let tablesProcessed = 0;
    tables.forEach((table) => {
      const tableName = table.name;
      
      // Get table data
      db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
        if (err) throw err;

        if (rows.length > 0) {
          outputStream.write(`-- Data for table ${tableName}\n`);
          outputStream.write(`INSERT INTO ${tableName} (${Object.keys(rows[0]).join(', ')}) VALUES\n`);
          
          const values = rows.map(row => {
            const formattedRow = Object.values(row).map(val => {
              if (val === null) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              return val;
            });
            return `(${formattedRow.join(', ')})`;
          });
          
          outputStream.write(values.join(',\n') + ';\n\n');
        }

        tablesProcessed++;
        if (tablesProcessed === tables.length) {
          outputStream.write('SET FOREIGN_KEY_CHECKS = 1;\n');
          console.log('✅ Export complete! Check migration.sql');
          db.close();
        }
      });
    });
  });
});
