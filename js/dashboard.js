// ============================================================
// Siachen Mark — Dashboard JavaScript
// ============================================================
'use strict';

const FREE_LIMIT = 10;

let currentSession = null;
let _reportsCache  = null;   // cached from /api/user/reports
let _userCache     = null;   // cached from /api/user/me

// ── API Base Helper ──────────────────────────────────────────
function getApiBase() {
  if (window.location.origin.includes(':3000')) return '';
  if (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')) return 'http://localhost:3000';
  return 'https://siachen-mark.vercel.app';
}

// ── Auth token helper ────────────────────────────────────────
function getToken() {
  return localStorage.getItem('sm_token') || null;
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  currentSession = requireLogin();
  if (!currentSession) return;

  await refreshUserFromBackend();
  renderTopBar();
  setupNavigation();
  setupMobileMenu();
  showPage('overview');
});

// ── Fetch user from backend ──────────────────────────────────
async function refreshUserFromBackend() {
  const token = getToken();
  if (!token) return null;
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/user/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      _userCache = await res.json();
      if (_userCache.name) currentSession.name = _userCache.name;
    }
  } catch (e) {
    console.warn('[SM] Could not reach /api/user/me:', e.message);
  }
  return _userCache;
}

// ── Fetch audit reports from backend ────────────────────────
async function fetchReportsFromBackend(forceRefresh) {
  if (_reportsCache !== null && !forceRefresh) return _reportsCache;
  const token = getToken();
  if (!token) { _reportsCache = []; return []; }
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/user/reports`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      _reportsCache = await res.json();
    } else {
      console.warn('[SM] /api/user/reports returned', res.status);
      _reportsCache = [];
    }
  } catch (e) {
    console.warn('[SM] Could not reach /api/user/reports:', e.message);
    _reportsCache = [];
  }
  return _reportsCache;
}

// ── Top Bar ──────────────────────────────────────────────────
function renderTopBar() {
  const u           = _userCache || currentSession;
  if (!u) return;
  const isUnlimited = ((_userCache && _userCache.plan === 'UNLIMITED') || currentSession.role === 'admin');
  const tierLabel   = currentSession.role === 'admin' ? '👑 Admin'
                    : isUnlimited ? '✨ Unlimited' : '🆓 Free';
  const displayName = u.name || currentSession.name || 'User';

  const nameEl    = document.getElementById('user-name');
  const tierEl    = document.getElementById('user-tier');
  const avatarEl  = document.getElementById('user-avatar');
  const welcomeEl = document.getElementById('welcome-name');

  if (nameEl)    nameEl.textContent    = displayName;
  if (tierEl)    tierEl.textContent    = tierLabel;
  if (avatarEl)  avatarEl.textContent  = displayName[0].toUpperCase();
  if (welcomeEl) welcomeEl.textContent = displayName.split(' ')[0];
}

// ── Navigation ───────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      showPage(page);
      document.getElementById('sidebar').classList.remove('open');
    });
  });
}

async function showPage(pageName) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + pageName);
  const navEl  = document.querySelector(`[data-page="${pageName}"]`);

  if (pageEl) {
    pageEl.classList.remove('hidden');
    pageEl.classList.add('fade-in');
  }
  if (navEl) navEl.classList.add('active');

  const titles = {
    overview: 'Overview',
    audits:   'My Audits',
    reports:  'My Reports',
    payment:  'Upgrade to Unlimited'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[pageName] || 'Dashboard';

  if (pageName === 'overview') await renderOverview();
  if (pageName === 'audits')   await renderAuditsPage();
  if (pageName === 'reports')  await renderReportsPage();
  if (pageName === 'payment')  await renderPaymentPage();
}

// ── Mobile Menu ──────────────────────────────────────────────
function setupMobileMenu() {
  const btn     = document.getElementById('btn-menu');
  const sidebar = document.getElementById('sidebar');
  if (btn && sidebar) {
    btn.addEventListener('click', () => sidebar.classList.toggle('open'));
  }
}

// ── Overview ─────────────────────────────────────────────────
async function renderOverview() {
  await refreshUserFromBackend();
  const reports     = await fetchReportsFromBackend(true);
  const u           = _userCache;
  const isUnlimited = u ? (u.plan === 'UNLIMITED') : (currentSession.role === 'admin');
  const totalScans  = u ? (u.scanCount || 0) : 0;
  const remaining   = u ? (isUnlimited ? 'Unlimited' : (u.remaining !== undefined ? u.remaining : Math.max(0, FREE_LIMIT - totalScans))) : FREE_LIMIT;

  renderTopBar();

  setEl('stat-total-scans',   totalScans);
  setEl('stat-total-reports', reports.length);
  setEl('stat-remaining',     isUnlimited ? '∞' : remaining);
  setEl('tier-icon', currentSession.role === 'admin' ? '👑' : isUnlimited ? '✨' : '🆓');
  setEl('tier-name', currentSession.role === 'admin' ? 'Admin' : isUnlimited ? 'Unlimited' : 'Free');
  setEl('tier-desc', isUnlimited ? '30-day Unlimited plan active' : `${totalScans} / ${FREE_LIMIT} scans used`);

  const usageSection  = document.getElementById('usage-section');
  const upgradeBanner = document.getElementById('upgrade-banner');

  if (!isUnlimited) {
    if (usageSection)  usageSection.classList.remove('hidden');
    if (upgradeBanner) upgradeBanner.classList.remove('hidden');
    const pct = Math.min(100, Math.round((totalScans / FREE_LIMIT) * 100));
    const bar = document.getElementById('usage-bar');
    if (bar) bar.style.width = pct + '%';
    if (bar && pct >= 80) bar.style.background = '#EF4444';
    setEl('usage-label', `${totalScans} / ${FREE_LIMIT} scans used`);
  } else {
    if (usageSection)  usageSection.classList.add('hidden');
    if (upgradeBanner) upgradeBanner.classList.add('hidden');
  }

  renderRecentAudits(reports.slice(0, 5));
  fetchPaymentRequestStatus();
}

function renderRecentAudits(reports) {
  const container = document.getElementById('recent-audits');
  if (!container) return;
  if (reports.length === 0) {
    container.innerHTML = `
      <div class="empty-box">
        <div class="empty-icon">🗺️</div>
        <p>No audits yet. Install the extension and scan Google Maps!</p>
        <a href="https://www.google.com/maps" target="_blank" class="btn-primary-sm">Open Google Maps</a>
      </div>`;
    return;
  }
  container.innerHTML = reports.map(r => buildReportRow(r)).join('');
}

// ── Audits Page ──────────────────────────────────────────────
async function renderAuditsPage() {
  const container = document.getElementById('audits-list');
  if (!container) return;
  container.innerHTML = '<div class="empty-box"><div class="empty-icon">⏳</div><p>Loading audits…</p></div>';
  const reports = await fetchReportsFromBackend(true);
  if (reports.length === 0) {
    container.innerHTML = `
      <div class="empty-box">
        <div class="empty-icon">📋</div>
        <p>No audits found. Start scanning from the Chrome Extension on Google Maps.</p>
      </div>`;
    return;
  }
  container.innerHTML = reports.map(r => buildReportRow(r)).join('');
}

// ── Reports Page ─────────────────────────────────────────────
async function renderReportsPage() {
  const container = document.getElementById('reports-list');
  if (!container) return;
  container.innerHTML = '<div class="empty-box"><div class="empty-icon">⏳</div><p>Loading reports…</p></div>';
  const reports = await fetchReportsFromBackend(true);
  if (reports.length === 0) {
    container.innerHTML = `
      <div class="empty-box">
        <div class="empty-icon">📄</div>
        <p>No reports yet. Audits from your extension will appear here.</p>
      </div>`;
    return;
  }
  container.innerHTML = reports.map((r, idx) => `
    <div class="audit-row">
      <div class="ar-score" style="color:${scoreColor(r.score)};border-color:${scoreColor(r.score)}">
        ${r.score}<span style="font-size:9px;font-weight:400">/100</span>
      </div>
      <div class="ar-info">
        <div class="ar-name">${escHtml(r.businessName)}</div>
        <div class="ar-meta">
          <span>🕐 ${new Date(r.createdAt).toLocaleDateString('en-PK')}</span>
          <span>📍 ${escHtml(r.address || '—')}</span>
          ${r.rating ? '<span>★ ' + r.rating + '</span>' : ''}
          ${r.issuesCount ? '<span style="color:#EF4444">🔴 ' + r.issuesCount + ' issues</span>' : ''}
        </div>
      </div>
      <div class="ar-grade" style="color:${scoreColor(r.score)}">${r.grade || '—'}</div>
      <div class="ar-actions">
        <button class="btn-sm-outline" onclick="downloadReportJSON(${idx})">⬇ JSON</button>
      </div>
    </div>`).join('');
}

// ── Report Row Builder ────────────────────────────────────────
function buildReportRow(r) {
  const sc   = scoreColor(r.score);
  const date = new Date(r.createdAt).toLocaleDateString('en-PK');
  return `
    <div class="audit-row fade-in">
      <div class="ar-score" style="color:${sc};border-color:${sc}">
        ${r.score}<span style="font-size:9px;font-weight:400">/100</span>
      </div>
      <div class="ar-info">
        <div class="ar-name">${escHtml(r.businessName)}</div>
        <div class="ar-meta">
          <span>📅 ${date}</span>
          <span>📍 ${escHtml(r.address || r.query || '—')}</span>
          ${r.rating ? '<span>★ ' + r.rating + '</span>' : ''}
          ${r.issuesCount ? '<span style="color:#EF4444">🔴 ' + r.issuesCount + '</span>' : ''}
        </div>
      </div>
      <div class="ar-grade" style="color:${sc}">${r.grade || '—'}</div>
    </div>`;
}

// ── Payment Request Status Card ───────────────────────────────
async function fetchPaymentRequestStatus() {
  const token   = getToken();
  const card    = document.getElementById('payment-status-card');
  const content = document.getElementById('payment-status-content');
  if (!card || !content) return;
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/user/payment/request`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      const pr   = data.paymentRequest;
      if (!pr) { card.classList.add('hidden'); return; }
      card.classList.remove('hidden');
      if (pr.status === 'PENDING') {
        const dateStr = new Date(pr.createdAt).toLocaleDateString();
        content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;"><div><div style="font-weight:700;color:#F59E0B;font-size:15px;margin-bottom:4px;">⏳ Payment Verification Pending</div><div style="color:#94A3B8;font-size:13px;">Transaction ID: <strong style="color:#F1F5F9;">' + escHtml(pr.transactionId) + '</strong> &nbsp;•&nbsp; Submitted ' + dateStr + ' &nbsp;•&nbsp; PKR ' + pr.amount + '</div><div style="color:#64748B;font-size:12px;margin-top:4px;">Waiting for admin verification. Account stays on Free plan until approved.</div></div><div style="background:#F59E0B20;color:#F59E0B;border:1px solid #F59E0B40;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;">PENDING</div></div>';
      } else if (pr.status === 'REJECTED') {
        const reason = pr.rejectionReason || 'Invalid transaction receipt or unverified payment.';
        content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;"><div><div style="font-weight:700;color:#EF4444;font-size:15px;margin-bottom:4px;">❌ Payment Request Rejected</div><div style="color:#F1F5F9;font-size:13px;margin-bottom:4px;">Reason: <em>' + escHtml(reason) + '</em></div></div><button onclick="showPage(\'payment\')" style="background:#EF4444;color:white;border:none;padding:8px 16px;border-radius:6px;font-weight:700;cursor:pointer;font-size:12px;">Submit New Payment</button></div>';
      } else if (pr.status === 'APPROVED') {
        card.classList.add('hidden');
      }
    }
  } catch (err) {
    console.error('[SM] Error fetching payment request status:', err);
  }
}

