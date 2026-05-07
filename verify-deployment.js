#!/usr/bin/env node
/**
 * Career Course Compass — Deployment Verification Script
 * Tests all API endpoints and reports PASS/FAIL
 */

const BASE = process.env.TEST_URL || 'http://localhost:3000';

async function seedTestUser() {
  // Wait a bit for DB tables to be created on fresh start
  await new Promise(r => setTimeout(r, 1000));
  try {
    const res = await fetch(`${BASE}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'verify@test.com', password: 'test123456', confirmPassword: 'test123456' })
    });
    const data = await res.json();
    // Get user ID from admin users list
    const usersRes = await fetch(`${BASE}/api/admin/users`).then(r => r.json());
    if (usersRes.success && usersRes.users.length > 0) return usersRes.users[0].id;
    return 1;
  } catch { return 1; }
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   Career Course Compass — Deployment Verification       ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║   Target: ${BASE.padEnd(45)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Seed a test user so user-specific endpoints work
  const userId = await seedTestUser();
  console.log(`  Seeded test user (ID: ${userId})\n`);

  const tests = [
    // Health & Static
    { method: 'GET', url: '/api/health', expect: 200, desc: 'Health check' },
    // Courses
    { method: 'GET', url: '/api/courses', expect: 200, desc: 'List all courses' },
    { method: 'GET', url: '/api/course/1', expect: 200, desc: 'Get single course' },
    { method: 'GET', url: '/api/all-courses', expect: 200, desc: 'All courses (lite)' },
    // User Profile & Dashboard
    { method: 'GET', url: `/api/dashboard/${userId}`, expect: 200, desc: 'User dashboard' },
    { method: 'GET', url: `/api/profile/${userId}`, expect: 200, desc: 'User profile' },
    // Engagement
    { method: 'GET', url: `/api/bookmarks/${userId}`, expect: 200, desc: 'User bookmarks' },
    { method: 'GET', url: `/api/progress/${userId}`, expect: 200, desc: 'User progress' },
    { method: 'GET', url: '/api/ratings/1', expect: 200, desc: 'Course ratings' },
    { method: 'GET', url: `/api/badges/${userId}`, expect: 200, desc: 'User badges' },
    { method: 'GET', url: `/api/streaks/${userId}`, expect: 200, desc: 'User streaks' },
    { method: 'GET', url: `/api/notifications/${userId}`, expect: 200, desc: 'Notifications' },
    // Phase 3
    { method: 'GET', url: '/api/leaderboard', expect: 200, desc: 'Leaderboard' },
    { method: 'GET', url: '/api/exams', expect: 200, desc: 'Entrance exams' },
    { method: 'GET', url: '/api/scholarships', expect: 200, desc: 'Scholarships' },
    { method: 'GET', url: '/api/compare?ids=1,2', expect: 200, desc: 'Compare courses' },
    // Phase 4
    { method: 'GET', url: '/api/career-roadmap/1', expect: 200, desc: 'Career roadmap' },
    { method: 'GET', url: '/api/skill-gap/1', expect: 200, desc: 'Skill gap analyzer' },
    { method: 'GET', url: '/api/colleges?stream=Science', expect: 200, desc: 'College finder' },
    // Phase 5
    { method: 'GET', url: '/api/admin/stats', expect: 200, desc: 'Admin stats' },
    { method: 'GET', url: '/api/admin/users', expect: 200, desc: 'Admin users' },
    { method: 'GET', url: `/api/analytics/${userId}`, expect: 200, desc: 'User analytics' },
    { method: 'GET', url: `/api/report/${userId}`, expect: 200, desc: 'Career report' },
  ];

  let passed = 0, failed = 0;
  const results = [];

  for (const t of tests) {
    try {
      const res = await fetch(`${BASE}${t.url}`, { method: t.method });
      const ok = res.status === t.expect;
      if (ok) passed++; else failed++;
      let bodyCheck = '';
      if (ok) {
        try {
          const json = await res.json();
          bodyCheck = json.success !== undefined ? (json.success ? '✓ valid' : '⚠ success=false') : '✓ json';
        } catch { bodyCheck = '✓ non-json'; }
      }
      results.push({
        status: ok ? '✅ PASS' : '❌ FAIL',
        method: t.method,
        url: t.url,
        expected: t.expect,
        actual: res.status,
        desc: t.desc,
        body: bodyCheck
      });
    } catch (err) {
      failed++;
      results.push({
        status: '❌ FAIL',
        method: t.method,
        url: t.url,
        expected: t.expect,
        actual: 'ERR',
        desc: t.desc,
        body: err.message.substring(0, 30)
      });
    }
  }

  // Print results table
  console.log('┌────────┬────────┬─────────────────────────────────┬──────┬──────┬────────────┐');
  console.log('│ Status │ Method │ Endpoint                        │ Exp  │ Got  │ Body       │');
  console.log('├────────┼────────┼─────────────────────────────────┼──────┼──────┼────────────┤');
  for (const r of results) {
    console.log(`│ ${r.status.padEnd(7)}│ ${r.method.padEnd(7)}│ ${r.url.padEnd(32)}│ ${String(r.expected).padEnd(5)}│ ${String(r.actual).padEnd(5)}│ ${(r.body||'').padEnd(11)}│`);
  }
  console.log('└────────┴────────┴─────────────────────────────────┴──────┴──────┴────────────┘');

  console.log(`\n  Results: ${passed} passed, ${failed} failed, ${tests.length} total`);
  console.log(failed === 0 ? '\n  🎉 ALL TESTS PASSED — Ready for deployment!' : '\n  ⚠️  Some tests failed — fix issues before deploying.');
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
