function apiUrl(path) {
  const base = (window.API_BASE || '').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function api(path, options = {}) {
  const res = await fetch(apiUrl(path), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function getMe() {
  try {
    return await api('/api/me');
  } catch {
    return null;
  }
}

async function logout() {
  try {
    await api('/api/logout', { method: 'POST', body: '{}' });
  } finally {
    window.location.href = '/';
  }
}

function requireRole(user, role, redirect = '/') {
  if (!user) {
    window.location.href = '/';
    return false;
  }
  if (role && user.role !== role) {
    window.location.href = redirect;
    return false;
  }
  return true;
}

function wireLogout() {
  const btn = document.getElementById('logout-btn');
  if (btn) btn.addEventListener('click', logout);
}

function setUserLabel(user) {
  const el = document.getElementById('user-label');
  if (el && user) {
    el.textContent = `${user.name} · ${user.role}`;
  }
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
