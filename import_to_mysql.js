const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function importData() {
  const mysqlUrl = process.env.MYSQL_URL;
  if (!mysqlUrl) {
    console.error('❌ Error: MYSQL_URL not found in .env file!');
    return;
  }

  console.log('⏳ Connecting to Aiven MySQL...');
  const connection = await mysql.createConnection(mysqlUrl);

  try {
    const sql = fs.readFileSync('./migration.sql', 'utf8');
    const statements = sql.split(';\n');

    console.log(`⏳ Importing ${statements.length} data blocks...`);
    
    for (let statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
      }
    }

    console.log('✅ All data uploaded to Aiven successfully!');
  } catch (err) {
    console.error('❌ Import failed:', err.message);
  } finally {
    await connection.end();
  }
}

importData();
