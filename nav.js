// nav.js — Clean professional navbar + auth helper

// ─── Global authFetch: wraps fetch to include Bearer token ───
// Vercel serverless loses in-memory sessions. This sends the HMAC token
// with every API request so the server can authenticate stateless requests.
window.authFetch = function(url, options = {}) {
  const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  if (token) {
    options.headers = options.headers || {};
    if (typeof options.headers === 'object' && !(options.headers instanceof Headers)) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }
  }
  // Always include credentials for cookie-based sessions (local dev)
  options.credentials = options.credentials || 'include';
  return fetch(url, options);
};

// ─── Auto re-login check ───
// If user has userId but no authToken, their session predates the token system.
// Force re-login so a fresh token is generated and stored.
(function() {
  const userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
  const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  const isLoginPage = window.location.pathname.endsWith('login.html') || window.location.pathname === '/';
  if (userId && !token && !isLoginPage) {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
  }
})();

(function () {
  const container = document.getElementById('navbar-container');
  if (!container) return;

  const currentPage = window.location.pathname.split('/').pop() || 'recommendation.html';

  const navLinks = [
    { href: 'recommendation.html', label: 'Recommendations' },
    { href: 'compare.html',        label: 'Compare' },
    { href: 'bookmarks.html',      label: 'Saved Courses' },
  ];

  const linksHTML = navLinks.map(link => {
    const isActive = currentPage === link.href;
    return `<a href="${link.href}" class="ccc-nav-link ${isActive ? 'active' : ''}">${link.label}</a>`;
  }).join('');

  container.innerHTML = `
    <style>
      .ccc-nav {
        position: sticky; top: 0; z-index: 100;
        background: #faf8f5;
        border-bottom: 1px solid #e8e4dd;
        padding: 0 24px;
      }
      .ccc-nav-inner {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 56px;
        gap: 16px;
      }
      .ccc-nav-logo {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        font-weight: 700;
        color: #111827;
        text-decoration: none;
        white-space: nowrap;
        letter-spacing: -0.02em;
      }
      .ccc-nav-logo img {
        width: 24px;
        height: 24px;
      }
      .ccc-nav-logo span {
        color: #4338ca;
      }
      .ccc-nav-links {
        display: flex;
        gap: 2px;
      }
      .ccc-nav-link {
        color: #6b7280;
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
        padding: 6px 14px;
        border-radius: 6px;
        transition: color 0.15s, background 0.15s;
      }
      .ccc-nav-link:hover {
        color: #111827;
        background: #f3f4f6;
      }
      .ccc-nav-link.active {
        color: #4338ca;
        background: rgba(67,56,202,0.06);
        font-weight: 600;
      }
      .ccc-nav-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ccc-logout {
        background: none;
        border: 1px solid #e5e7eb;
        color: #6b7280;
        font-size: 13px;
        padding: 6px 14px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.15s;
      }
      .ccc-logout:hover {
        border-color: #dc2626;
        color: #dc2626;
        background: rgba(220,38,38,0.04);
      }
      @media(max-width:768px) {
        .ccc-nav-links { display: none; }
        .ccc-nav { padding: 0 16px; }
      }
    </style>
    <nav class="ccc-nav">
      <div class="ccc-nav-inner">
        <a href="recommendation.html" class="ccc-nav-logo">
          <img src="logo.svg" alt="CCC Logo">
          Career <span>Course</span> Compass
        </a>
        <div class="ccc-nav-links">${linksHTML}</div>
        <div class="ccc-nav-right">
          <button class="ccc-logout" onclick="logout()">Log out</button>
        </div>
      </div>
    </nav>`;

  if (typeof window.logout !== 'function') {
    window.logout = async function () {
      try { await fetch('/logout'); } catch (e) {}
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = 'login.html';
    };
  }
})();