// ── Payment Page ──────────────────────────────────────────────
async function renderPaymentPage() {
  const epName = document.getElementById('ep-acc-name');
  const epNum  = document.getElementById('ep-acc-num');
  const epInst = document.getElementById('ep-instructions');
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/payment/settings`);
    if (res.ok) {
      const data = await res.json();
      if (epName) epName.textContent = data.accountName  || 'Basharat Ali';
      if (epNum)  epNum.textContent  = data.accountNumber || '03555380636';
      if (epInst) epInst.textContent = data.instructions || 'Transfer PKR 1,000 via EasyPaisa to Basharat Ali (03555380636). Take a screenshot of the transaction receipt and submit it on the right form along with your Transaction/Reference ID.';
    }
  } catch (err) {
    console.warn('[SM] Could not fetch remote payment settings, using defaults.', err);
  }
  const payDateInput = document.getElementById('pay-date');
  if (payDateInput && !payDateInput.value) {
    payDateInput.value = new Date().toISOString().split('T')[0];
  }
}

async function handlePaymentSubmit(e) {
  e.preventDefault();
  const senderName    = document.getElementById('pay-sender-name').value.trim();
  const transactionId = document.getElementById('pay-trx-id').value.trim();
  const paymentDate   = document.getElementById('pay-date').value;
  const fileInput     = document.getElementById('pay-screenshot');
  const btn           = document.getElementById('btn-submit-payment');
  const API_BASE      = getApiBase();

  if (!fileInput.files || fileInput.files.length === 0) {
    showPaymentMsg('Please select a payment screenshot.', 'error'); return;
  }
  const file = fileInput.files[0];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowedExts.includes(ext)) {
    showPaymentMsg('Invalid file type. Only JPG, JPEG, PNG, and WEBP images are allowed.', 'error'); return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showPaymentMsg('File size exceeds 5MB limit. Please upload a smaller screenshot.', 'error'); return;
  }

  btn.textContent = 'Uploading screenshot...';
  btn.disabled    = true;

  try {
    const token    = getToken();
    const formData = new FormData();
    formData.append('file', file);

    const uploadRes = await fetch(`${API_BASE}/api/user/payment/upload`, {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload screenshot.');

    btn.textContent = 'Submitting request...';

    const reqRes = await fetch(`${API_BASE}/api/user/payment/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ senderName, transactionId, paymentDate, amount: 1000, paymentMethod: 'EASYPAISA', screenshotUrl: uploadData.url })
    });
    const reqData = await reqRes.json();
    if (!reqRes.ok) throw new Error(reqData.error || 'Failed to submit payment request.');

    showPaymentMsg('Payment submitted. Your request is waiting for admin approval.', 'success');
    document.getElementById('form-payment-request').reset();
    fetchPaymentRequestStatus();
  } catch (err) {
    showPaymentMsg(err.message, 'error');
  } finally {
    btn.textContent = 'Submit Payment for Verification';
    btn.disabled    = false;
  }
}

function showPaymentMsg(msg, type) {
  const el = document.getElementById('payment-form-msg');
  if (!el) return;
  el.textContent = (type === 'error' ? '❌ ' : '✅ ') + msg;
  el.className   = 'auth-msg ' + (type === 'success' ? 'msg-success' : 'msg-error');
  el.classList.remove('hidden');
}

// ── Download Report JSON ──────────────────────────────────────
function downloadReportJSON(idx) {
  if (!_reportsCache || !_reportsCache[idx]) return;
  const r    = _reportsCache[idx];
  const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = 'siachen-mark-' + (r.businessName || 'report').replace(/\s+/g, '-') + '-' + Date.now() + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── Helpers ───────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 80) return '#10B981';
  if (score >= 65) return '#F59E0B';
  if (score >= 50) return '#F97316';
  return '#EF4444';
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
