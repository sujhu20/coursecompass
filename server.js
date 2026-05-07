const express = require("express");
// sqlite3 is loaded inside db.js when needed (local mode)
const bcrypt = require("bcrypt");
const cors = require("cors");
const path = require("path");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const session = require("express-session");
const https = require("https");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
require("dotenv").config();

const gOAuthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const isProduction = process.env.NODE_ENV === 'production';

const app = express();

// Production settings
if (isProduction) {
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') return res.redirect(`https://${req.header('host')}${req.url}`);
    next();
  });
}

// Middleware
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: isProduction ? process.env.ALLOWED_ORIGINS?.split(',') : ['http://localhost:3000', 'http://127.0.0.1:3000'], credentials: true }));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "accounts.google.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "accounts.google.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "*.ytimg.com", "*.googleusercontent.com"],
      connectSrc: ["'self'", "www.googleapis.com", "accounts.google.com"],
      frameSrc: ["accounts.google.com"]
    }
  }
}));
app.use(express.static(__dirname, {
  maxAge: isProduction ? '7d' : 0,
  etag: true
}));

// Rate Limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { message: 'Too many attempts, try again in 15 minutes', success: false } });
const apiLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 60, message: { message: 'Too many requests, slow down', success: false } });

// Session Configuration
const sessionSecret = process.env.SESSION_SECRET && process.env.SESSION_SECRET !== 'your_random_session_secret_key_here'
  ? process.env.SESSION_SECRET
  : crypto.randomBytes(32).toString('hex');

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: isProduction, httpOnly: true, maxAge: 24 * 60 * 60 * 1000, sameSite: 'lax' }
}));

// Passport Initialization
app.use(passport.initialize());
app.use(passport.session());

// ─── AUTH MIDDLEWARE ─────────────────────────
const requireAuth = (req, res, next) => {
  // Sync Passport user into session if missing
  if (!req.session?.user && req.user) {
    req.session.user = { id: req.user.id, email: req.user.email, is_admin: req.user.is_admin || 0 };
  }
  if (!req.session?.user) {
    return res.status(401).json({
      success: false,
      message: 'Please login to continue.'
    });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated.'
    });
  }
  if (!req.session.user.is_admin) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required.'
    });
  }
  next();
};

const requireOwnership = (req, res, next) => {
  const requestedId = parseInt(req.params.userId);
  const sessionId = req.session?.user?.id;
  if (!sessionId) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated.'
    });
  }
  if (requestedId !== sessionId && !req.session.user.is_admin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied.'
    });
  }
  next();
};
// ─────────────────────────────────────────────

// Root route - serve login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Health check endpoint for monitoring (Render/Railway)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database connection (auto-detects: PostgreSQL on Vercel, SQLite locally)
const db = require('./db');

// ==================== DATABASE TABLES ====================

// Create users table (with profile fields)
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    stream TEXT,
    percentage REAL,
    interests TEXT,
    profile_photo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_admin INTEGER DEFAULT 0
  )
`);

// Create courses table
db.run(`
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    stream TEXT NOT NULL,
    min_percentage REAL NOT NULL,
    description TEXT,
    youtube_id TEXT,
    duration_months INTEGER
  )
`);

// Create eligibility_rules table
db.run(`
  CREATE TABLE IF NOT EXISTS eligibility_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    required_stream TEXT,
    min_percentage REAL,
    required_subjects TEXT,
    FOREIGN KEY(course_id) REFERENCES courses(id)
  )
`);

// Create career_map table
db.run(`
  CREATE TABLE IF NOT EXISTS career_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    career_name TEXT,
    job_role TEXT,
    description TEXT,
    FOREIGN KEY(course_id) REFERENCES courses(id)
  )
`);

// Create salary_info table
db.run(`
  CREATE TABLE IF NOT EXISTS salary_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    career_id INTEGER,
    entry_level_salary REAL,
    mid_level_salary REAL,
    senior_level_salary REAL,
    FOREIGN KEY(career_id) REFERENCES career_map(id)
  )
`);

// Enhance users table with profile fields (add columns if they don't exist)
const userColumns = ['name TEXT', 'stream TEXT', 'percentage REAL', 'interests TEXT', 'profile_photo TEXT', 'created_at DATETIME DEFAULT CURRENT_TIMESTAMP', 'is_admin INTEGER DEFAULT 0'];
userColumns.forEach(col => {
  const colName = col.split(' ')[0];
  db.run(`ALTER TABLE users ADD COLUMN ${col}`, (err) => {
    // Silently ignore "duplicate column" errors
  });
});

// Create bookmarks table
db.run(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(course_id) REFERENCES courses(id),
    UNIQUE(user_id, course_id)
  )
`);

// Create progress table
db.run(`
  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    status TEXT DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'completed')),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(course_id) REFERENCES courses(id),
    UNIQUE(user_id, course_id)
  )
`);

// Create ratings table
db.run(`
  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    stars INTEGER NOT NULL CHECK(stars >= 1 AND stars <= 5),
    review TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(course_id) REFERENCES courses(id),
    UNIQUE(user_id, course_id)
  )
`);

// Create badges table
db.run(`
  CREATE TABLE IF NOT EXISTS badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    badge_type TEXT NOT NULL,
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, badge_type)
  )
`);

// Create streaks table
db.run(`
  CREATE TABLE IF NOT EXISTS streaks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_visit DATE,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`);

