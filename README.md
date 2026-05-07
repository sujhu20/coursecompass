# 🧭 Career Course Compass

> A comprehensive, gamified career guidance platform for Indian students — recommending courses, careers, and colleges based on stream and percentage.

## ✨ Features (25/25)

### Phase 1 — Core & Security
- ✅ User login/signup with bcrypt password hashing
- ✅ Google OAuth 2.0 authentication
- ✅ Rate limiting on auth + API routes
- ✅ Session management with secure cookies
- ✅ Helmet security headers + CSP

### Phase 2 — Personalization & Engagement
- ✅ Student dashboard with streak tracking & progress
- ✅ Course bookmarking system
- ✅ Per-course progress tracking (Not Started → In Progress → Completed)
- ✅ Star rating & review system
- ✅ Badge/achievement system (9 badges)
- ✅ Notification panel
- ✅ User profile management

### Phase 3 — Advanced Engagement
- ✅ Competitive leaderboard with podium
- ✅ Entrance exam tracker (15 major Indian exams)
- ✅ Scholarship finder (12 scholarships)
- ✅ Side-by-side course comparison tool

### Phase 4 — Career Tools
- ✅ Career roadmap generator (visual timeline)
- ✅ Skill gap analyzer (interactive self-rating)
- ✅ College finder (20 top Indian colleges)

### Phase 5 — Platform & Admin
- ✅ Admin dashboard with platform analytics
- ✅ Student analytics page (donut chart, streaks)
- ✅ Downloadable career report
- ✅ Health monitoring endpoint
- ✅ Custom 404 error page

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express.js |
| Database | SQLite3 |
| Auth | bcrypt + Passport.js (Google OAuth 2.0) |
| Frontend | Vanilla HTML/CSS/JS |
| Security | Helmet, rate-limit, CSP, compression |

## 🚀 Setup Instructions

### Prerequisites
- Node.js >= 18.0.0
- npm

### Installation
```bash
git clone <repo-url>
cd career-course-compass
# Create a .env file and add your keys
npm install
npm start                   # http://localhost:3000
```

### Development
```bash
npm run dev                 # Uses nodemon for hot reload
```

### Testing
```bash
npm test                    # Runs verify-deployment.js
```

## 🔑 Environment Variables

| Variable | Description | Required |
|----------|------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `SESSION_SECRET` | 64-char random string | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | For OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | For OAuth |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key | For videos |
| `NODE_ENV` | `development` or `production` | No |

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/signup` | Register new user |
| POST | `/api/login` | Login with email/password |
| POST | `/api/google-auth` | Google OAuth login |
| GET | `/api/auth-status` | Check session status |
| GET | `/logout` | Destroy session |

### Courses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/courses` | List all courses |
| GET | `/api/course/:id` | Single course details |
| GET | `/api/all-courses` | Courses for dropdowns |
| POST | `/api/recommend-courses` | Get recommendations |

### User Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/:userId` | Dashboard stats |
| GET/PUT | `/api/profile/:userId` | Profile CRUD |
| GET/POST/DELETE | `/api/bookmarks/:userId` | Bookmark management |
| GET/PUT | `/api/progress/:userId` | Progress tracking |
| GET/POST | `/api/ratings/:courseId` | Course ratings |
| GET | `/api/badges/:userId` | User badges |
| GET/POST | `/api/streaks/:userId` | Streak management |
| GET/PUT | `/api/notifications/:userId` | Notifications |

### Phase 3-5 Features
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leaderboard` | Top students ranking |
| GET | `/api/exams?stream=` | Entrance exams |
| GET | `/api/scholarships?stream=` | Scholarships |
| GET | `/api/compare?ids=1,2` | Compare courses |
| GET | `/api/career-roadmap/:courseId` | Career timeline |
| GET | `/api/skill-gap/:courseId` | Skill requirements |
| GET | `/api/colleges?stream=&minPercentage=` | College finder |
| GET | `/api/admin/stats` | Platform analytics |
| GET | `/api/admin/users` | User management |
| GET | `/api/analytics/:userId` | Personal analytics |
| GET | `/api/report/:userId` | Career report data |
| GET | `/api/health` | Health check |

## 🚀 Deployment

### Render.com (Recommended — Free Tier)
1. Push to GitHub
2. Create new Web Service on Render
3. Connect your repository
4. Render auto-detects `render.yaml`
5. Add environment variables in Render dashboard
6. Deploy!

### Railway / Heroku
Uses `Procfile` — `web: node server.js`

### Manual VPS
```bash
npm install --production
NODE_ENV=production node server.js
```

## 📄 License

MIT License — Career Course Compass Team
