/**
 * Local → localhost API. Deployed (Vercel) → Render API.
 */
window.API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://automated-attendance-system-backend-dhev.onrender.com';
