(async function initLogin() {
  const me = await getMe();
  if (me?.user) {
    window.location.href = me.user.role === 'teacher' ? '/teacher.html' : '/student.html';
    return;
  }

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    btn.disabled = true;
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    try {
      const data = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      window.location.href = data.user.role === 'teacher' ? '/teacher.html' : '/student.html';
    } catch (err) {
      errorEl.textContent = err.message || 'Login failed';
      errorEl.hidden = false;
      btn.disabled = false;
    }
  });
})();