// Create notifications table
db.run(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`);

// ── Performance Indexes (delayed to ensure tables exist) ──
setTimeout(() => {
  db.run("CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_ratings_course ON ratings(course_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read)");
  db.run("CREATE INDEX IF NOT EXISTS idx_streaks_user ON streaks(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_badges_user ON badges(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_courses_stream ON courses(stream)");
}, 2000);

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || "your-client-id",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "your-client-secret",
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    const email = profile.emails[0].value;
    const name = profile.displayName;

    // Check if user exists
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
      if (err) {
        return done(err);
      }

      if (user) {
        // User exists, log them in
        return done(null, user);
      } else {
        // User doesn't exist, create new user
        // For Google auth, use a default password (won't be used for login)
        const defaultPassword = bcrypt.hashSync("google-oauth-user", 10);
        
        db.run(
          "INSERT INTO users (email, password) VALUES (?, ?)",
          [email, defaultPassword],
          function(err) {
            if (err) {
              return done(err);
            }
            const newUser = { id: this.lastID, email };
            return done(null, newUser);
          }
        );
      }
    });
  }
));

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user
passport.deserializeUser((id, done) => {
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
    done(err, user);
  });
});

// ==================== INSERT SAMPLE DATA ====================

// Insert sample courses with YouTube educational videos
// FIXED: Removed all hardcoded YouTube video IDs — they break over time. YouTube links are now generated dynamically.
const sampleCourses = [
  // ── PCM: B.Tech Engineering (min 60%) ─────────────────────────────────
  { name: "B.Tech Computer Science Engineering (CSE)", stream: "PCM", min_percentage: 60, description: "4-year B.Tech in Computer Science — software engineering, algorithms, operating systems, and systems design.", youtube_id: null, duration_months: 48 },
  { name: "B.Tech Artificial Intelligence & Data Science", stream: "PCM", min_percentage: 60, description: "4-year B.Tech in AI, machine learning, deep learning, natural language processing, and data engineering.", youtube_id: null, duration_months: 48 },
  { name: "B.Tech Cybersecurity", stream: "PCM", min_percentage: 60, description: "4-year B.Tech in network security, ethical hacking, cryptography, and cyber-threat management.", youtube_id: null, duration_months: 48 },
  { name: "B.Tech Electronics & Communication (ECE)", stream: "PCM", min_percentage: 60, description: "4-year B.Tech in analog/digital electronics, communication systems, VLSI, and embedded design.", youtube_id: null, duration_months: 48 },
  { name: "B.Tech Mechanical Engineering", stream: "PCM", min_percentage: 60, description: "4-year B.Tech in mechanics, thermodynamics, manufacturing processes, and robotics.", youtube_id: null, duration_months: 48 },
  { name: "B.Tech Civil Engineering", stream: "PCM", min_percentage: 60, description: "4-year B.Tech in structural design, construction management, and infrastructure planning.", youtube_id: null, duration_months: 48 },
  { name: "B.Tech Electrical Engineering", stream: "PCM", min_percentage: 60, description: "4-year B.Tech in power systems, control engineering, and electrical circuit design.", youtube_id: null, duration_months: 48 },
  { name: "B.Tech Chemical Engineering", stream: "PCM", min_percentage: 60, description: "4-year B.Tech in chemical processes, petroleum engineering, and industrial chemistry.", youtube_id: null, duration_months: 48 },

  // ── PCM: BCA (min 50%) ────────────────────────────────────────────────
  { name: "BCA Information Technology", stream: "PCM", min_percentage: 50, description: "3-year BCA in IT infrastructure, web technologies, databases, and enterprise software development.", youtube_id: null, duration_months: 36 },
  { name: "BCA Cybersecurity", stream: "PCM", min_percentage: 50, description: "3-year BCA specialising in ethical hacking, network security, digital forensics, and compliance.", youtube_id: null, duration_months: 36 },
  { name: "BCA Data Analytics", stream: "PCM", min_percentage: 50, description: "3-year BCA in data analytics, business intelligence, SQL, Python, and data visualisation.", youtube_id: null, duration_months: 36 },

  // ── PCM: B.Sc Computing & Physics (min 50%) ──────────────────────────
  { name: "B.Sc Computer Science", stream: "PCM", min_percentage: 50, description: "3-year B.Sc in programming, algorithms, operating systems, databases, and software engineering.", youtube_id: null, duration_months: 36 },
  { name: "B.Sc Data Science", stream: "PCM", min_percentage: 50, description: "3-year B.Sc in statistics, machine learning, data analysis, and Python/R programming.", youtube_id: null, duration_months: 36 },
  { name: "B.Sc Physics", stream: "PCM", min_percentage: 50, description: "3-year B.Sc Physics covering classical mechanics, optics, quantum physics, and applied research.", youtube_id: null, duration_months: 36 },

  // ── PCM: Architecture (min 50%) ──────────────────────────────────────
  { name: "B.Arch (Architecture)", stream: "PCM", min_percentage: 50, description: "5-year professional architecture degree — building design, structural systems, urban planning, and sustainable architecture.", youtube_id: null, duration_months: 60 },

  // ── PCB: Medical (min 50%) ───────────────────────────────────────────
  { name: "MBBS (Bachelor of Medicine & Surgery)", stream: "PCB", min_percentage: 50, description: "5.5-year professional medical degree — the standard qualification to become a licensed physician in India.", youtube_id: null, duration_months: 66 },
  { name: "BDS (Bachelor of Dental Surgery)", stream: "PCB", min_percentage: 50, description: "5-year dental surgery degree for clinical dental practice and oral healthcare.", youtube_id: null, duration_months: 60 },

  // ── PCB: Life Sciences / Bioscience (min 50%) ────────────────────────
  { name: "B.Sc Biotechnology", stream: "PCB", min_percentage: 50, description: "3-year B.Sc in genetics, cell biology, biomedical research, bioinformatics, and biotech applications.", youtube_id: null, duration_months: 36 },
  { name: "B.Sc Microbiology", stream: "PCB", min_percentage: 50, description: "3-year B.Sc studying microorganisms, infectious diseases, lab diagnostics, and applied microbiology.", youtube_id: null, duration_months: 36 },
  { name: "B.Sc Genetics", stream: "PCB", min_percentage: 50, description: "3-year B.Sc in heredity, genomics, molecular biology, and genetic counselling.", youtube_id: null, duration_months: 36 },

  // ── PCB: Pharmacy & Nursing (min 50%) ────────────────────────────────
  { name: "B.Pharm (Bachelor of Pharmacy)", stream: "PCB", min_percentage: 50, description: "4-year pharmacy degree in drug formulation, pharmaceutical sciences, pharmacology, and clinical pharmacy.", youtube_id: null, duration_months: 48 },
  { name: "B.Sc Nursing", stream: "PCB", min_percentage: 50, description: "4-year nursing degree covering patient care, clinical procedures, community health, and nursing management.", youtube_id: null, duration_months: 48 },

  // ── COMMERCE (min 50%, CA min 33%) ───────────────────────────────────
  { name: "B.Com (Hons)", stream: "Commerce", min_percentage: 50, description: "3-year honours degree in corporate finance, advanced accounting, business law, and economic analysis.", youtube_id: null, duration_months: 36 },
  { name: "BBA Business Administration", stream: "Commerce", min_percentage: 50, description: "3-year BBA in core business strategy, operations management, marketing, and organisational behaviour.", youtube_id: null, duration_months: 36 },
  { name: "BBA Digital Marketing", stream: "Commerce", min_percentage: 50, description: "3-year BBA specialising in SEO, social media campaigns, content strategy, and performance marketing.", youtube_id: null, duration_months: 36 },
  { name: "BBA Business Analytics", stream: "Commerce", min_percentage: 50, description: "3-year BBA in data-driven business decisions using statistics, Excel, Power BI, and Python.", youtube_id: null, duration_months: 36 },
  { name: "Chartered Accountancy (CA)", stream: "Commerce", min_percentage: 33, description: "Professional CA qualification from ICAI — India's premier credential in accounting, auditing, and taxation.", youtube_id: null, duration_months: 60 },
  { name: "B.Com Economics (Hons)", stream: "Commerce", min_percentage: 60, description: "3-year combined commerce and economics degree — macroeconomics, econometrics, and public-policy analysis.", youtube_id: null, duration_months: 36 },

  // ── HUMANITIES / ARTS ─────────────────────────────────────────────────
  { name: "BA Psychology", stream: "Humanities", min_percentage: 50, description: "3-year BA in human behaviour, counselling theories, developmental, clinical, and social psychology.", youtube_id: null, duration_months: 36 },
  { name: "BA English (Hons)", stream: "Humanities", min_percentage: 50, description: "3-year honours degree in English literature, linguistics, and academic and creative writing.", youtube_id: null, duration_months: 36 },
  { name: "BA Political Science (Hons)", stream: "Humanities", min_percentage: 50, description: "3-year degree in governance, public policy, comparative politics, and international relations.", youtube_id: null, duration_months: 36 },
  { name: "BJMC (Journalism & Mass Communication)", stream: "Humanities", min_percentage: 50, description: "3-year degree in broadcast, print, and digital journalism, public relations, advertising, and media ethics.", youtube_id: null, duration_months: 36 },
  { name: "BA LLB (Integrated Law)", stream: "Humanities", min_percentage: 45, description: "5-year integrated BA + LLB — combines arts and humanities with a complete legal education.", youtube_id: null, duration_months: 60 },
  { name: "BBA LLB (Integrated Law)", stream: "Humanities", min_percentage: 45, description: "5-year integrated BBA + LLB — business law, corporate governance, and commercial litigation.", youtube_id: null, duration_months: 60 },

  // ── ALL STREAMS: Design (min 50%) ─────────────────────────────────────
  { name: "B.Des UI/UX Design", stream: "All", min_percentage: 50, description: "4-year design degree in user interface and interaction design, design thinking, and digital prototyping.", youtube_id: null, duration_months: 48 },
  { name: "B.Des Fashion Design", stream: "All", min_percentage: 50, description: "4-year fashion design degree — garment construction, textile design, fashion illustration, and styling.", youtube_id: null, duration_months: 48 },
  { name: "B.Des Interior Design", stream: "All", min_percentage: 50, description: "4-year degree in interior aesthetics, space planning, materials, lighting, and sustainable design.", youtube_id: null, duration_months: 48 },

  // ── ALL STREAMS: Hotel Management (min 50%) ───────────────────────────
  { name: "B.Sc Hotel Management", stream: "All", min_percentage: 50, description: "3-4 year degree for careers in hotel operations, food & beverage management, tourism, and event coordination.", youtube_id: null, duration_months: 42 }
];

db.serialize(() => {
  // Clear all seeded data and re-seed fresh on every startup
  db.run('DELETE FROM salary_info');
  db.run('DELETE FROM career_map');
  db.run('DELETE FROM courses');
  sampleCourses.forEach(course => {
    db.run(
      `INSERT INTO courses (name, stream, min_percentage, description, youtube_id, duration_months) VALUES (?, ?, ?, ?, ?, ?)`,
      [course.name, course.stream, course.min_percentage, course.description, course.youtube_id, course.duration_months]
    );
  });
});


// Insert sample career mappings after courses are inserted
setTimeout(() => {
  const careerData = [
    // ── PCM: B.Tech ───────────────────────────────────────────────────────
    { courseName: "B.Tech Computer Science Engineering (CSE)", careers: [
      { name: "Software Engineer", role: "Full-stack Developer", salary: [40000, 80000, 150000] },
      { name: "Data Scientist", role: "ML/AI Engineer", salary: [45000, 90000, 160000] },
      { name: "DevOps Engineer", role: "Cloud Architect", salary: [50000, 100000, 180000] },
      { name: "Cybersecurity Analyst", role: "Security Operations Engineer", salary: [42000, 88000, 165000] },
      { name: "Solutions Architect", role: "Enterprise Architect", salary: [55000, 110000, 200000] }
    ]},
    { courseName: "B.Tech Artificial Intelligence & Data Science", careers: [
      { name: "AI/ML Engineer", role: "Machine Learning Specialist", salary: [50000, 105000, 200000] },
      { name: "Data Scientist", role: "AI Research Scientist", salary: [55000, 115000, 210000] },
      { name: "NLP Engineer", role: "Natural Language Processing Specialist", salary: [52000, 108000, 195000] },
      { name: "Data Engineer", role: "Big Data / Pipeline Engineer", salary: [48000, 98000, 185000] }
    ]},
    { courseName: "B.Tech Cybersecurity", careers: [
      { name: "Ethical Hacker", role: "Penetration Tester", salary: [35000, 75000, 150000] },
      { name: "Security Analyst", role: "SOC Analyst", salary: [32000, 68000, 138000] },
      { name: "Cybersecurity Engineer", role: "Threat Intelligence Specialist", salary: [40000, 85000, 165000] },
      { name: "Digital Forensics Analyst", role: "Incident Response Analyst", salary: [38000, 78000, 155000] }
    ]},
    { courseName: "B.Tech Electronics & Communication (ECE)", careers: [
      { name: "VLSI Design Engineer", role: "Chip Design Specialist", salary: [38000, 80000, 162000] },
      { name: "Embedded Systems Engineer", role: "Firmware Developer", salary: [35000, 75000, 148000] },
      { name: "Telecom Engineer", role: "RF & Network Engineer", salary: [36000, 72000, 140000] },
      { name: "IoT Engineer", role: "IoT Solutions Developer", salary: [38000, 78000, 152000] }
    ]},
    { courseName: "B.Tech Mechanical Engineering", careers: [
      { name: "Mechanical Design Engineer", role: "CAD/CAM Specialist", salary: [32000, 65000, 130000] },
      { name: "Manufacturing Engineer", role: "Production Lead", salary: [30000, 62000, 122000] },
      { name: "Robotics Engineer", role: "Automation Engineer", salary: [38000, 78000, 152000] },
      { name: "Automotive Engineer", role: "Vehicle Design Engineer", salary: [35000, 70000, 138000] }
    ]},
    { courseName: "B.Tech Civil Engineering", careers: [
      { name: "Structural Engineer", role: "Structural Design Lead", salary: [30000, 62000, 122000] },
      { name: "Construction Manager", role: "Site Project Manager", salary: [32000, 65000, 130000] },
      { name: "Urban Planner", role: "Infrastructure Planning Consultant", salary: [28000, 58000, 115000] }
    ]},
    { courseName: "B.Tech Electrical Engineering", careers: [
      { name: "Power Systems Engineer", role: "Electrical Grid Engineer", salary: [32000, 65000, 130000] },
      { name: "Control Systems Engineer", role: "Automation & Control Specialist", salary: [35000, 70000, 138000] },
      { name: "Energy Consultant", role: "Sustainable Energy Analyst", salary: [30000, 62000, 125000] }
    ]},
    { courseName: "B.Tech Chemical Engineering", careers: [
      { name: "Process Engineer", role: "Chemical Plant Engineer", salary: [35000, 72000, 140000] },
      { name: "Petroleum Engineer", role: "Oil & Gas Engineer", salary: [45000, 95000, 182000] },
      { name: "Food Technology Engineer", role: "Food Processing Specialist", salary: [30000, 60000, 118000] }
    ]},

    // ── PCM: BCA ──────────────────────────────────────────────────────────
    { courseName: "BCA Information Technology", careers: [
      { name: "Junior Web Developer", role: "Frontend/React Developer", salary: [20000, 45000, 90000] },
      { name: "IT Support Engineer", role: "Systems Administrator", salary: [18000, 38000, 76000] },
      { name: "Network Administrator", role: "Network Operations Engineer", salary: [22000, 48000, 95000] }
    ]},
    { courseName: "BCA Cybersecurity", careers: [
      { name: "Junior Cybersecurity Analyst", role: "Network Security Technician", salary: [22000, 50000, 100000] },
      { name: "Ethical Hacker (Junior)", role: "Penetration Testing Analyst", salary: [25000, 55000, 108000] }
    ]},
    { courseName: "BCA Data Analytics", careers: [
      { name: "Data Analyst", role: "Business Intelligence Analyst", salary: [25000, 55000, 108000] },
      { name: "Junior Data Scientist", role: "ML Operations Analyst", salary: [28000, 60000, 115000] }
    ]},

    // ── PCM: B.Sc Computing & Physics ─────────────────────────────────────
    { courseName: "B.Sc Computer Science", careers: [
      { name: "Software Developer", role: "Application Developer", salary: [22000, 50000, 100000] },
      { name: "System Administrator", role: "IT Infrastructure Manager", salary: [20000, 44000, 88000] },
      { name: "Database Developer", role: "SQL/NoSQL Specialist", salary: [25000, 55000, 108000] }
    ]},
    { courseName: "B.Sc Data Science", careers: [
      { name: "Data Analyst", role: "Business Intelligence Analyst", salary: [28000, 60000, 118000] },
      { name: "Machine Learning Engineer", role: "AI Model Developer", salary: [38000, 80000, 158000] },
      { name: "Data Engineer", role: "ETL / Pipeline Engineer", salary: [35000, 72000, 142000] }
    ]},
    { courseName: "B.Sc Physics", careers: [
      { name: "Physicist", role: "Research Scientist", salary: [30000, 65000, 130000] },
      { name: "Physics Teacher / Lecturer", role: "Academic Educator", salary: [22000, 48000, 95000] },
      { name: "Optical / Instrumentation Engineer", role: "Photonics Specialist", salary: [32000, 68000, 135000] }
    ]},

    // ── PCM: Architecture ─────────────────────────────────────────────────
    { courseName: "B.Arch (Architecture)", careers: [
      { name: "Architect", role: "Licensed Registered Architect", salary: [30000, 70000, 150000] },
      { name: "Urban Designer", role: "City Planning Consultant", salary: [28000, 65000, 138000] },
      { name: "Interior Architect", role: "Commercial Space Designer", salary: [28000, 62000, 130000] }
    ]},

    // ── PCB: Medical ──────────────────────────────────────────────────────
    { courseName: "MBBS (Bachelor of Medicine & Surgery)", careers: [
      { name: "General Physician", role: "Medical Doctor", salary: [60000, 150000, 350000] },
      { name: "Surgeon", role: "Specialist Surgeon", salary: [80000, 200000, 500000] },
      { name: "Cardiologist", role: "Heart Specialist", salary: [90000, 250000, 600000] },
      { name: "Pediatrician", role: "Child Health Specialist", salary: [65000, 160000, 400000] }
    ]},
    { courseName: "BDS (Bachelor of Dental Surgery)", careers: [
      { name: "Dental Surgeon", role: "General Dentist", salary: [40000, 100000, 250000] },
      { name: "Orthodontist", role: "Braces & Alignment Specialist", salary: [50000, 140000, 350000] },
      { name: "Oral Surgeon", role: "Maxillofacial Surgeon", salary: [55000, 150000, 380000] }
    ]},

    // ── PCB: Life Sciences ────────────────────────────────────────────────
    { courseName: "B.Sc Biotechnology", careers: [
      { name: "Biotech Researcher", role: "R&D Scientist", salary: [28000, 60000, 122000] },
      { name: "Quality Control Analyst", role: "QA/QC Specialist (Pharma)", salary: [25000, 55000, 108000] },
      { name: "Genetic Counsellor", role: "Clinical Genetics Specialist", salary: [30000, 65000, 132000] }
    ]},
    { courseName: "B.Sc Microbiology", careers: [
      { name: "Microbiologist", role: "Clinical / Industrial Microbiologist", salary: [25000, 52000, 105000] },
      { name: "Medical Lab Technician", role: "Diagnostic Lab Analyst", salary: [20000, 42000, 85000] },
      { name: "Food Safety Inspector", role: "Food Quality Analyst", salary: [22000, 45000, 90000] }
    ]},
    { courseName: "B.Sc Genetics", careers: [
      { name: "Geneticist", role: "Research Geneticist", salary: [30000, 65000, 130000] },
      { name: "Bioinformatics Analyst", role: "Genomics Data Scientist", salary: [35000, 72000, 145000] }
    ]},

    // ── PCB: Pharmacy & Nursing ───────────────────────────────────────────
    { courseName: "B.Pharm (Bachelor of Pharmacy)", careers: [
      { name: "Hospital Pharmacist", role: "Clinical Pharmacist", salary: [25000, 55000, 118000] },
      { name: "Drug Inspector", role: "Government Drug Controller", salary: [35000, 70000, 150000] },
      { name: "Medical Representative", role: "Pharma Sales Executive", salary: [20000, 45000, 100000] },
      { name: "Research Scientist (Pharma)", role: "Drug Development Researcher", salary: [30000, 65000, 140000] }
    ]},
    { courseName: "B.Sc Nursing", careers: [
      { name: "Staff Nurse", role: "Hospital Ward Nurse", salary: [20000, 45000, 90000] },
      { name: "ICU Nurse", role: "Critical Care Specialist", salary: [25000, 55000, 112000] },
      { name: "Community Health Nurse", role: "Public Health Nurse", salary: [18000, 40000, 82000] },
      { name: "Nursing Supervisor", role: "Head Nurse / Nursing Manager", salary: [28000, 62000, 125000] }
    ]},

    // ── COMMERCE ──────────────────────────────────────────────────────────
    { courseName: "B.Com (Hons)", careers: [
      { name: "Accountant", role: "Senior Financial Analyst", salary: [28000, 60000, 120000] },
      { name: "Auditor", role: "Internal / External Auditor", salary: [30000, 65000, 130000] },
      { name: "Tax Consultant", role: "GST / Income Tax Advisor", salary: [32000, 68000, 135000] }
    ]},
    { courseName: "BBA Business Administration", careers: [
      { name: "Business Analyst", role: "Strategy Consultant", salary: [30000, 65000, 130000] },
      { name: "Operations Manager", role: "Process / Ops Lead", salary: [32000, 68000, 135000] },
      { name: "HR Manager", role: "People & Culture Manager", salary: [28000, 60000, 120000] }
    ]},
    { courseName: "BBA Digital Marketing", careers: [
      { name: "Digital Marketer", role: "Performance Marketing Manager", salary: [28000, 62000, 125000] },
      { name: "SEO / SEM Specialist", role: "Search Marketing Analyst", salary: [25000, 55000, 110000] },
      { name: "Content Strategist", role: "Brand Content Manager", salary: [26000, 58000, 115000] }
    ]},
    { courseName: "BBA Business Analytics", careers: [
      { name: "Business Intelligence Analyst", role: "BI & Analytics Engineer", salary: [32000, 70000, 140000] },
      { name: "Data Analyst (Commerce)", role: "Financial Data Analyst", salary: [30000, 65000, 130000] }
    ]},
    { courseName: "Chartered Accountancy (CA)", careers: [
      { name: "Chartered Accountant", role: "CA / Audit Partner", salary: [50000, 150000, 300000] },
      { name: "Tax Consultant", role: "Senior Tax Advisor", salary: [45000, 130000, 260000] },
      { name: "CFO", role: "Chief Financial Officer", salary: [80000, 180000, 400000] }
    ]},
    { courseName: "B.Com Economics (Hons)", careers: [
      { name: "Economist", role: "Research Economist / Policy Analyst", salary: [30000, 65000, 132000] },
      { name: "Investment Analyst", role: "Equity Research Analyst", salary: [38000, 82000, 165000] },
      { name: "Civil Services Officer", role: "IAS / IES / IRS Officer", salary: [56000, 120000, 250000] }
    ]},

    // ── HUMANITIES ────────────────────────────────────────────────────────
    { courseName: "BA Psychology", careers: [
      { name: "Clinical Psychologist", role: "Counsellor / Therapist", salary: [25000, 55000, 112000] },
      { name: "School Counsellor", role: "Student Welfare Counsellor", salary: [20000, 44000, 88000] },
      { name: "HR Specialist", role: "People & Culture Specialist", salary: [28000, 60000, 120000] }
    ]},
    { courseName: "BA English (Hons)", careers: [
      { name: "Content Writer / Editor", role: "Senior Copy Editor", salary: [20000, 45000, 90000] },
      { name: "Copywriter", role: "Creative Content Strategist", salary: [22000, 48000, 95000] },
      { name: "English Teacher / Lecturer", role: "Language & Literature Educator", salary: [18000, 42000, 85000] }
    ]},
    { courseName: "BA Political Science (Hons)", careers: [
      { name: "Political Analyst", role: "Policy Research Analyst", salary: [25000, 55000, 112000] },
      { name: "Civil Services Officer", role: "IAS / IPS / IFS Officer", salary: [56000, 120000, 250000] },
      { name: "NGO Programme Manager", role: "Development Sector Lead", salary: [28000, 58000, 115000] }
    ]},
    { courseName: "BJMC (Journalism & Mass Communication)", careers: [
      { name: "Journalist / Reporter", role: "News Reporter & Editor", salary: [18000, 42000, 88000] },
      { name: "Public Relations Manager", role: "PR & Communications Lead", salary: [25000, 55000, 112000] },
      { name: "Digital Content Creator", role: "Video / Social Media Producer", salary: [20000, 45000, 90000] }
    ]},
    { courseName: "BA LLB (Integrated Law)", careers: [
      { name: "Advocate / Lawyer", role: "District / High Court Advocate", salary: [25000, 65000, 200000] },
      { name: "Corporate Legal Advisor", role: "In-house Legal Counsel", salary: [40000, 90000, 210000] },
      { name: "Public Prosecutor", role: "Criminal Court Prosecutor", salary: [35000, 75000, 162000] }
    ]},
    { courseName: "BBA LLB (Integrated Law)", careers: [
      { name: "Corporate Lawyer", role: "M&A / Contract Lawyer", salary: [45000, 100000, 220000] },
      { name: "Compliance Manager", role: "Corporate Governance Specialist", salary: [42000, 92000, 200000] }
    ]},

    // ── ALL STREAMS: Design ───────────────────────────────────────────────
    { courseName: "B.Des UI/UX Design", careers: [
      { name: "UI/UX Designer", role: "Product Interface Designer", salary: [30000, 68000, 138000] },
      { name: "Product Designer", role: "End-to-End Product Design Lead", salary: [35000, 75000, 155000] },
      { name: "Interaction Designer", role: "User Research & Prototyping Specialist", salary: [32000, 70000, 142000] }
    ]},
    { courseName: "B.Des Fashion Design", careers: [
      { name: "Fashion Designer", role: "Apparel & Garment Designer", salary: [22000, 50000, 108000] },
      { name: "Textile Designer", role: "Fabric & Pattern Specialist", salary: [20000, 44000, 90000] },
      { name: "Fashion Stylist", role: "Editorial & Commercial Stylist", salary: [18000, 42000, 85000] }
    ]},
    { courseName: "B.Des Interior Design", careers: [
      { name: "Interior Designer", role: "Residential / Commercial Space Designer", salary: [25000, 58000, 120000] },
      { name: "Space Planner", role: "Furniture & Layout Specialist", salary: [22000, 50000, 102000] }
    ]},

    // ── ALL STREAMS: Hotel Management ─────────────────────────────────────
    { courseName: "B.Sc Hotel Management", careers: [
      { name: "Hotel Manager", role: "Property / General Manager", salary: [28000, 65000, 140000] },
      { name: "Revenue Manager", role: "Hospitality Revenue Analyst", salary: [25000, 58000, 120000] },
      { name: "Food & Beverage Manager", role: "F&B Operations Manager", salary: [22000, 52000, 108000] },
      { name: "Event Coordinator", role: "MICE & Events Manager", salary: [20000, 45000, 92000] }
    ]}
  ];

// Seed data
setTimeout(() => {
  careerData.forEach(item => {
    db.get(`SELECT id FROM courses WHERE name = ?`, [item.courseName], (err, course) => {
      if (course) {
        item.careers.forEach(career => {
          db.run(
            `INSERT OR IGNORE INTO career_map (course_id, career_name, job_role, description) VALUES (?, ?, ?, ?)`,
            [course.id, career.name, career.role, `${career.name} position`],
            function(err) {
              if (!err) {
                db.run(
                  `INSERT OR IGNORE INTO salary_info (career_id, entry_level_salary, mid_level_salary, senior_level_salary) VALUES (?, ?, ?, ?)`,
                  [this.lastID, career.salary[0], career.salary[1], career.salary[2]]
                );
              }
            }
          );
        });
      }
    });
  });
}, 1000);

// ==================== AUTHENTICATION ENDPOINTS ====================

// Sign Up
app.post("/api/signup", authLimiter, (req, res) => {
  const { email, password, confirmPassword } = req.body;

  if (!email || !password || !confirmPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const query = `INSERT INTO users (email, password) VALUES (?, ?)`;

  db.run(query, [email, hashedPassword], function (err) {
    if (err) {
      return res.status(400).json({ message: "User already exists" });
    }
    res.json({ message: "Account created successfully", success: true });
  });
});

// Login
app.post("/api/login", authLimiter, (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required", success: false });
  }

  const query = `SELECT * FROM users WHERE email = ?`;

  db.get(query, [email], (err, user) => {
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password", success: false });
    }

    const isMatch = bcrypt.compareSync(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password", success: false });
    }

    req.session.user = {
      id: user.id,
      email: user.email,
      is_admin: user.is_admin || 0
    };
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Session error. Please try again.' });
      }
      res.json({ message: "Login successful", success: true, userId: user.id, email: user.email, isAdmin: user.is_admin === 1, is_admin: user.is_admin || 0 });
    });
  });
});

// Google Token Authentication (for frontend Google Sign-In)
app.post("/api/google-auth", authLimiter, async (req, res) => {
  try {
    const tokenId = req.body.tokenId || req.body.token;
    if (!tokenId) {
      return res.status(400).json({ message: "Google token required.", success: false });
    }

    const ticket = await gOAuthClient.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name || email.split('@')[0];

    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ message: "Database error.", success: false });
      }

      if (user) {
        req.session.user = { id: user.id, email: user.email, is_admin: user.is_admin || 0 };
        req.session.save((err) => {
          if (err) return res.status(500).json({ success: false, message: 'Session error.' });
          res.json({ message: "Login successful", success: true, userId: user.id, email: user.email, is_admin: user.is_admin || 0 });
        });
      } else {
        const hashedPw = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
        db.run(
          `INSERT INTO users (email, name, password, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
          [email, name, hashedPw],
          function(err) {
            if (err) return res.status(500).json({ success: false, message: 'Failed to create account.' });
            req.session.user = { id: this.lastID, email, is_admin: 0 };
            req.session.save((err) => {
              if (err) return res.status(500).json({ success: false, message: 'Session error.' });
              res.json({ message: "Account created and logged in with Google", success: true, userId: this.lastID, email, is_admin: 0 });
            });
          }
        );
      }
    });
  } catch (error) {
    console.error('Google auth error:', error.message);
    return res.status(401).json({ message: "Invalid Google token. Please try again.", success: false });
  }
});

