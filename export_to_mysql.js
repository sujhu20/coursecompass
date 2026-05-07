const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const db = new sqlite3.Database('./database.db');
const outputStream = fs.createWriteStream('./migration.sql');

outputStream.write('SET FOREIGN_KEY_CHECKS = 0;\n\n');

// ── Define MySQL Schemas for ALL 12 tables ──────────────────────────────
const schemas = {
  users: `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    stream VARCHAR(100),
    percentage FLOAT,
    interests TEXT,
    streak INT DEFAULT 0,
    last_streak_date DATE,
    xp INT DEFAULT 0,
    profile_photo VARCHAR(255),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,
  courses: `CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    stream VARCHAR(100) NOT NULL,
    min_percentage FLOAT NOT NULL,
    description TEXT,
    youtube_id VARCHAR(100),
    duration_months INT
  );`,
  bookmarks: `CREATE TABLE IF NOT EXISTS bookmarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id)
  );`,
  progress: `CREATE TABLE IF NOT EXISTS progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'not_started',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id)
  );`,
  ratings: `CREATE TABLE IF NOT EXISTS ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    stars INT NOT NULL,
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id)
  );`,
  career_map: `CREATE TABLE IF NOT EXISTS career_map (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    career_name VARCHAR(255) NOT NULL,
    job_role VARCHAR(255),
    description TEXT
  );`,
  salary_info: `CREATE TABLE IF NOT EXISTS salary_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    career_id INT NOT NULL,
    entry_level_salary INT,
    mid_level_salary INT,
    senior_level_salary INT
  );`,
  badges: `CREATE TABLE IF NOT EXISTS badges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    badge_type VARCHAR(100) NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, badge_type)
  );`,
  notifications: `CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50),
    \`read\` BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,
  streaks: `CREATE TABLE IF NOT EXISTS streaks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_visit DATE,
    UNIQUE(user_id)
  );`,
  skill_ratings: `CREATE TABLE IF NOT EXISTS skill_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    skill VARCHAR(255) NOT NULL,
    rating INT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE(user_id, skill)
  );`,
  eligibility_rules: `CREATE TABLE IF NOT EXISTS eligibility_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    rule_type VARCHAR(100),
    required_value VARCHAR(255)
  );`
};

db.serialize(() => {
  // Write all DROP and CREATE TABLE statements first
  Object.keys(schemas).forEach(tableName => {
    outputStream.write(`DROP TABLE IF EXISTS ${tableName};\n`);
    outputStream.write(schemas[tableName] + '\n\n');
  });

  // Get all tables
  db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, tables) => {
    if (err) throw err;

    let tablesProcessed = 0;
    tables.forEach((table) => {
      const tableName = table.name;
      
      db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
        if (err) throw err;

        if (rows.length > 0) {
          const columns = Object.keys(rows[0]).map(col => `\`${col}\``);
          outputStream.write(`-- Data for ${tableName}\n`);
          outputStream.write(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n`);
          
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
          console.log('✅ Export complete for all 12 tables! Check migration.sql');
          db.close();
        }
      });
    });
  });
});
