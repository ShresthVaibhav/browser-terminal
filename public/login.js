'use strict';

const params = new URLSearchParams(location.search);
if (params.get('error') === 'invalid') {
  const banner = document.getElementById('error-banner');
  banner.textContent = 'Invalid or expired login link. Please try again.';
  banner.style.display = 'block';
}

const form  = document.getElementById('login-form');
const btn   = document.getElementById('submit-btn');
const msgEl = document.getElementById('msg');

function showMsg(text, type) {
  msgEl.textContent   = text;
  msgEl.className     = `msg ${type}`;
  msgEl.style.display = 'block';
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  btn.disabled    = true;
  btn.textContent = 'Sending…';
  msgEl.style.display = 'none';

  const password = document.getElementById('password').value;

  try {
    const res  = await fetch('/api/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    });
    const data = await res.json();

    if (res.status === 429) {
      showMsg(data.error || 'Too many attempts. Try again in 15 minutes.', 'error');
    } else if (!res.ok) {
      showMsg(data.error || 'Something went wrong.', 'error');
    } else {
      showMsg('If the password was correct, a login link has been sent to your email. Check your inbox (expires in 5 minutes).', 'success');
      form.style.display = 'none';
    }
  } catch {
    showMsg('Network error. Please try again.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Continue';
  }
});