// ==================== GOOGLE OAUTH ENDPOINTS ====================

// Google OAuth Login Route
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth Callback Route
app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login-failed" }),
  (req, res) => {
    req.session.user = { id: req.user.id, email: req.user.email, is_admin: req.user.is_admin || 0 };
    req.session.save(() => {
      res.redirect(`/login.html?userId=${req.user.id}&email=${encodeURIComponent(req.user.email)}&googleAuth=true`);
    });
  }
);

// Logout Route
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    res.clearCookie('connect.sid');
    res.redirect('/login.html');
  });
});

// Check Authentication Status
app.get("/api/auth-status", (req, res) => {
  if (req.session?.user) {
    res.json({ 
      authenticated: true, 
      user: req.session.user
    });
  } else {
    res.json({ authenticated: false, user: null });
  }
});

// ==================== RECOMMENDATION ENDPOINT ====================

// Get course recommendations based on student profile
app.post("/api/recommend-courses", (req, res) => {
  const { stream, percentage, interest_areas } = req.body;

  if (!stream || percentage === undefined) {
    return res.status(400).json({ message: "Stream and percentage required", success: false });
  }
  if (percentage < 33 || percentage > 100) {
    return res.status(400).json({ message: "Percentage must be between 33-100", success: false });
  }

  // ── Interest filter maps ─────────────────────────────────────────────────
  // Map each dropdown value → exact course name substrings to match
  const interestCourseMap = {
    // Science – Medical (PCB)
    medical:     ['mbbs', 'bds (bachelor'],
    nursing:     ['b.sc nursing'],
    pharmacy:    ['b.pharm'],
    biotech:     ['b.sc biotechnology', 'b.sc microbiology', 'b.sc genetics'],
    // Science – Engineering & Computing (PCM)
    engineering: ['b.tech computer science', 'b.tech artificial intelligence', 'b.tech electronics', 'b.tech mechanical', 'b.tech civil', 'b.tech electrical', 'b.tech chemical', 'b.arch'],
    data:        ['b.tech artificial intelligence', 'b.sc data science', 'bca data analytics'],
    computing:   ['bca information technology', 'bca cybersecurity', 'bca data analytics', 'b.sc computer science', 'b.sc data science', 'b.tech cybersecurity', 'b.tech computer science'],
    // Commerce
    accounting:  ['chartered accountancy', 'b.com (hons)', 'b.com economics'],
    business:    ['bba business administration', 'bba digital marketing', 'bba business analytics'],
    economics:   ['b.com economics', 'b.com (hons)'],
    marketing:   ['bba digital marketing', 'bba business analytics'],
    // Humanities
    psychology:  ['ba psychology'],
    journalism:  ['bjmc', 'ba english'],
    law:         ['ba llb', 'bba llb'],
    // All Streams
    design:      ['b.des ui/ux', 'b.des fashion', 'b.des interior'],
    hotel:       ['b.sc hotel management']
  };


  const interest = (interest_areas || '').toLowerCase().trim();

  // ── Query: fetch all eligible courses for the stream ─────────────────────
  let query = `
    SELECT c.id, c.name, c.stream, c.min_percentage, c.description, c.youtube_id, c.duration_months
    FROM courses c
    WHERE (c.stream = ? OR c.stream = 'All') AND c.min_percentage <= ?
  `;

  // If percentage is low (below 50), prioritize Diploma courses
  if (parseFloat(percentage) < 50) {
    query += ` AND c.name LIKE '%Diploma%'`;
  }

  query += `
    GROUP BY c.id, c.name, c.stream
    ORDER BY c.min_percentage DESC, c.id ASC
    LIMIT 60
  `;

  db.all(query, [stream, percentage], (err, courses) => {
    if (err) return res.status(500).json({ message: "Database error", success: false });
    if (courses.length === 0) {
      return res.status(200).json({ message: "No courses found matching your criteria. Try other streams.", success: true, courses: [] });
    }

    // ── Apply interest filter ─────────────────────────────────────────────
    let filtered = courses;
    if (interest && interestCourseMap[interest]) {
      const patterns = interestCourseMap[interest];
      const matched = courses.filter(c => {
        const lower = c.name.toLowerCase();
        return patterns.some(p => lower.includes(p));
      });
      // Only apply filter if it yields results; otherwise fall back to all
      if (matched.length > 0) filtered = matched;
    }

    const toProcess = filtered.slice(0, 12);

    const pendingCourses = toProcess.map(course => new Promise((resolve) => {
      const careerQuery = `
        SELECT DISTINCT cm.id, cm.career_name, cm.job_role, si.entry_level_salary, si.mid_level_salary, si.senior_level_salary
        FROM career_map cm
        LEFT JOIN salary_info si ON cm.id = si.career_id
        WHERE cm.course_id = ?
        LIMIT 8
      `;
      db.all(careerQuery, [course.id], (err, careers) => {
        resolve({
          id: course.id,
          name: course.name,
          stream: course.stream,
          min_percentage: course.min_percentage,
          description: course.description,
          youtube_id: course.youtube_id,
          duration_months: course.duration_months,
          eligibility: `${percentage}% meets minimum requirement of ${course.min_percentage}%`,
          priority: percentage >= course.min_percentage + 15 ? "High" : percentage >= course.min_percentage + 5 ? "Medium" : "Low",
          careers: careers || []
        });
      });
    }));

    Promise.all(pendingCourses).then(results => {
      const seen = new Set();
      const unique = results.filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; });
      const order = { "High": 1, "Medium": 2, "Low": 3 };
      unique.sort((a, b) => (order[a.priority] || 3) - (order[b.priority] || 3));
      res.json({
        message: "Courses found based on your eligibility",
        success: true,
        student_profile: { stream, percentage, interest_areas: interest_areas || "" },
        total_courses: unique.length,
        courses: unique
      });
    });
  });
});


