(async function initTeacher() {
  const me = await getMe();
  if (!requireRole(me?.user, 'teacher', '/student.html')) return;
  setUserLabel(me.user);
  wireLogout();

  const setupPanel = document.getElementById('setup-panel');
  const livePanel = document.getElementById('live-panel');
  const createForm = document.getElementById('create-form');
  const qrImage = document.getElementById('qr-image');
  const qrError = document.getElementById('qr-error');
  const countdownNum = document.getElementById('countdown-num');
  const countdownLabel = document.getElementById('countdown-label');
  const countdownRing = document.getElementById('countdown-ring');
  const tokenVersionEl = document.getElementById('token-version');
  const presentCountEl = document.getElementById('present-count');
  const liveTitle = document.getElementById('live-title');
  const rosterSide = document.getElementById('roster-side');
  const rosterList = document.getElementById('roster-list');
  const rosterEmpty = document.getElementById('roster-empty');

  let sessionId = null;
  let pollTimer = null;
  let rosterTimer = null;
  let localCountdown = null;
  let expiresAt = 0;
  let intervalMs = 10_000;
  const RING_LEN = 97.4;

  async function loadPastSessions() {
    const { sessions } = await api('/api/sessions');
    const wrap = document.getElementById('past-sessions');
    const list = document.getElementById('session-list');
    if (!sessions.length) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    list.innerHTML = sessions
      .map(
        (s) => `<li>
          <span>${escapeHtml(s.title)} · ${s.attendanceCount} present ${s.active ? '(live)' : ''}</span>
          ${s.active ? `<button type="button" data-resume="${s.id}">Show QR</button>` : `<button type="button" data-roster="${s.id}">View roster</button>`}
        </li>`
      )
      .join('');
    list.querySelectorAll('[data-resume]').forEach((btn) => {
      btn.addEventListener('click', () => enterLive(btn.dataset.resume));
    });
    list.querySelectorAll('[data-roster]').forEach((btn) => {
      btn.addEventListener('click', () => showRosterOnly(btn.dataset.roster));
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('session-title').value.trim();
    const sess = await api('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    await enterLive(sess.id, sess.title);
  });

  async function enterLive(id, title) {
    sessionId = id;
    if (!title) {
      const info = await api(`/api/sessions/${id}`);
      title = info.title;
    }
    liveTitle.textContent = title;
    setupPanel.hidden = true;
    livePanel.hidden = false;
    stopPolling();
    await refreshToken();
    pollTimer = setInterval(refreshToken, 1500);
    rosterTimer = setInterval(refreshRoster, 3000);
    await refreshRoster();
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    if (rosterTimer) clearInterval(rosterTimer);
    if (localCountdown) clearInterval(localCountdown);
    pollTimer = rosterTimer = localCountdown = null;
  }

  async function refreshToken() {
    try {
      const data = await api(`/api/sessions/${sessionId}/token`);
      intervalMs = data.intervalMs;
      expiresAt = Date.now() + data.expiresInMs;
      tokenVersionEl.textContent = data.version;
      if (!data.qrDataUrl) {
        throw new Error('Server did not return a QR image');
      }
      qrImage.src = data.qrDataUrl;
      qrError.hidden = true;
      startLocalCountdown();
    } catch (err) {
      qrError.textContent = err.message || 'Could not load QR code';
      qrError.hidden = false;
      if (err.status === 400) {
        stopPolling();
        alert(err.message);
      }
    }
  }

  function formatRemaining(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function startLocalCountdown() {
    if (localCountdown) clearInterval(localCountdown);
    const tick = () => {
      const remaining = Math.max(0, expiresAt - Date.now());
      const label = formatRemaining(remaining);
      countdownNum.textContent = label;
      countdownLabel.textContent = label;
      const progress = remaining / intervalMs;
      countdownRing.style.strokeDashoffset = String(RING_LEN * (1 - progress));
    };
    tick();
    localCountdown = setInterval(tick, 200);
  }

  async function refreshRoster() {
    if (!sessionId) return;
    const data = await api(`/api/sessions/${sessionId}/attendance`);
    presentCountEl.textContent = String(data.records.length);
    if (!data.records.length) {
      rosterList.innerHTML = '';
      rosterEmpty.hidden = false;
      return;
    }
    rosterEmpty.hidden = true;
    rosterList.innerHTML = data.records
      .map(
        (r) => `<li>
          <span>${escapeHtml(r.studentName)} <small class="muted">(@${escapeHtml(r.username)})</small></span>
          <span class="muted">${formatTime(r.markedAt)}</span>
        </li>`
      )
      .join('');
  }

  async function showRosterOnly(id) {
    sessionId = id;
    const info = await api(`/api/sessions/${id}`);
    liveTitle.textContent = info.title;
    setupPanel.hidden = true;
    livePanel.hidden = false;
    document.querySelector('.qr-stage').hidden = true;
    document.getElementById('close-session-btn').hidden = !info.active;
    rosterSide.hidden = false;
    await refreshRoster();
  }

  document.getElementById('view-roster-btn').addEventListener('click', () => {
    rosterSide.hidden = !rosterSide.hidden;
    if (!rosterSide.hidden) refreshRoster();
  });

  document.getElementById('close-session-btn').addEventListener('click', async () => {
    if (!sessionId) return;
    if (!confirm('Close this session? The QR will stop working.')) return;
    await api(`/api/sessions/${sessionId}/close`, { method: 'POST', body: '{}' });
    stopPolling();
    alert('Session closed.');
    window.location.reload();
  });

  await loadPastSessions();
})();
