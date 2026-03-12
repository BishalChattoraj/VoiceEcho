/* ════════════════════════════════════════════════
   auth.js — Login, Register, page guard
════════════════════════════════════════════════ */

import { authApi, tokens } from './api.js';

/* ── Helpers ────────────────────────────────── */
function showForm(id) {
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function setLoading(btn, loaderId, loading) {
  const b = document.getElementById(btn);
  const l = document.getElementById(loaderId);
  if (!b) return;
  const text = b.querySelector('.btn-text');
  const loader = b.querySelector('.btn-loader');
  b.disabled = loading;
  text && (text.style.opacity = loading ? '0' : '1');
  loader && loader.classList.toggle('hidden', !loading);
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideError(id) {
  document.getElementById(id)?.classList.add('hidden');
}

/* ── Expose for app.js ──────────────────────── */
export function isLoggedIn() { return !!tokens.access || !!tokens.refresh; }

export function showAuth() {
  document.getElementById('auth-overlay')?.classList.remove('hidden');
  document.getElementById('main-app')?.classList.add('hidden');
}

export function hideAuth() {
  document.getElementById('auth-overlay')?.classList.add('hidden');
  document.getElementById('main-app')?.classList.remove('hidden');
}

/* ── Login form ─────────────────────────────── */
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError('login-error');
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return showError('login-error', 'Please fill in all fields.');

  setLoading('login-btn', '', true);
  try {
    const res = await authApi.login(email, password);
    tokens.set(res.data.accessToken, res.data.refreshToken);
    // Dispatch event — app.js will handle the transition
    window.dispatchEvent(new Event('ve:login'));
  } catch (err) {
    showError('login-error', err.message || 'Login failed. Check your credentials.');
  } finally {
    setLoading('login-btn', '', false);
  }
});

/* ── Register form ──────────────────────────── */
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError('register-error');
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!name || !email || !password) return showError('register-error', 'Please fill in all fields.');
  if (password.length < 8) return showError('register-error', 'Password must be at least 8 characters.');

  setLoading('register-btn', '', true);
  try {
    const res = await authApi.register(name, email, password);
    tokens.set(res.data.accessToken, res.data.refreshToken);
    window.dispatchEvent(new Event('ve:login'));
  } catch (err) {
    showError('register-error', err.message || 'Registration failed. Try a different email.');
  } finally {
    setLoading('register-btn', '', false);
  }
});

/* ── Switch forms ───────────────────────────── */
document.getElementById('goto-register')?.addEventListener('click', (e) => { e.preventDefault(); showForm('register-form'); });
document.getElementById('goto-login')?.addEventListener('click',    (e) => { e.preventDefault(); showForm('login-form'); });