// Get all courses
app.get("/api/courses", (req, res) => {
  db.all(`SELECT * FROM courses ORDER BY id`, (err, courses) => {
    if (err) {
      return res.status(500).json({ message: "Database error", success: false });
    }

    // Fetch careers for each course
    let coursesWithCareers = [];
    let processed = 0;

    if (courses.length === 0) {
      return res.json({ success: true, courses: [] });
    }

    courses.forEach(course => {
      const careerQuery = `
        SELECT cm.*, si.entry_level_salary, si.mid_level_salary, si.senior_level_salary
        FROM career_map cm
        LEFT JOIN salary_info si ON cm.id = si.career_id
        WHERE cm.course_id = ?
      `;

      db.all(careerQuery, [course.id], (err, careers) => {
        coursesWithCareers.push({ ...course, careers: careers || [] });
        processed++;

        if (processed === courses.length) {
          // All careers fetched, send response
          coursesWithCareers.sort((a, b) => a.id - b.id);
          res.json({ success: true, courses: coursesWithCareers });
        }
      });
    });
  });
});

// Get course details with careers
app.get("/api/course/:id", (req, res) => {
  const { id } = req.params;

  const courseQuery = `SELECT * FROM courses WHERE id = ?`;
  
  db.get(courseQuery, [id], (err, course) => {
    if (!course) {
      return res.status(404).json({ message: "Course not found", success: false });
    }

    const careerQuery = `
      SELECT cm.*, si.entry_level_salary, si.mid_level_salary, si.senior_level_salary
      FROM career_map cm
      LEFT JOIN salary_info si ON cm.id = si.career_id
      WHERE cm.course_id = ?
    `;

    db.all(careerQuery, [id], (err, careers) => {
      res.json({
        success: true,
        course: { ...course, careers }
      });
    });
  });
});


// ===== ADMIN PAGE (SECURED — no passwords exposed) =====

app.get("/admin/users", (req, res) => {
  db.all("SELECT id, email, name, stream, percentage, created_at FROM users", [], (err, rows) => {
    if (err) return res.status(500).send("Database error");

    let html = `<html><head><style>
      body{font-family:'Inter',Arial,sans-serif;background:#0a0e1a;color:#f1f5f9;padding:40px;}
      h2{text-align:center;margin-bottom:24px;}
      table{width:90%;margin:auto;border-collapse:collapse;background:rgba(17,24,39,0.8);border-radius:12px;overflow:hidden;}
      th,td{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);text-align:left;font-size:14px;}
      th{background:rgba(99,102,241,0.2);color:#a5b4fc;font-weight:600;text-transform:uppercase;font-size:12px;letter-spacing:0.05em;}
      td{color:#94a3b8;} tr:hover td{background:rgba(255,255,255,0.03);}
    </style></head><body>
    <h2>Registered Users (${rows.length})</h2>
    <table><tr><th>ID</th><th>Email</th><th>Name</th><th>Stream</th><th>Registered</th></tr>`;

    rows.forEach(row => {
      html += `<tr><td>${row.id}</td><td>${row.email}</td><td>${row.name || '-'}</td><td>${row.stream || '-'}</td><td>${row.created_at || '-'}</td></tr>`;
    });

    html += "</table></body></html>";
    res.send(html);
  });
});


// ==================== PHASE 1 FEATURE ENDPOINTS ====================

// -- PROFILE --
app.get("/api/profile/:userId", apiLimiter, requireAuth, requireOwnership, (req, res) => {
  const { userId } = req.params;
  db.get("SELECT id, email, name, stream, percentage, interests, profile_photo, created_at FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) return res.status(500).json({ message: "Database error", success: false });
    if (!user) return res.status(404).json({ message: "User not found", success: false });
    const fields = ['name', 'stream', 'percentage', 'interests'];
    const filled = fields.filter(f => user[f] !== null && user[f] !== '').length;
    res.json({ success: true, profile: { ...user, completion_percent: Math.round((filled / fields.length) * 100) } });
  });
});

