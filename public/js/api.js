/* ════════════════════════════════════════════════
   api.js — Centralized API client for VoiceEcho
   Handles JWT attach, silent refresh on 401
════════════════════════════════════════════════ */

const BASE = '/api';

/* ── Token storage ──────────────────────────── */
export const tokens = {
  get access()  { return localStorage.getItem('ve_access'); },
  get refresh() { return localStorage.getItem('ve_refresh'); },
  set(access, refresh) {
    localStorage.setItem('ve_access', access);
    if (refresh) localStorage.setItem('ve_refresh', refresh);
  },
  clear() {
    localStorage.removeItem('ve_access');
    localStorage.removeItem('ve_refresh');
  },
};

/* ── Internal fetch with auto-refresh ───────── */
let _refreshing = null; // deduplicate parallel refresh attempts

async function _request(path, options = {}, retry = true) {
  const headers = { ...(options.headers || {}) };

  // attach access token unless body is FormData
  if (tokens.access) {
    headers['Authorization'] = `Bearer ${tokens.access}`;
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Prevent browser caching of API responses (crucial for real-time dashboard updates)
  options.cache = 'no-store';

  const res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' });

  // 401 → try silent refresh once
  if (res.status === 401 && retry && tokens.refresh) {
    if (!_refreshing) {
      _refreshing = _doRefresh().finally(() => { _refreshing = null; });
    }
    const refreshed = await _refreshing;
    if (refreshed) return _request(path, options, false);
    tokens.clear();
    window.dispatchEvent(new Event('ve:logout'));
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg = data.message || `Request failed (${res.status})`;
    if (data.errors && data.errors.length > 0) {
      const specificError = data.errors[0].msg || data.errors[0];
      msg = specificError || msg;
    }
    throw new Error(msg);
  }
  return data;
}

async function _doRefresh() {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refresh }),
    });
    if (!res.ok) return false;
    const { data } = await res.json();
    tokens.set(data.accessToken, data.refreshToken ?? null);
    return true;
  } catch {
    return false;
  }
}

/* ── Public API helpers ─────────────────────── */
export const api = {
  get:    (path)         => _request(path, { method: 'GET' }),
  post:   (path, body)   => _request(path, { method: 'POST',   body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch:  (path, body)   => _request(path, { method: 'PATCH',  body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  delete: (path)         => _request(path, { method: 'DELETE' }),
};

/* ── Auth convenience ───────────────────────── */
export const authApi = {
  register: (name, email, password) =>
    _request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }, false),

  login: (email, password) =>
    _request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false),

  logout: () => _request('/auth/logout', { method: 'POST' }, false),

  me: () => api.get('/auth/me'),
};
