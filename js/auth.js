// ============================================================
// Siachen Mark — Auth & Data Layer (LocalStorage based)
// ============================================================
'use strict';

const ADMIN_EMAIL    = 'khapluali19@gmail.com';
const ADMIN_PASSWORD = 'khaplu123';
const ADMIN_KEY_PERM = '571571';

// ── Storage Helpers ──────────────────────────────────────
function getUsers()    { return JSON.parse(localStorage.getItem('sm_users') || '[]'); }
function saveUsers(u)  { localStorage.setItem('sm_users', JSON.stringify(u)); }
function getSession()  { return JSON.parse(localStorage.getItem('sm_session') || 'null'); }
function saveSession(s){ localStorage.setItem('sm_session', JSON.stringify(s)); }
function clearSession(){ localStorage.removeItem('sm_session'); }

// ── Init Admin if Not Exists ─────────────────────────────
(function initAdmin() {
  let users = getUsers();
  const adminExists = users.find(u => u.email === ADMIN_EMAIL);
  if (!adminExists) {
    users.push({
      id: 'admin_001',
      name: 'Admin',
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
      tier: 'admin',
      licenseKey: ADMIN_KEY_PERM,
      keyExpiry: null,
      auditCount: 0,
      joinedAt: new Date().toISOString(),
      payments: []
    });
    saveUsers(users);
  }
})();

// ── Switch Tab ───────────────────────────────────────────
function switchTab(tab) {
  const loginForm    = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');
  const tabLogin     = document.getElementById('tab-login');
  const tabRegister  = document.getElementById('tab-register');
  const switchLink   = document.getElementById('switch-link');
  const msgEl        = document.getElementById('auth-msg');

  if (!loginForm) return;

  msgEl.classList.add('hidden');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    switchLink.innerHTML = 'Don\'t have an account? <a href="#" onclick="switchTab(\'register\');return false;">Register Free</a>';
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
    switchLink.innerHTML = 'Already have an account? <a href="#" onclick="switchTab(\'login\');return false;">Login</a>';
  }
}

// ── Check URL for mode ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const url = new URL(window.location.href);
  if (url.searchParams.get('mode') === 'register') {
    switchTab('register');
  }

  // Check if already logged in
  const session = getSession();
  if (session && window.location.pathname.includes('login')) {
    if (session.role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'dashboard.html';
    }
  }
});

// ── Handle Login ─────────────────────────────────────────
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass  = document.getElementById('login-pass').value;
  const msgEl = document.getElementById('auth-msg');
  const btn   = document.getElementById('btn-login');

  btn.textContent = 'Logging in...';
  btn.disabled = true;

  setTimeout(() => {
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email && u.password === pass);

    if (user) {
      saveSession({ id: user.id, name: user.name, email: user.email, role: user.role, tier: user.tier });
      showMsg('✅ Login successful! Redirecting...', 'success');
      setTimeout(() => {
        if (user.role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      }, 800);
    } else {
      showMsg('❌ Invalid email or password. Please try again.', 'error');
      btn.textContent = 'Login to Dashboard';
      btn.disabled = false;
    }
  }, 600);
}

// ── Handle Register ──────────────────────────────────────
function handleRegister(e) {
  e.preventDefault();
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const pass  = document.getElementById('reg-pass').value;
  const phone = document.getElementById('reg-phone')?.value?.trim() || '';
  const btn   = document.getElementById('btn-register');

  if (pass.length < 6) { showMsg('❌ Password must be at least 6 characters.', 'error'); return; }

  btn.textContent = 'Creating account...';
  btn.disabled = true;

  setTimeout(() => {
    const users = getUsers();
    const exists = users.find(u => u.email.toLowerCase() === email);

    if (exists) {
      showMsg('❌ An account with this email already exists. Please login.', 'error');
      btn.textContent = 'Create Free Account';
      btn.disabled = false;
      return;
    }

    const newUser = {
      id: 'user_' + Date.now(),
      name,
      email,
      password: pass,
      phone,
      role: 'user',
      tier: 'free',
      licenseKey: null,
      keyExpiry: null,
      auditCount: 0,
      joinedAt: new Date().toISOString(),
      payments: []
    };

    users.push(newUser);
    saveUsers(users);
    saveSession({ id: newUser.id, name, email, role: 'user', tier: 'free' });
    showMsg('✅ Account created! Welcome to Siachen Mark!', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
  }, 600);
}

// ── Logout ───────────────────────────────────────────────
function logout() {
  clearSession();
  window.location.href = 'login.html';
}

// ── Show Message ─────────────────────────────────────────
function showMsg(msg, type) {
  const el = document.getElementById('auth-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = `auth-msg ${type === 'success' ? 'msg-success' : 'msg-error'}`;
  el.classList.remove('hidden');
}

// ── Guard: Require Login ─────────────────────────────────
function requireLogin() {
  const session = getSession();
  if (!session) { window.location.href = 'login.html'; return null; }
  return session;
}

// ── Guard: Require Admin ─────────────────────────────────
function requireAdmin() {
  const session = getSession();
  if (!session || session.role !== 'admin') { window.location.href = 'login.html'; return null; }
  return session;
}