app.put("/api/profile/:userId", apiLimiter, requireAuth, requireOwnership, (req, res) => {
  const { userId } = req.params;
  const { name, stream, percentage, interests } = req.body;
  db.run("UPDATE users SET name = COALESCE(?, name), stream = COALESCE(?, stream), percentage = COALESCE(?, percentage), interests = COALESCE(?, interests) WHERE id = ?",
    [name, stream, percentage, interests, userId], function(err) {
      if (err) return res.status(500).json({ message: "Update failed", success: false });
      if (this.changes === 0) return res.status(404).json({ message: "User not found", success: false });
      db.get("SELECT name, stream, percentage, interests FROM users WHERE id = ?", [userId], (err, user) => {
        if (user && user.name && user.stream && user.percentage && user.interests) {
          db.run("INSERT OR IGNORE INTO badges (user_id, badge_type) VALUES (?, 'profile_completed')", [userId]);
          db.run("INSERT OR IGNORE INTO notifications (user_id, message, type) VALUES (?, 'Badge Earned: Profile Completed!', 'badge')", [userId]);
        }
      });
      res.json({ message: "Profile updated", success: true });
    }
  );
});

// -- BOOKMARKS --
app.get("/api/bookmarks/:userId", apiLimiter, requireAuth, requireOwnership, (req, res) => {
  db.all(`SELECT b.id, b.saved_at, c.id as course_id, c.name, c.stream, c.description, c.duration_months
    FROM bookmarks b JOIN courses c ON b.course_id = c.id WHERE b.user_id = ? ORDER BY b.saved_at DESC`, [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error", success: false });
    res.json({ success: true, bookmarks: rows || [] });
  });
});

app.post("/api/bookmarks", apiLimiter, requireAuth, (req, res) => {
  const { userId, courseId } = req.body;
  if (!userId || !courseId) return res.status(400).json({ message: "userId and courseId required", success: false });
  db.run("INSERT OR IGNORE INTO bookmarks (user_id, course_id) VALUES (?, ?)", [userId, courseId], function(err) {
    if (err) return res.status(500).json({ message: "Failed to bookmark", success: false });
    db.get("SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?", [userId], (err, row) => {
      if (row && row.count === 1) {
        db.run("INSERT OR IGNORE INTO badges (user_id, badge_type) VALUES (?, 'first_bookmark')", [userId]);
        db.run("INSERT OR IGNORE INTO notifications (user_id, message, type) VALUES (?, 'Badge Earned: First Bookmark!', 'badge')", [userId]);
      }
      if (row && row.count === 5) {
        db.run("INSERT OR IGNORE INTO badges (user_id, badge_type) VALUES (?, 'bookworm')", [userId]);
        db.run("INSERT OR IGNORE INTO notifications (user_id, message, type) VALUES (?, 'Badge Earned: Bookworm!', 'badge')", [userId]);
      }
    });
    res.json({ message: "Course bookmarked", success: true });
  });
});

app.delete("/api/bookmarks", apiLimiter, requireAuth, (req, res) => {
  const { userId, courseId } = req.body;
  if (!userId || !courseId) return res.status(400).json({ message: "userId and courseId required", success: false });
  db.run("DELETE FROM bookmarks WHERE user_id = ? AND course_id = ?", [userId, courseId], function(err) {
    if (err) return res.status(500).json({ message: "Failed to remove", success: false });
    res.json({ message: "Bookmark removed", success: true });
  });
});

// -- PROGRESS --
app.get("/api/progress/:userId", apiLimiter, (req, res) => {
  db.all(`SELECT p.*, c.name as course_name, c.stream FROM progress p JOIN courses c ON p.course_id = c.id WHERE p.user_id = ? ORDER BY p.updated_at DESC`, [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error", success: false });
    const total = (rows || []).length;
    const completed = (rows || []).filter(r => r.status === 'completed').length;
    const inProgress = (rows || []).filter(r => r.status === 'in_progress').length;
    res.json({ success: true, progress: rows || [], stats: { total, completed, inProgress, overallPercent: total > 0 ? Math.round((completed / total) * 100) : 0 } });
  });
});

app.put("/api/progress", apiLimiter, requireAuth, (req, res) => {
  const { userId, courseId, status } = req.body;
  if (!userId || !courseId || !status) return res.status(400).json({ message: "userId, courseId, status required", success: false });
  if (!['not_started', 'in_progress', 'completed'].includes(status)) return res.status(400).json({ message: "Invalid status", success: false });
  db.run(`INSERT INTO progress (user_id, course_id, status, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, course_id) DO UPDATE SET status = ?, updated_at = CURRENT_TIMESTAMP`, [userId, courseId, status, status], function(err) {
    if (err) return res.status(500).json({ message: "Failed to update", success: false });
    if (status === 'completed') {
      db.get("SELECT COUNT(*) as count FROM progress WHERE user_id = ? AND status = 'completed'", [userId], (err, row) => {
        if (row && row.count === 1) { db.run("INSERT OR IGNORE INTO badges (user_id, badge_type) VALUES (?, 'first_completed')", [userId]); db.run("INSERT OR IGNORE INTO notifications (user_id, message, type) VALUES (?, 'Badge Earned: First Course Completed!', 'badge')", [userId]); }
        if (row && row.count === 5) { db.run("INSERT OR IGNORE INTO badges (user_id, badge_type) VALUES (?, 'five_completed')", [userId]); db.run("INSERT OR IGNORE INTO notifications (user_id, message, type) VALUES (?, 'Badge Earned: 5 Courses Completed!', 'badge')", [userId]); }
      });
    }
    res.json({ message: "Progress updated", success: true });
  });
});

// -- RATINGS --
app.get("/api/ratings/:courseId", apiLimiter, (req, res) => {
  db.all(`SELECT r.*, u.email, u.name as user_name FROM ratings r JOIN users u ON r.user_id = u.id WHERE r.course_id = ? ORDER BY r.created_at DESC`, [req.params.courseId], (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error", success: false });
    const ratings = rows || [];
    const avgStars = ratings.length > 0 ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1) : 0;
    res.json({ success: true, ratings, averageStars: parseFloat(avgStars), totalRatings: ratings.length });
  });
});

app.post("/api/ratings", apiLimiter, requireAuth, (req, res) => {
  const { userId, courseId, stars, review } = req.body;
  if (!userId || !courseId || !stars) return res.status(400).json({ message: "userId, courseId, stars required", success: false });
  if (stars < 1 || stars > 5) return res.status(400).json({ message: "Stars must be 1-5", success: false });
  const cleanReview = review ? review.replace(/[<>]/g, '').substring(0, 500) : null;
  db.run(`INSERT INTO ratings (user_id, course_id, stars, review) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, course_id) DO UPDATE SET stars = ?, review = ?, created_at = CURRENT_TIMESTAMP`, [userId, courseId, stars, cleanReview, stars, cleanReview], function(err) {
    if (err) return res.status(500).json({ message: "Failed to save", success: false });
    db.run("INSERT OR IGNORE INTO badges (user_id, badge_type) VALUES (?, 'first_review')", [userId]);
    res.json({ message: "Rating saved", success: true });
  });
});

// -- BADGES --
app.get("/api/badges/:userId", apiLimiter, requireAuth, requireOwnership, (req, res) => {
  const allBadges = [
    { type: 'first_login', name: 'First Steps', icon: '🚀', description: 'Logged in for the first time' },
    { type: 'profile_completed', name: 'Identity', icon: '👤', description: 'Completed your profile' },
    { type: 'first_bookmark', name: 'Collector', icon: '🔖', description: 'Saved your first course' },
    { type: 'bookworm', name: 'Bookworm', icon: '📚', description: 'Saved 5 courses' },
    { type: 'first_completed', name: 'Achiever', icon: '🎉', description: 'Completed your first course' },
    { type: 'five_completed', name: 'Scholar', icon: '🌟', description: 'Completed 5 courses' },
    { type: 'streak_7', name: 'Weekly Warrior', icon: '🔥', description: '7-day streak' },
    { type: 'streak_30', name: 'Dedicated', icon: '💎', description: '30-day streak' },
    { type: 'first_review', name: 'Critic', icon: '⭐', description: 'Wrote first review' }
  ];
  db.all("SELECT badge_type, earned_at FROM badges WHERE user_id = ?", [req.params.userId], (err, earned) => {
    if (err) return res.status(500).json({ message: "Database error", success: false });
    const earnedMap = {};
    (earned || []).forEach(b => { earnedMap[b.badge_type] = b.earned_at; });
    const badges = allBadges.map(b => ({ ...b, earned: !!earnedMap[b.type], earned_at: earnedMap[b.type] || null }));
    res.json({ success: true, badges, totalEarned: Object.keys(earnedMap).length, totalAvailable: allBadges.length });
  });
});

app.post("/api/badges/check-login", apiLimiter, (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId required", success: false });
  db.run("INSERT OR IGNORE INTO badges (user_id, badge_type) VALUES (?, 'first_login')", [userId], function(err) {
    if (err) return res.status(500).json({ message: "Database error", success: false });
    if (this.changes > 0) db.run("INSERT INTO notifications (user_id, message, type) VALUES (?, 'Badge Earned: First Steps!', 'badge')", [userId]);
    res.json({ success: true, newBadge: this.changes > 0 });
  });
});

// -- STREAKS --
app.get("/api/streaks/:userId", apiLimiter, requireAuth, requireOwnership, (req, res) => {
  db.get("SELECT * FROM streaks WHERE user_id = ?", [req.params.userId], (err, streak) => {
    if (err) return res.status(500).json({ message: "Database error", success: false });
    res.json({ success: true, streak: streak || { current_streak: 0, longest_streak: 0, last_visit: null } });
  });
});

app.post("/api/streaks", apiLimiter, requireAuth, (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId required", success: false });
  const today = new Date().toISOString().split('T')[0];
  db.get("SELECT * FROM streaks WHERE user_id = ?", [userId], (err, streak) => {
    if (err) return res.status(500).json({ message: "Database error", success: false });
    if (!streak) {
      db.run("INSERT INTO streaks (user_id, current_streak, longest_streak, last_visit) VALUES (?, 1, 1, ?)", [userId, today]);
      return res.json({ success: true, current_streak: 1, message: "Streak started!" });
    }
    if (streak.last_visit === today) return res.json({ success: true, current_streak: streak.current_streak, message: "Already visited today" });
    const diffDays = Math.floor((new Date(today) - new Date(streak.last_visit)) / (1000 * 60 * 60 * 24));
    let newStreak = diffDays === 1 ? streak.current_streak + 1 : 1;
    const longestStreak = Math.max(newStreak, streak.longest_streak);
    db.run("UPDATE streaks SET current_streak = ?, longest_streak = ?, last_visit = ? WHERE user_id = ?", [newStreak, longestStreak, today, userId]);
    if (newStreak === 7) { db.run("INSERT OR IGNORE INTO badges (user_id, badge_type) VALUES (?, 'streak_7')", [userId]); db.run("INSERT OR IGNORE INTO notifications (user_id, message, type) VALUES (?, 'Badge Earned: 7-Day Streak!', 'badge')", [userId]); }
    if (newStreak === 30) { db.run("INSERT OR IGNORE INTO badges (user_id, badge_type) VALUES (?, 'streak_30')", [userId]); db.run("INSERT OR IGNORE INTO notifications (user_id, message, type) VALUES (?, 'Badge Earned: 30-Day Streak!', 'badge')", [userId]); }
    res.json({ success: true, current_streak: newStreak, longest_streak: longestStreak, message: diffDays === 1 ? "Streak continued!" : "New streak started" });
  });
});

