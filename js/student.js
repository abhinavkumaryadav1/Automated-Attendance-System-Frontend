(async function initStudent() {
  const me = await getMe();
  if (!requireRole(me?.user, 'student', '/teacher.html')) return;
  setUserLabel(me.user);
  wireLogout();

  const scanIntro = document.getElementById('scan-intro');
  const scannerPanel = document.getElementById('scanner-panel');
  const resultPanel = document.getElementById('result-panel');
  const resultCard = document.getElementById('result-card');
  const startBtn = document.getElementById('start-scan-btn');
  const stopBtn = document.getElementById('stop-scan-btn');
  const againBtn = document.getElementById('scan-again-btn');

  let html5QrCode = null;
  let handling = false;

  async function loadOpenSessions() {
    const { sessions } = await api('/api/sessions');
    const list = document.getElementById('open-session-list');
    const empty = document.getElementById('no-sessions');
    const active = sessions.filter((s) => s.active);
    if (!active.length) {
      list.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    list.innerHTML = active
      .map(
        (s) => `<li>
          <span>${escapeHtml(s.title)} · ${escapeHtml(s.teacherName)}</span>
          <span class="muted">${s.attendanceCount} marked</span>
        </li>`
      )
      .join('');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async function startScanner() {
    scanIntro.hidden = true;
    resultPanel.hidden = true;
    scannerPanel.hidden = false;
    handling = false;

    html5QrCode = new Html5Qrcode('reader');
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras.length) {
      throw new Error('No camera found on this device');
    }
    const rear = cameras.find((c) => /back|rear|environment/i.test(c.label));
    const cameraId = (rear || cameras[0]).id;

    await html5QrCode.start(
      cameraId,
      { fps: 10, qrbox: { width: 240, height: 240 } },
      onScanSuccess,
      () => {}
    );
  }

  async function stopScanner() {
    if (html5QrCode) {
      try {
        await html5QrCode.stop();
        await html5QrCode.clear();
      } catch {
        /* ignore */
      }
      html5QrCode = null;
    }
    scannerPanel.hidden = true;
  }

  async function onScanSuccess(decodedText) {
    if (handling) return;
    handling = true;
    await stopScanner();

    let payload;
    try {
      payload = JSON.parse(decodedText);
    } catch {
      showResult('err', 'Invalid QR', 'This code is not a PulseMark attendance token.');
      return;
    }

    if (!payload.sessionId || !payload.token) {
      showResult('err', 'Invalid QR', 'Missing session or token in the scanned code.');
      return;
    }

    try {
      const data = await api('/api/attendance/mark', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: payload.sessionId,
          token: payload.token,
        }),
      });
      if (data.alreadyMarked) {
        showResult(
          'warn',
          'Already marked',
          `${data.message} for “${data.sessionTitle}” at ${formatTime(data.markedAt)}.`
        );
      } else {
        showResult(
          'ok',
          'You are present',
          `Attendance recorded for “${data.sessionTitle}”. The server accepted your token for this time window.`
        );
      }
      await loadOpenSessions();
    } catch (err) {
      const msg =
        err.data?.code === 'TOKEN_MISMATCH'
          ? 'The QR rotated. Ask to show the current code and scan again.'
          : err.message;
      showResult('err', 'Not marked', msg);
    }
  }

  function showResult(kind, title, message) {
    resultPanel.hidden = false;
    scanIntro.hidden = true;
    resultCard.className = `result-card ${kind}`;
    document.getElementById('result-eyebrow').textContent =
      kind === 'ok' ? 'Success' : kind === 'warn' ? 'Notice' : 'Failed';
    document.getElementById('result-title').textContent = title;
    document.getElementById('result-message').textContent = message;
  }

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    try {
      await startScanner();
    } catch (err) {
      alert(err.message || 'Could not start camera');
      scanIntro.hidden = false;
      scannerPanel.hidden = true;
    } finally {
      startBtn.disabled = false;
    }
  });

  stopBtn.addEventListener('click', async () => {
    await stopScanner();
    scanIntro.hidden = false;
  });

  againBtn.addEventListener('click', async () => {
    resultPanel.hidden = true;
    try {
      await startScanner();
    } catch (err) {
      alert(err.message || 'Could not start camera');
      scanIntro.hidden = false;
    }
  });

  await loadOpenSessions();
})();
