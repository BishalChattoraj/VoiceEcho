/* ════════════════════════════════════════════════
   app.js — SPA Router + App Controller
════════════════════════════════════════════════ */

import { tokens, authApi } from './api.js';
import { isLoggedIn, showAuth, hideAuth } from './auth.js';
import { initJournal, loadJournal, loadRecentEntries } from './journal.js';
import { initAnalytics, loadDashboardStats, loadWeeklyCharts } from './analytics.js';

/* ═══════════════════════════════════════════════
   GREETING
══════════════════════════════════════════════ */
function getGreeting(name) {
  const h = new Date().getHours();
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${time}, ${name}! How are you feeling today?`;
}

/* ═══════════════════════════════════════════════
   ROUTER — hash-based
══════════════════════════════════════════════ */
const PAGES = ['dashboard', 'journal', 'record', 'analytics'];

function navigate(page) {
  if (!PAGES.includes(page)) page = 'dashboard';

  // Hide all pages
  PAGES.forEach(p => {
    document.getElementById(`page-${p}`)?.classList.remove('active');
    document.getElementById(`nav-${p}`)?.classList.remove('active');
  });

  // Show target page
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.getElementById(`nav-${page}`)?.classList.add('active');

  // Page-specific data loading
  if (page === 'dashboard') {
    loadDashboard();
  } else if (page === 'journal') {
    loadJournal(1);
  } else if (page === 'analytics') {
    initAnalytics();
  }
}

function hashPage() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  return PAGES.includes(hash) ? hash : 'dashboard';
}

window.addEventListener('hashchange', () => navigate(hashPage()));

/* ═══════════════════════════════════════════════
   DASHBOARD LOADER
══════════════════════════════════════════════ */
async function loadDashboard() {
  await Promise.all([
    loadRecentEntries(),
    loadDashboardStats(),
    loadWeeklyCharts(),
  ]);
}

/* ═══════════════════════════════════════════════
   USER PROFILE DISPLAY
══════════════════════════════════════════════ */
async function loadUserProfile() {
  try {
    const res  = await authApi.me();
    const user = res.data.user;
    const nameEl   = document.getElementById('user-name-display');
    const avatarEl = document.getElementById('user-avatar');
    const greetEl  = document.getElementById('dashboard-greeting');
    if (nameEl)   nameEl.textContent   = user.name;
    if (avatarEl) avatarEl.textContent = user.name?.[0]?.toUpperCase() ?? '?';
    if (greetEl)  greetEl.textContent  = getGreeting(user.name.split(' ')[0]);
  } catch { /* token may be expired — refresh will handle */ }
}

/* ═══════════════════════════════════════════════
   SIDEBAR TOGGLE
══════════════════════════════════════════════ */
function initSidebar() {
  const toggle  = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  toggle?.addEventListener('click', () => sidebar?.classList.toggle('collapsed'));

  // Nav link clicks
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      window.location.hash = `#${page}`;
    });
  });

  // Dashboard quick links
  document.getElementById('dash-new-entry')?.addEventListener('click', () => { window.location.hash = '#journal'; });
  document.getElementById('see-all-link')?.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#journal'; });
}

/* ═══════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════ */
function initLogout() {
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    tokens.clear();
    showAuth();
    window.location.hash = '';
  });
}

/* ═══════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════ */
async function boot() {
  initSidebar();
  initLogout();
  initJournal(); // sets up event listeners

  if (isLoggedIn()) {
    hideAuth();
    await loadUserProfile();
    navigate(hashPage());
  } else {
    showAuth();
  }
}

/* ── Auth events ──────────────────────────── */
window.addEventListener('ve:login', async () => {
  hideAuth();
  await loadUserProfile();
  navigate('dashboard');
});

window.addEventListener('ve:logout', () => {
  tokens.clear();
  showAuth();
});

/* ── Real-time updates ────────────────────── */
window.addEventListener('ve:new_entry', () => {
  const page = hashPage();
  if (page === 'dashboard') loadDashboard();
  if (page === 'journal') loadJournal(1);
  if (page === 'analytics') initAnalytics();
});

/* ── Boot ─────────────────────────────────── */
document.addEventListener('DOMContentLoaded', boot);