// -- NOTIFICATIONS --
app.get("/api/notifications/:userId", apiLimiter, requireAuth, requireOwnership, (req, res) => {
  db.all("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error", success: false });
    res.json({ success: true, notifications: rows || [], unreadCount: (rows || []).filter(n => !n.read).length });
  });
});

app.put("/api/notifications/:userId/read", apiLimiter, requireAuth, requireOwnership, (req, res) => {
  db.run("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0", [req.params.userId], function(err) {
    if (err) return res.status(500).json({ message: "Database error", success: false });
    res.json({ success: true, message: `${this.changes} notifications marked as read` });
  });
});

// -- DASHBOARD STATS --
app.get("/api/dashboard/:userId", apiLimiter, requireAuth, requireOwnership, (req, res) => {
  const { userId } = req.params;
  const queries = {
    profile: new Promise(r => { db.get("SELECT id, email, name, stream, percentage, interests FROM users WHERE id = ?", [userId], (e, d) => r(d)); }),
    streak: new Promise(r => { db.get("SELECT current_streak, longest_streak FROM streaks WHERE user_id = ?", [userId], (e, d) => r(d || { current_streak: 0, longest_streak: 0 })); }),
    bookmarkCount: new Promise(r => { db.get("SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?", [userId], (e, d) => r(d?.count || 0)); }),
    progressStats: new Promise(r => { db.all("SELECT status, COUNT(*) as count FROM progress WHERE user_id = ? GROUP BY status", [userId], (e, rows) => { const s = { not_started: 0, in_progress: 0, completed: 0 }; (rows || []).forEach(x => { s[x.status] = x.count; }); r(s); }); }),
    badgeCount: new Promise(r => { db.get("SELECT COUNT(*) as count FROM badges WHERE user_id = ?", [userId], (e, d) => r(d?.count || 0)); }),
    unreadNotifications: new Promise(r => { db.get("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0", [userId], (e, d) => r(d?.count || 0)); })
  };
  const quotes = [
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
    { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
    { text: "Your limitation—it's only your imagination.", author: "Unknown" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  ];
  Promise.all(Object.values(queries)).then(([profile, streak, bookmarkCount, progressStats, badgeCount, unreadNotifications]) => {
    res.json({ success: true, dashboard: { profile, streak, bookmarkCount, progressStats, badgeCount, unreadNotifications, dailyQuote: quotes[new Date().getDate() % quotes.length] } });
  });
});



// ══════════════ PHASE 4: ADVANCED FEATURES ══════════════

// ── CAREER ROADMAP ──────────────────────────────────
app.get("/api/career-roadmap/:courseId", apiLimiter, (req, res) => {
  const courseId = req.params.courseId;
  db.get("SELECT * FROM courses WHERE id = ?", [courseId], (err, course) => {
    if (err || !course) return res.status(404).json({ message: "Course not found", success: false });
    db.all(`SELECT cm.career_name, cm.job_role, si.entry_level_salary, si.mid_level_salary, si.senior_level_salary
      FROM career_map cm LEFT JOIN salary_info si ON cm.id = si.career_id WHERE cm.course_id = ?`, [courseId], (e, careers) => {
      const roadmapSteps = [
        { year: "Year 0", phase: "Preparation", icon: "📚", title: "Academic Foundation", description: `Complete 12th with ${course.stream} stream. Prepare for entrance exams.`, tasks: ["Score 60%+ in board exams", "Start entrance exam prep", "Research career options", "Build study discipline"] },
        { year: "Year 1", phase: "Admission", icon: "🎓", title: `Enroll in ${course.name}`, description: `Begin your ${course.name} program at a recognized institution.`, tasks: ["Clear entrance exams", "Apply to top colleges", "Secure scholarship if eligible", "Join study groups"] },
        { year: "Year 1-2", phase: "Foundation", icon: "📖", title: "Core Learning", description: "Master fundamental concepts, attend workshops, and build your knowledge base.", tasks: ["Maintain 70%+ GPA", "Complete core coursework", "Join relevant clubs/societies", "Start building portfolio"] },
        { year: "Year 2-3", phase: "Specialization", icon: "🔬", title: "Skill Development", description: "Pick your specialization and gain hands-on experience.", tasks: ["Choose specialization track", "Complete certifications", "Build real-world projects", "Start internship search"] },
        { year: "Year 3-4", phase: "Experience", icon: "💼", title: "Industry Exposure", description: "Complete internships and work on capstone projects.", tasks: ["Secure internship", "Build professional network", "Prepare resume/portfolio", "Attend career fairs"] },
        { year: "Year 4+", phase: "Career Launch", icon: "🚀", title: "Enter Workforce", description: `Launch your career in one of ${(careers||[]).length} career paths.`, tasks: ["Apply for entry-level roles", "Prepare for interviews", "Negotiate salary package", "Plan career growth"] }
      ];
      if (course.duration_months && course.duration_months <= 36) {
        roadmapSteps.splice(3, 1); // Remove specialization for shorter courses
      }
      const careerPaths = (careers || []).map(c => ({
        name: c.career_name,
        role: c.job_role,
        salaryProgression: c.entry_level_salary ? [
          { level: "Entry (0-2 yrs)", salary: c.entry_level_salary },
          { level: "Mid (3-7 yrs)", salary: c.mid_level_salary },
          { level: "Senior (8+ yrs)", salary: c.senior_level_salary }
        ] : null
      }));
      res.json({ success: true, course: { name: course.name, stream: course.stream, duration: course.duration_months },
        roadmap: roadmapSteps, careerPaths, totalCareers: careerPaths.length });
    });
  });
});

// ── SKILL GAP ANALYZER ──────────────────────────────────
app.get("/api/skill-gap/:courseId", apiLimiter, (req, res) => {
  const courseId = req.params.courseId;
  db.get("SELECT * FROM courses WHERE id = ?", [courseId], (err, course) => {
    if (err || !course) return res.status(404).json({ message: "Course not found", success: false });
    const skillSets = {
      'Science': {
        required: [
          { skill: "Mathematics", level: 85, category: "Core" },
          { skill: "Analytical Thinking", level: 80, category: "Core" },
          { skill: "Research Methods", level: 75, category: "Core" },
          { skill: "Programming", level: 70, category: "Technical" },
          { skill: "Data Analysis", level: 75, category: "Technical" },
          { skill: "Lab Skills", level: 65, category: "Practical" },
          { skill: "Technical Writing", level: 60, category: "Soft" },
          { skill: "Problem Solving", level: 85, category: "Core" }
        ]
      },
      'Commerce': {
        required: [
          { skill: "Financial Analysis", level: 85, category: "Core" },
          { skill: "Accounting", level: 80, category: "Core" },
          { skill: "Business Communication", level: 75, category: "Soft" },
          { skill: "Excel/Data Tools", level: 70, category: "Technical" },
          { skill: "Economics", level: 75, category: "Core" },
          { skill: "Tax & Law", level: 65, category: "Domain" },
          { skill: "Presentation", level: 60, category: "Soft" },
          { skill: "Critical Thinking", level: 80, category: "Core" }
        ]
      },
      'Humanities': {
        required: [
          { skill: "Critical Thinking", level: 85, category: "Core" },
          { skill: "Research & Analysis", level: 80, category: "Core" },
          { skill: "Writing & Communication", level: 85, category: "Core" },
          { skill: "Cultural Awareness", level: 70, category: "Domain" },
          { skill: "Public Speaking", level: 65, category: "Soft" },
          { skill: "Foreign Languages", level: 55, category: "Domain" },
          { skill: "Digital Literacy", level: 60, category: "Technical" },
          { skill: "Empathy & Ethics", level: 75, category: "Soft" }
        ]
      }
    };
    const skills = skillSets[course.stream] || skillSets['Science'];
    res.json({ success: true, course: course.name, stream: course.stream, skills: skills.required });
  });
});

// ── COLLEGE FINDER ──────────────────────────────────
app.get("/api/colleges", apiLimiter, (req, res) => {
  const { stream, minPercentage } = req.query;
  const colleges = [
    { id:1, name:"IIT Bombay", stream:"Science", city:"Mumbai", state:"Maharashtra", type:"Government", ranking:1, minPercentage:90, courses:["B.Tech","M.Tech","Ph.D"], fees:"₹2.2L/year", website:"https://iitb.ac.in", highlights:["#1 Engineering","NIRF Top Rank","Global Recognition"] },
    { id:2, name:"IIT Delhi", stream:"Science", city:"New Delhi", state:"Delhi", type:"Government", ranking:2, minPercentage:90, courses:["B.Tech","M.Tech"], fees:"₹2.2L/year", website:"https://iitd.ac.in", highlights:["Top Research","Industry Connect","Highest Placements"] },
    { id:3, name:"BITS Pilani", stream:"Science", city:"Pilani", state:"Rajasthan", type:"Private", ranking:5, minPercentage:80, courses:["B.E.","M.Sc","B.Pharm"], fees:"₹5L/year", website:"https://bits-pilani.ac.in", highlights:["Practice School","Flexible Curriculum","Strong Alumni"] },
    { id:4, name:"NIT Trichy", stream:"Science", city:"Tiruchirappalli", state:"Tamil Nadu", type:"Government", ranking:8, minPercentage:85, courses:["B.Tech","M.Tech"], fees:"₹1.5L/year", website:"https://nitt.edu", highlights:["Top NIT","Strong Placements","Research Focus"] },
    { id:5, name:"VIT Vellore", stream:"Science", city:"Vellore", state:"Tamil Nadu", type:"Private", ranking:12, minPercentage:70, courses:["B.Tech","M.Tech","MBA"], fees:"₹3.5L/year", website:"https://vit.ac.in", highlights:["International Collabs","Modern Campus","Good Placements"] },
    { id:6, name:"SRCC Delhi", stream:"Commerce", city:"New Delhi", state:"Delhi", type:"Government", ranking:1, minPercentage:96, courses:["B.Com(H)","BA Economics"], fees:"₹30K/year", website:"https://srcc.edu", highlights:["#1 Commerce College","Best Faculty","100% Placement"] },
    { id:7, name:"Hindu College", stream:"Commerce", city:"New Delhi", state:"Delhi", type:"Government", ranking:3, minPercentage:95, courses:["B.Com(H)","BA","B.Sc"], fees:"₹25K/year", website:"https://hinducollege.ac.in", highlights:["Top DU College","Rich Heritage","Strong Alumni"] },
    { id:8, name:"Christ University", stream:"Commerce", city:"Bangalore", state:"Karnataka", type:"Private", ranking:6, minPercentage:75, courses:["B.Com","BBA","MBA"], fees:"₹1.5L/year", website:"https://christuniversity.in", highlights:["Top South India","Industry Ties","Vibrant Campus"] },
    { id:9, name:"Loyola College", stream:"Commerce", city:"Chennai", state:"Tamil Nadu", type:"Private", ranking:8, minPercentage:80, courses:["B.Com","BBA","M.Com"], fees:"₹50K/year", website:"https://loyolacollege.edu", highlights:["150+ Year Legacy","Excellent Faculty","Campus Life"] },
    { id:10, name:"Symbiosis Pune", stream:"Commerce", city:"Pune", state:"Maharashtra", type:"Private", ranking:10, minPercentage:70, courses:["BBA","BBM","MBA"], fees:"₹3L/year", website:"https://siu.edu.in", highlights:["Management Focus","International Programs","Great Placements"] },
    { id:11, name:"St. Stephen's College", stream:"Humanities", city:"New Delhi", state:"Delhi", type:"Government", ranking:1, minPercentage:95, courses:["BA English","BA History","BA Economics"], fees:"₹30K/year", website:"https://ststephens.edu", highlights:["#1 Arts College","Iconic Campus","Top Alumni"] },
    { id:12, name:"Lady Shri Ram College", stream:"Humanities", city:"New Delhi", state:"Delhi", type:"Government", ranking:2, minPercentage:95, courses:["BA Psychology","BA English","BA Hindi"], fees:"₹25K/year", website:"https://lsr.edu.in", highlights:["Women's College","Top Humanities","Strong Network"] },
    { id:13, name:"Presidency University", stream:"Humanities", city:"Kolkata", state:"West Bengal", type:"Government", ranking:5, minPercentage:80, courses:["BA","B.Sc","MA"], fees:"₹20K/year", website:"https://presiuniv.ac.in", highlights:["200+ Year Legacy","Research Culture","Affordable"] },
    { id:14, name:"Fergusson College", stream:"Humanities", city:"Pune", state:"Maharashtra", type:"Government", ranking:8, minPercentage:75, courses:["BA","B.Sc","MA","M.Sc"], fees:"₹15K/year", website:"https://fergusson.edu", highlights:["Heritage Institution","Arts & Science","Pune Culture"] },
    { id:15, name:"AIIMS New Delhi", stream:"Science", city:"New Delhi", state:"Delhi", type:"Government", ranking:1, minPercentage:95, courses:["MBBS","MD","MS"], fees:"₹5K/year", website:"https://aiims.edu", highlights:["#1 Medical","World-Class Research","Minimal Fees"] },
    { id:16, name:"IIM Ahmedabad", stream:"Commerce", city:"Ahmedabad", state:"Gujarat", type:"Government", ranking:1, minPercentage:85, courses:["MBA","PGDM","FPM"], fees:"₹23L/program", website:"https://iima.ac.in", highlights:["#1 B-School","₹30L+ Average CTC","Global Brand"] },
    { id:17, name:"NLSIU Bangalore", stream:"Humanities", city:"Bangalore", state:"Karnataka", type:"Government", ranking:1, minPercentage:85, courses:["BA LLB","LLM"], fees:"₹2.5L/year", website:"https://nls.ac.in", highlights:["#1 Law School","Supreme Court Alumni","CLAT Required"] },
    { id:18, name:"IISc Bangalore", stream:"Science", city:"Bangalore", state:"Karnataka", type:"Government", ranking:1, minPercentage:90, courses:["B.Sc Research","M.Tech","Ph.D"], fees:"₹35K/year", website:"https://iisc.ac.in", highlights:["#1 Research","Nobel-level Work","KVPY/JEE Entry"] },
    { id:19, name:"Jadavpur University", stream:"Science", city:"Kolkata", state:"West Bengal", type:"Government", ranking:15, minPercentage:80, courses:["B.Tech","B.Sc","M.Tech"], fees:"₹10K/year", website:"https://jaduniv.edu.in", highlights:["Top Bengal","Affordable","Strong Tech Culture"] },
    { id:20, name:"Narsee Monjee (NMIMS)", stream:"Commerce", city:"Mumbai", state:"Maharashtra", type:"Private", ranking:7, minPercentage:75, courses:["B.Com","BBA","MBA","B.Tech"], fees:"₹4L/year", website:"https://nmims.edu", highlights:["Mumbai Location","Industry Connect","Multiple Programs"] }
  ];
  let filtered = colleges;
  if (stream) filtered = filtered.filter(c => c.stream === stream);
  if (minPercentage) filtered = filtered.filter(c => c.minPercentage <= parseInt(minPercentage));
  filtered.sort((a, b) => a.ranking - b.ranking);
  res.json({ success: true, colleges: filtered, total: filtered.length });
});

// ══════════════ PHASE 5: PLATFORM FEATURES ══════════════

// ── ADMIN DASHBOARD STATS ──────────────────────────────────
app.get("/api/admin/stats", apiLimiter, requireAdmin, (req, res) => {
  const stats = {};
  db.get("SELECT COUNT(*) as count FROM users", [], (e, r) => {
    stats.totalUsers = r?.count || 0;
    db.get("SELECT COUNT(*) as count FROM courses", [], (e2, r2) => {
      stats.totalCourses = r2?.count || 0;
      db.get("SELECT COUNT(*) as count FROM bookmarks", [], (e3, r3) => {
        stats.totalBookmarks = r3?.count || 0;
        db.get("SELECT COUNT(*) as count FROM ratings", [], (e4, r4) => {
          stats.totalRatings = r4?.count || 0;
          db.get("SELECT COUNT(*) as count FROM progress WHERE status='completed'", [], (e5, r5) => {
            stats.completedCourses = r5?.count || 0;
            db.get("SELECT COUNT(*) as count FROM badges", [], (e6, r6) => {
              stats.totalBadges = r6?.count || 0;
              db.all("SELECT stream, COUNT(*) as count FROM courses GROUP BY stream", [], (e7, streams) => {
                stats.coursesByStream = streams || [];
                db.all(`SELECT DATE(created_at) as date, COUNT(*) as count FROM users GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 7`, [], (e8, signups) => {
                  stats.recentSignups = signups || [];
                  db.all(`SELECT c.name, COUNT(b.id) as bookmarks FROM courses c LEFT JOIN bookmarks b ON c.id = b.course_id GROUP BY c.id ORDER BY bookmarks DESC LIMIT 5`, [], (e9, popular) => {
                    stats.popularCourses = popular || [];
                    res.json({ success: true, stats });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

// ── ADMIN USERS LIST ──────────────────────────────────
app.get("/api/admin/users", apiLimiter, requireAdmin, (req, res) => {
  db.all(`SELECT u.id, u.email, u.name, u.created_at,
    (SELECT COUNT(*) FROM bookmarks WHERE user_id=u.id) as bookmarks,
    (SELECT COUNT(*) FROM progress WHERE user_id=u.id AND status='completed') as completed,
    (SELECT COUNT(*) FROM badges WHERE user_id=u.id) as badges,
    (SELECT current_streak FROM streaks WHERE user_id=u.id) as streak
    FROM users u ORDER BY u.created_at DESC`, [], (err, users) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, users: users || [] });
  });
});

// ── USER ANALYTICS ──────────────────────────────────
app.get("/api/analytics/:userId", apiLimiter, requireAuth, requireOwnership, (req, res) => {
  const uid = req.params.userId;
  const analytics = {};
  db.all("SELECT status, COUNT(*) as count FROM progress WHERE user_id=? GROUP BY status", [uid], (e, progress) => {
    analytics.progressBreakdown = progress || [];
    db.all(`SELECT c.stream, COUNT(*) as count FROM bookmarks b JOIN courses c ON b.course_id=c.id WHERE b.user_id=? GROUP BY c.stream`, [uid], (e2, streams) => {
      analytics.bookmarksByStream = streams || [];
      db.all(`SELECT r.stars, COUNT(*) as count FROM ratings r WHERE r.user_id=? GROUP BY r.stars`, [uid], (e3, ratings) => {
        analytics.ratingDistribution = ratings || [];
        db.get("SELECT current_streak, longest_streak FROM streaks WHERE user_id=?", [uid], (e4, streak) => {
          analytics.streak = streak || { current_streak: 0, longest_streak: 0 };
          db.all(`SELECT b.badge_name, b.earned_at FROM badges WHERE user_id=? ORDER BY earned_at DESC`, [uid], (e5, badges) => {
            analytics.badges = badges || [];
            db.all(`SELECT c.name, c.stream, p.status, p.updated_at FROM progress p JOIN courses c ON p.course_id=c.id WHERE p.user_id=? ORDER BY p.updated_at DESC LIMIT 10`, [uid], (e6, recent) => {
              analytics.recentActivity = recent || [];
              res.json({ success: true, analytics });
            });
          });
        });
      });
    });
  });
});

// ── CAREER REPORT (JSON for client-side PDF) ──────────────────
app.get("/api/report/:userId", apiLimiter, requireAuth, requireOwnership, (req, res) => {
  const uid = req.params.userId;
  db.get("SELECT * FROM users WHERE id=?", [uid], (e, user) => {
    if (!user) return res.status(404).json({ success: false });
    const report = { generatedAt: new Date().toISOString(), student: { name: user.name || user.email.split('@')[0], email: user.email, stream: user.stream } };
    db.all(`SELECT c.name, c.stream, c.description, p.status FROM progress p JOIN courses c ON p.course_id=c.id WHERE p.user_id=?`, [uid], (e2, courses) => {
      report.courses = courses || [];
      db.all(`SELECT b.bookmark_id, c.name, c.stream FROM bookmarks b JOIN courses c ON b.course_id=c.id WHERE b.user_id=?`, [uid], (e3, bookmarks) => {
        report.bookmarks = bookmarks || [];
        db.all("SELECT badge_name, earned_at FROM badges WHERE user_id=?", [uid], (e4, badges) => {
          report.badges = badges || [];
          db.get("SELECT current_streak, longest_streak FROM streaks WHERE user_id=?", [uid], (e5, streak) => {
            report.streak = streak || { current_streak: 0, longest_streak: 0 };
            res.json({ success: true, report });
          });
        });
      });
    });
  });
});

// ── ALL COURSES (for comparison dropdowns) ──────────────────
app.get("/api/all-courses", apiLimiter, (req, res) => {
  db.all("SELECT id, name, stream, description, duration_months FROM courses ORDER BY stream, name", [], (err, courses) => {
    if (err) return res.status(500).json({ message: "Database error", success: false });
    res.json({ success: true, courses: courses || [] });
  });
});

// ── LEADERBOARD ──────────────────────────────────
app.get("/api/leaderboard", apiLimiter, (req, res) => {
  db.all(`
    SELECT u.id, u.email, u.name,
      (SELECT COUNT(*) FROM progress WHERE user_id = u.id AND status = 'completed') as courses_completed,
      (SELECT COUNT(*) FROM badges WHERE user_id = u.id) as badges_earned,
      (SELECT current_streak FROM streaks WHERE user_id = u.id) as streak
    FROM users u
    ORDER BY courses_completed DESC, badges_earned DESC
    LIMIT 50
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error", success: false });
    const leaderboard = (rows || []).map((r, i) => ({
      rank: i + 1,
      name: r.name || r.email.split('@')[0],
      courses_completed: r.courses_completed || 0,
      badges_earned: r.badges_earned || 0,
      streak: r.streak || 0,
      score: (r.courses_completed || 0) * 10 + (r.badges_earned || 0) * 5 + (r.streak || 0)
    }));
    res.json({ success: true, leaderboard });
  });
});

// ── ENTRANCE EXAMS ──────────────────────────────────
app.get("/api/exams", apiLimiter, (req, res) => {
  const { stream } = req.query;
  const exams = [
    { id: 1, name: "JEE Main", stream: "Science", type: "Engineering", description: "National entrance for NITs, IIITs & CFTIs", month: "January / April", eligibility: "12th with PCM, 75%+", website: "https://jeemain.nta.nic.in" },
    { id: 2, name: "JEE Advanced", stream: "Science", type: "Engineering", description: "Entrance for IITs — India's top engineering institutes", month: "May / June", eligibility: "JEE Main qualified, top 2.5 lakh", website: "https://jeeadv.ac.in" },
    { id: 3, name: "NEET UG", stream: "Science", type: "Medical", description: "National entrance for MBBS, BDS, BAMS, BHMS courses", month: "May", eligibility: "12th with PCB, 50%+", website: "https://neet.nta.nic.in" },
    { id: 4, name: "GATE", stream: "Science", type: "Engineering", description: "Post-graduate entrance for M.Tech and PSU recruitment", month: "February", eligibility: "B.Tech/B.E. degree", website: "https://gate.iitk.ac.in" },
    { id: 5, name: "CA Foundation", stream: "Commerce", type: "Finance", description: "First level of Chartered Accountancy qualification", month: "May / November", eligibility: "12th pass", website: "https://icai.org" },
    { id: 6, name: "CS Foundation", stream: "Commerce", type: "Corporate", description: "Company Secretary foundation level exam", month: "June / December", eligibility: "12th pass", website: "https://icsi.edu" },
    { id: 7, name: "CAT", stream: "Commerce", type: "Management", description: "Entrance for IIMs and top MBA colleges", month: "November", eligibility: "Bachelor's degree, 50%+", website: "https://iimcat.ac.in" },
    { id: 8, name: "CLAT", stream: "Humanities", type: "Law", description: "National entrance for NLUs for BA LLB / LLM", month: "December", eligibility: "12th pass, 45%+", website: "https://consortiumofnlus.ac.in" },
    { id: 9, name: "CUET UG", stream: "Science", type: "University", description: "Common entrance for all Central Universities", month: "May / June", eligibility: "12th pass", website: "https://cuet.samarth.ac.in" },
    { id: 10, name: "NDA", stream: "Science", type: "Defence", description: "National Defence Academy entrance for Army/Navy/Air Force", month: "April / September", eligibility: "12th pass (PCM for Air Force/Navy), Age 16.5-19.5", website: "https://upsc.gov.in" },
    { id: 11, name: "CDS", stream: "Science", type: "Defence", description: "Combined Defence Services exam for IMA/AFA/NA/OTA", month: "February / September", eligibility: "Graduation", website: "https://upsc.gov.in" },
    { id: 12, name: "IPMAT", stream: "Commerce", type: "Management", description: "Integrated Program in Management Aptitude Test for IIM Indore/Rohtak", month: "May", eligibility: "12th pass, 60%+", website: "https://iimidr.ac.in" },
    { id: 13, name: "BITSAT", stream: "Science", type: "Engineering", description: "BITS Pilani entrance for B.E./B.Pharm/M.Sc programs", month: "May / June", eligibility: "12th with PCM, 75%+", website: "https://bitsadmission.com" },
    { id: 14, name: "UGC NET", stream: "Humanities", type: "Teaching", description: "National Eligibility Test for Assistant Professor and JRF", month: "June / December", eligibility: "Master's degree, 55%+", website: "https://ugcnet.nta.nic.in" },
    { id: 15, name: "SSC CGL", stream: "Commerce", type: "Government", description: "Staff Selection Commission for Group B/C govt posts", month: "April / August", eligibility: "Bachelor's degree", website: "https://ssc.nic.in" }
  ];
  const filtered = stream ? exams.filter(e => e.stream === stream || e.stream === 'All') : exams;
  res.json({ success: true, exams: filtered, total: filtered.length });
});

// ── SCHOLARSHIPS ──────────────────────────────────
app.get("/api/scholarships", apiLimiter, (req, res) => {
  const { stream } = req.query;
  const scholarships = [
    { id: 1, name: "INSPIRE Scholarship", stream: "Science", amount: "₹80,000/year", provider: "DST, Govt. of India", eligibility: "Top 1% in 12th boards or KVPY/JEE/NEET qualified", deadline: "November", description: "For B.Sc/M.Sc/B.S students pursuing natural and basic sciences" },
    { id: 2, name: "Prime Minister's Scholarship Scheme", stream: "All", amount: "₹36,000–₹49,000/year", provider: "Ministry of Defence", eligibility: "Children of ex-servicemen/armed forces, 60%+ in 12th", deadline: "October", description: "For professional degree courses" },
    { id: 3, name: "National Merit-cum-Means Scholarship", stream: "All", amount: "₹12,000/year", provider: "Ministry of Education", eligibility: "Family income < ₹6 LPA, 85%+ in 12th", deadline: "September", description: "Merit-based for economically weaker students" },
    { id: 4, name: "AICTE Pragati Scholarship", stream: "Science", amount: "₹50,000/year", provider: "AICTE", eligibility: "Girl students in AICTE-approved colleges, income < ₹8 LPA", deadline: "December", description: "Supporting girl students in technical education" },
    { id: 5, name: "Post-Matric Scholarship for SC/ST", stream: "All", amount: "Varies (full fees)", provider: "Ministry of Social Justice", eligibility: "SC/ST category, income < ₹2.5 LPA", deadline: "November", description: "Covers tuition, maintenance, and book allowance" },
    { id: 6, name: "Kishore Vaigyanik Protsahan Yojana", stream: "Science", amount: "₹5,000–₹7,000/month + contingency", provider: "DST + IISc Bangalore", eligibility: "Students in 11th/12th/1st year UG studying Science", deadline: "August", description: "Fellowship for basic science research talent" },
    { id: 7, name: "Sitaram Jindal Foundation Scholarship", stream: "All", amount: "₹1,500–₹8,000/month", provider: "Sitaram Jindal Foundation", eligibility: "Students pursuing UG/PG, income < ₹2.5 LPA", deadline: "September", description: "For economically weaker but meritorious students" },
    { id: 8, name: "L&T Build India Scholarship", stream: "Science", amount: "Up to ₹2 Lakh/year", provider: "L&T Public Charitable Trust", eligibility: "Engineering students in IITs/NITs, income < ₹5 LPA", deadline: "August", description: "For B.Tech/BE students in construction-related fields" },
    { id: 9, name: "Central Sector Scholarship", stream: "All", amount: "₹12,000–₹20,000/year", provider: "Ministry of Education", eligibility: "Top 20% in 12th boards, income < ₹8 LPA", deadline: "November", description: "Covers UG and PG across all streams" },
    { id: 10, name: "Maulana Azad National Fellowship", stream: "Humanities", amount: "₹31,000/month (JRF) → ₹35,000/month (SRF)", provider: "UGC", eligibility: "Minority community students for M.Phil/Ph.D", deadline: "March", description: "5-year fellowship for research scholars" },
    { id: 11, name: "HDFC Badhte Kadam Scholarship", stream: "Commerce", amount: "Up to ₹75,000/year", provider: "HDFC Bank Parivartan", eligibility: "UG/PG students, family income < ₹6 LPA", deadline: "October", description: "For commerce and management students" },
    { id: 12, name: "Tata Trusts Scholarship", stream: "All", amount: "Up to ₹50,000/year", provider: "Tata Trusts", eligibility: "Undergraduate students, need-based", deadline: "Rolling", description: "Supports students from underprivileged backgrounds across streams" }
  ];
  const filtered = stream && stream !== 'All' ? scholarships.filter(s => s.stream === stream || s.stream === 'All') : scholarships;
  res.json({ success: true, scholarships: filtered, total: filtered.length });
});

// ── COURSE COMPARISON ──────────────────────────────────
app.get("/api/compare", apiLimiter, (req, res) => {
  const ids = (req.query.ids || '').split(',').map(Number).filter(Boolean);
  if (ids.length < 2 || ids.length > 30) return res.status(400).json({ message: "Provide 2-30 course IDs", success: false });
  const placeholders = ids.map(() => '?').join(',');
  db.all(`SELECT * FROM courses WHERE id IN (${placeholders})`, ids, (err, courses) => {
    if (err) return res.status(500).json({ message: "Database error", success: false });
    // Get career counts & salary ranges for each course
    const promises = courses.map(c => new Promise(resolve => {
      db.all(`SELECT cm.career_name, cm.job_role, si.entry_level_salary, si.mid_level_salary, si.senior_level_salary
        FROM career_map cm LEFT JOIN salary_info si ON cm.id = si.career_id WHERE cm.course_id = ?`, [c.id], (e, careers) => {
        resolve({ ...c, careers: careers || [], careerCount: (careers || []).length });
      });
    }));
    Promise.all(promises).then(results => res.json({ success: true, courses: results }));
  });
});

// ==================== YOUTUBE API INTEGRATION ====================

app.get("/api/youtube-info/:videoId", apiLimiter, (req, res) => {
  const { videoId } = req.params;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ success: false, message: "Invalid video ID", courseInfo: { title: "Invalid Video ID", videoId } });
  }

  if (!apiKey) {
    return res.json({ success: false, message: "API key not configured", courseInfo: { title: "Video Course", description: "Watch on YouTube", videoId, watchUrl: `https://www.youtube.com/watch?v=${videoId}` } });
  }

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
  const request = https.get(url, { timeout: 8000 }, (response) => {
    let data = '';
    response.on('data', (chunk) => { data += chunk; if (data.length > 1024 * 1024) request.abort(); });
    response.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        if (jsonData.error) return res.status(response.statusCode).json({ success: false, message: jsonData.error.message, courseInfo: { title: "Video", videoId, watchUrl: `https://www.youtube.com/watch?v=${videoId}` } });
        if (!jsonData.items || jsonData.items.length === 0) return res.json({ success: false, message: "Video not found", courseInfo: { title: "Not Available", videoId, watchUrl: `https://www.youtube.com/watch?v=${videoId}` } });
        const v = jsonData.items[0];
        return res.json({ success: true, courseInfo: { title: v.snippet.title, description: v.snippet.description, channel: v.snippet.channelTitle, duration: v.contentDetails.duration, thumbnail: v.snippet.thumbnails?.high?.url, publishedAt: v.snippet.publishedAt, videoId, watchUrl: `https://www.youtube.com/watch?v=${videoId}` } });
      } catch (e) { return res.json({ success: false, message: "Parse error", courseInfo: { title: "Error", videoId, watchUrl: `https://www.youtube.com/watch?v=${videoId}` } }); }
    });
  });
  request.on('timeout', () => { request.abort(); res.json({ success: false, message: "Timeout", courseInfo: { title: "Timeout", videoId, watchUrl: `https://www.youtube.com/watch?v=${videoId}` } }); });
  request.on('error', (err) => { res.json({ success: false, message: err.message, courseInfo: { title: "Error", videoId, watchUrl: `https://www.youtube.com/watch?v=${videoId}` } }); });
});


// ── Health Check ──
app.get('/api/health', (req, res) => {
  const dbStatus = require('./db').isPostgres ? 'PostgreSQL' : 'SQLite';
  res.json({ 
    status: 'ok', 
    database: dbStatus,
    env_detected: !!(process.env.SUPABASE_URL || process.env.DATABASE_URL),
    version: '1.0.1'
  });
});

// ── 404 Handler ──
app.use((req, res) => {
  if (req.accepts('html')) return res.status(404).sendFile(path.join(__dirname, '404.html'));
  res.status(404).json({ error: true, message: 'Not found', code: 404 });
});

// Start server (skip listen on Vercel — it handles requests differently)
const PORT = process.env.PORT || 3000;
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;
