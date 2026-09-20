// ============================================================
// Siachen Mark — Dashboard JavaScript (LMS)
// ============================================================
'use strict';

const ADMIN_KEY_PERM = '571571';
const FREE_LIMIT     = 10;

let currentSession = null;
let currentUser    = null;
let paymentDetails = null;

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  currentSession = requireLogin();
  if (!currentSession) return;

  currentUser = getUserById(currentSession.id);
  loadPaymentDetails();

  renderTopBar();
  setupNavigation();
  setupMobileMenu();
  showPage('overview');
  renderOverview();
  renderLicensePage();
  renderPaymentPage();
});

// ── Get User ──────────────────────────────────────────────
function getUserById(id) {
  const users = getUsers();
  return users.find(u => u.id === id) || null;
}

function refreshUser() {
  currentUser = getUserById(currentSession.id);
  return currentUser;
}

function saveCurrentUser() {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === currentSession.id);
  if (idx !== -1) { users[idx] = currentUser; saveUsers(users); }
}

// ── Payment Details from localStorage ─────────────────────
function loadPaymentDetails() {
  paymentDetails = JSON.parse(localStorage.getItem('sm_payment_details') || 'null');
}

// ── Top Bar ───────────────────────────────────────────────
function renderTopBar() {
  const u = currentUser;
  if (!u) return;
  const nameEl = document.getElementById('user-name');
  const tierEl = document.getElementById('user-tier');
  const avatarEl = document.getElementById('user-avatar');
  const welcomeEl = document.getElementById('welcome-name');

  if (nameEl)    nameEl.textContent    = u.name || 'User';
  if (tierEl)    tierEl.textContent    = getTierLabel(u.tier);
  if (avatarEl)  avatarEl.textContent  = (u.name || 'U')[0].toUpperCase();
  if (welcomeEl) welcomeEl.textContent = u.name?.split(' ')[0] || 'User';
}

function getTierLabel(tier) {
  if (tier === 'admin') return '👑 Admin';
  if (tier === 'paid')  return '✨ Pro';
  return '🆓 Free';
}

// ── Navigation ────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      showPage(page);

      // Close sidebar on mobile
      document.getElementById('sidebar').classList.remove('open');
    });
  });
}

function showPage(pageName) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target
  const pageEl = document.getElementById('page-' + pageName);
  const navEl = document.querySelector(`[data-page="${pageName}"]`);

  if (pageEl) {
    pageEl.classList.remove('hidden');
    pageEl.classList.add('fade-in');
  }
  if (navEl) navEl.classList.add('active');

  // Update title
  const titles = { overview: 'Overview', audits: 'My Audits', reports: 'Reports', license: 'License Key', payment: 'Get Pro Key' };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[pageName] || 'Dashboard';

  // Render page content
  if (pageName === 'overview') renderOverview();
  if (pageName === 'audits')   renderAuditsPage();
  if (pageName === 'reports')  renderReportsPage();
  if (pageName === 'license')  renderLicensePage();
  if (pageName === 'payment')  renderPaymentPage();
}

// ── Mobile Menu ───────────────────────────────────────────
function setupMobileMenu() {
  const btn = document.getElementById('btn-menu');
  const sidebar = document.getElementById('sidebar');
  if (btn && sidebar) {
    btn.addEventListener('click', () => sidebar.classList.toggle('open'));
  }
}

// ── API Base Helper ─────────────────────────────────────────
function getApiBase() {
  if (window.location.origin.includes(':3000')) return '';
  if (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')) return 'http://localhost:3000';
  return 'https://siachen-mark.vercel.app';
}

// ── Overview ──────────────────────────────────────────────
async function syncUserWithBackend() {
  const token = localStorage.getItem('sm_token');
  if (!token) return;
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/user/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const dbUser = await res.json();
      if (dbUser && dbUser.id) {
        let updated = false;
        if (dbUser.plan === 'UNLIMITED' && currentUser.tier !== 'paid') {
          currentUser.tier = 'paid';
          currentUser.plan = 'UNLIMITED';
          currentUser.subscriptionStatus = dbUser.subscriptionStatus;
          currentUser.subscriptionEnd = dbUser.subscriptionEnd;
          updated = true;
        } else if (dbUser.plan === 'FREE' && currentUser.tier === 'paid' && dbUser.subscriptionStatus === 'EXPIRED') {
          currentUser.tier = 'free';
          currentUser.plan = 'FREE';
          currentUser.subscriptionStatus = 'EXPIRED';
          updated = true;
        }
        if (updated) {
          saveCurrentUser();
          renderTopBar();
        }
      }
    }
  } catch (e) {
    console.warn('Backend sync warning:', e);
  }
}

function renderOverview() {
  const u = refreshUser();
  if (!u) return;

  syncUserWithBackend();

  const history    = getAuditHistory();
  const totalScans = u.auditCount || history.length;
  const isUnlimited = u.tier === 'paid' || u.plan === 'UNLIMITED' || u.tier === 'admin';
  const remaining  = isUnlimited ? '∞' : Math.max(0, FREE_LIMIT - totalScans);

  // Stats
  setEl('stat-total-scans',   totalScans);
  setEl('stat-total-reports', history.length);
  setEl('stat-remaining',     remaining);
  setEl('tier-icon', u.tier === 'admin' ? '👑' : isUnlimited ? '✨' : '🆓');
  setEl('tier-name', u.tier === 'admin' ? 'Admin' : isUnlimited ? 'Unlimited' : 'Free');
  setEl('tier-desc', isUnlimited ? '30-day Unlimited plan active' : '10 scans total included');

  // Usage bar (only for free)
  const usageSection = document.getElementById('usage-section');
  const upgradeBanner = document.getElementById('upgrade-banner');

  if (!isUnlimited) {
    if (usageSection) usageSection.classList.remove('hidden');
    if (upgradeBanner) upgradeBanner.classList.remove('hidden');
    const pct = Math.min(100, Math.round((totalScans / FREE_LIMIT) * 100));
    const bar = document.getElementById('usage-bar');
    if (bar) bar.style.width = pct + '%';
    if (bar && pct >= 80) bar.style.background = '#EF4444';
    setEl('usage-label', `${totalScans} / ${FREE_LIMIT} scans used`);
  } else {
    if (usageSection) usageSection.classList.add('hidden');
    if (upgradeBanner) upgradeBanner.classList.add('hidden');
  }

  // Recent audits (last 5)
  renderRecentAudits(history.slice(0, 5));

  // Fetch live payment request status for overview page
  fetchPaymentRequestStatus();
}

function renderRecentAudits(history) {
  const container = document.getElementById('recent-audits');
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-box">
        <div class="empty-icon">🗺️</div>
        <p>No audits yet. Install the extension and scan Google Maps!</p>
        <a href="https://www.google.com/maps" target="_blank" class="btn-primary-sm">Open Google Maps</a>
      </div>`;
    return;
  }

  container.innerHTML = history.map(a => buildAuditRow(a)).join('');
}

// ── Audits Page ───────────────────────────────────────────
function renderAuditsPage() {
  const history = getAuditHistory();
  const container = document.getElementById('audits-list');
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-box">
        <div class="empty-icon">📋</div>
        <p>No audits found. Start scanning from the Chrome Extension on Google Maps.</p>
      </div>`;
    return;
  }

  container.innerHTML = history.map(a => buildAuditRow(a)).join('');
}

// ── Reports Page ──────────────────────────────────────────
function renderReportsPage() {
  const history = getAuditHistory();
  const container = document.getElementById('reports-list');
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-box">
        <div class="empty-icon">📄</div>
        <p>No reports yet. Audits from your extension will appear here.</p>
      </div>`;
    return;
  }

  container.innerHTML = history.map((a, idx) => `
    <div class="audit-row">
      <div class="ar-score" style="color:${scoreColor(a.totalScore)};border-color:${scoreColor(a.totalScore)}">
        ${a.totalScore}
      </div>
      <div class="ar-info">
        <div class="ar-name">${a.businessName}</div>
        <div class="ar-meta">
          <span>🕐 ${new Date(a.auditDate || a.savedAt).toLocaleDateString()}</span>
          <span>📍 ${a.businessData?.primaryCategory || 'N/A'}</span>
          <span>★ ${a.businessData?.rating || '?'}</span>
        </div>
      </div>
      <div class="ar-grade" style="color:${a.grade?.color || '#fff'}">${a.grade?.letter || '?'}</div>
      <div class="ar-actions">
        <button class="btn-sm-outline" onclick="downloadJSON(${idx})">⬇ JSON</button>
      </div>
    </div>`).join('');
}

// ── Audit Row Builder ─────────────────────────────────────
function buildAuditRow(a) {
  const sc = scoreColor(a.totalScore);
  const date = new Date(a.auditDate || a.savedAt).toLocaleDateString('en-PK');
  return `
    <div class="audit-row fade-in">
      <div class="ar-score" style="color:${sc};border-color:${sc}">
        ${a.totalScore}<span style="font-size:9px;font-weight:400">/100</span>
      </div>
      <div class="ar-info">
        <div class="ar-name">${a.businessName}</div>
        <div class="ar-meta">
          <span>📅 ${date}</span>
          <span>📍 ${a.businessData?.address || a.businessData?.primaryCategory || '—'}</span>
          <span style="color:#EF4444">🔴 ${a.issues?.length || 0}</span>
          <span style="color:#F59E0B">⚠ ${a.warnings?.length || 0}</span>
          <span style="color:#10B981">✅ ${a.passed?.length || 0}</span>
        </div>
      </div>
      <div class="ar-grade" style="color:${a.grade?.color || '#6B7280'}">${a.grade?.letter || '?'}</div>
    </div>`;
}

// ── License Page ──────────────────────────────────────────
function renderLicensePage() {
  const u = refreshUser();
  if (!u) return;

  const iconEl = document.getElementById('lb-tier-icon');
  const nameEl = document.getElementById('lb-tier-name');
  const descEl = document.getElementById('lb-tier-desc');
  const curKey = document.getElementById('current-key');
  const expiry = document.getElementById('key-expiry');
  const keyTier = document.getElementById('key-tier');
  const keyDays = document.getElementById('key-days');

  if (u.tier === 'admin') {
    if (iconEl) iconEl.textContent = '👑';
    if (nameEl) nameEl.textContent = 'Admin Access';
    if (descEl) descEl.textContent = 'Unlimited scraping — never expires';
    if (curKey) curKey.textContent = ADMIN_KEY_PERM;
    if (expiry) expiry.textContent = 'Never';
    if (keyTier) keyTier.textContent = 'Admin';
    if (keyDays) keyDays.textContent = '∞';
  } else if (u.tier === 'paid' && u.licenseKey) {
    const daysLeft = u.keyExpiry ? Math.max(0, Math.ceil((u.keyExpiry - Date.now()) / 86400000)) : '?';
    if (iconEl) iconEl.textContent = '✨';
    if (nameEl) nameEl.textContent = 'Pro Access';
    if (descEl) descEl.textContent = `${daysLeft} days remaining`;
    if (curKey) curKey.textContent = u.licenseKey;
    if (expiry) expiry.textContent = u.keyExpiry ? new Date(u.keyExpiry).toLocaleDateString() : '—';
    if (keyTier) keyTier.textContent = 'Pro';
    if (keyDays) keyDays.textContent = daysLeft;
  } else {
    if (iconEl) iconEl.textContent = '🆓';
    if (nameEl) nameEl.textContent = 'Free Tier';
    if (descEl) descEl.textContent = '10 scans total included';
    if (curKey) curKey.textContent = '—';
    if (expiry) expiry.textContent = '—';
    if (keyTier) keyTier.textContent = 'Free';
    if (keyDays) keyDays.textContent = '—';
  }

  // Key activation button
  const btnActivate = document.getElementById('btn-activate-key');
  if (btnActivate && !btnActivate._bound) {
    btnActivate._bound = true;
    btnActivate.addEventListener('click', activateLicenseKey);
  }
}

function activateLicenseKey() {
  const input = document.getElementById('key-input');
  const msgEl = document.getElementById('key-msg');
  const key = input?.value?.trim();
  if (!key) return;

  const btn = document.getElementById('btn-activate-key');
  btn.textContent = 'Activating...';
  btn.disabled = true;

  setTimeout(() => {
    const u = refreshUser();

    // Admin key — permanent
    if (key === ADMIN_KEY_PERM) {
      u.tier = 'admin';
      u.licenseKey = key;
      u.keyExpiry = null;
      saveCurrentUser();
      showKeyMsg('✅ Admin key activated! Unlimited access enabled.', 'success');
      renderLicensePage();
      renderOverview();
    } else if (/^SM-[A-Z0-9]{5}-[A-Z0-9]{5}$/i.test(key)) {
      // Valid user key — 30 days
      u.tier = 'paid';
      u.licenseKey = key;
      u.keyExpiry = Date.now() + (30 * 24 * 60 * 60 * 1000);
      saveCurrentUser();
      const expDate = new Date(u.keyExpiry).toLocaleDateString();
      showKeyMsg(`✅ Pro key activated! Valid until ${expDate}.`, 'success');
      renderLicensePage();
      renderOverview();
    } else {
      showKeyMsg('❌ Invalid key format. Use: SM-XXXXX-XXXXX or admin key.', 'error');
    }

    btn.textContent = 'Activate';
    btn.disabled = false;
  }, 600);
}

function showKeyMsg(msg, type) {
  const el = document.getElementById('key-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = `key-msg ${type === 'success' ? 'key-success' : 'key-error'}`;
  el.classList.remove('hidden');
  if (type === 'success') setTimeout(() => el.classList.add('hidden'), 4000);
}

async function fetchPaymentRequestStatus() {
  const token = localStorage.getItem('sm_token');
  const card = document.getElementById('payment-status-card');
  const content = document.getElementById('payment-status-content');
  if (!card || !content) return;

  const API_BASE = getApiBase();

  try {
    const res = await fetch(`${API_BASE}/api/user/payment/request`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      const pr = data.paymentRequest;

      if (!pr) {
        card.classList.add('hidden');
        return;
      }

      card.classList.remove('hidden');

      if (pr.status === 'PENDING') {
        const dateStr = new Date(pr.createdAt).toLocaleDateString();
        content.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="font-weight:700; color:#F59E0B; font-size:15px; margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                <span>⏳</span> Payment Verification Pending
              </div>
              <div style="color:#94A3B8; font-size:13px;">
                Transaction ID: <strong style="color:#F1F5F9;">${pr.transactionId}</strong> &nbsp;•&nbsp; Submitted on ${dateStr} &nbsp;•&nbsp; Amount: PKR ${pr.amount}
              </div>
              <div style="color:#64748B; font-size:12px; margin-top:4px;">
                Your request is waiting for admin verification. Your account remains on the Free plan until approved.
              </div>
            </div>
            <div style="background:#F59E0B20; color:#F59E0B; border:1px solid #F59E0B40; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:700;">
              PENDING
            </div>
          </div>`;
      } else if (pr.status === 'REJECTED') {
        const reason = pr.rejectionReason || 'Invalid transaction receipt or unverified payment.';
        content.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="font-weight:700; color:#EF4444; font-size:15px; margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                <span>❌</span> Payment Request Rejected
              </div>
              <div style="color:#F1F5F9; font-size:13px; margin-bottom:4px;">
                Reason: <em>${reason}</em>
              </div>
              <div style="color:#94A3B8; font-size:12px;">
                Please verify your EasyPaisa payment receipt and submit a new payment request.
              </div>
            </div>
            <button onclick="showPage('payment')" style="background:#EF4444; color:white; border:none; padding:8px 16px; border-radius:6px; font-weight:700; cursor:pointer; font-size:12px;">
              Submit New Payment
            </button>
          </div>`;
      } else if (pr.status === 'APPROVED') {
        card.classList.add('hidden');
      }
    }
  } catch (err) {
    console.error('Error fetching payment request status:', err);
  }
}

// ── Payment Page ──────────────────────────────────────────
async function renderPaymentPage() {
  const epName = document.getElementById('ep-acc-name');
  const epNum  = document.getElementById('ep-acc-num');
  const epInst = document.getElementById('ep-instructions');

  const API_BASE = getApiBase();

  try {
    const res = await fetch(`${API_BASE}/api/payment/settings`);
    if (res.ok) {
      const data = await res.json();
      if (epName) epName.textContent = data.accountName || 'Basharat Ali';
      if (epNum)  epNum.textContent  = data.accountNumber || '03555380636';
      if (epInst) epInst.textContent = data.instructions || 'Transfer PKR 1,000 via EasyPaisa to Basharat Ali (03555380636). Take a screenshot of the transaction receipt and submit it on the right form along with your Transaction/Reference ID.';
    }
  } catch (err) {
    console.warn('Could not fetch remote payment settings, using defaults.', err);
  }

  // Pre-fill date to today
  const payDateInput = document.getElementById('pay-date');
  if (payDateInput && !payDateInput.value) {
    payDateInput.value = new Date().toISOString().split('T')[0];
  }
}

async function handlePaymentSubmit(e) {
  e.preventDefault();
  const senderName = document.getElementById('pay-sender-name').value.trim();
  const transactionId = document.getElementById('pay-trx-id').value.trim();
  const paymentDate = document.getElementById('pay-date').value;
  const fileInput = document.getElementById('pay-screenshot');
  const btn = document.getElementById('btn-submit-payment');

  const API_BASE = getApiBase();

  if (!fileInput.files || fileInput.files.length === 0) {
    showPaymentMsg('❌ Please select a payment screenshot.', 'error');
    return;
  }

  const file = fileInput.files[0];

  // 1. Client-side file type check
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowedExts.includes(ext)) {
    showPaymentMsg('❌ Invalid file type. Only JPG, JPEG, PNG, and WEBP images are allowed.', 'error');
    return;
  }

  // 2. Client-side file size check (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    showPaymentMsg('❌ File size exceeds 5MB limit. Please upload a smaller screenshot.', 'error');
    return;
  }

  btn.textContent = 'Uploading screenshot...';
  btn.disabled = true;

  try {
    const token = localStorage.getItem('sm_token');

    // Upload screenshot
    const formData = new FormData();
    formData.append('file', file);

    const uploadRes = await fetch(`${API_BASE}/api/user/payment/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(uploadData.error || 'Failed to upload screenshot.');
    }

    btn.textContent = 'Submitting request...';

    // Submit payment request
    const reqRes = await fetch(`${API_BASE}/api/user/payment/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        senderName,
        transactionId,
        paymentDate,
        amount: 1000,
        paymentMethod: 'EASYPAISA',
        screenshotUrl: uploadData.url,
      }),
    });

    const reqData = await reqRes.json();
    if (!reqRes.ok) {
      throw new Error(reqData.error || 'Failed to submit payment request.');
    }

    showPaymentMsg('✅ Payment submitted. Your request is waiting for admin approval.', 'success');
    document.getElementById('form-payment-request').reset();

    // Refresh status card on overview page
    fetchPaymentRequestStatus();

  } catch (err) {
    showPaymentMsg(`❌ ${err.message}`, 'error');
  } finally {
    btn.textContent = 'Submit Payment for Verification';
    btn.disabled = false;
  }
}

function showPaymentMsg(msg, type) {
  const el = document.getElementById('payment-form-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = `auth-msg ${type === 'success' ? 'msg-success' : 'msg-error'}`;
  el.classList.remove('hidden');
}

// ── Toggle Payment Method ─────────────────────────────────
function togglePM(method) {
  const detailsEl = document.getElementById('details-' + method);
  const arrowEl   = document.getElementById('arrow-' + method);
  if (!detailsEl) return;

  const isOpen = !detailsEl.classList.contains('hidden');
  detailsEl.classList.toggle('hidden', isOpen);
  if (arrowEl) arrowEl.classList.toggle('open', !isOpen);
}

// ── Audit History (from localStorage) ────────────────────
function getAuditHistory() {
  return JSON.parse(localStorage.getItem('sm_audit_history') || '[]');
}

// ── Download Report ───────────────────────────────────────
function downloadJSON(idx) {
  const history = getAuditHistory();
  const a = history[idx];
  if (!a) return;

  const blob = new Blob([JSON.stringify(a, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `siachen-mark-${(a.businessName || 'audit').replace(/\s+/g, '-')}-${Date.now()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── Helpers ───────────────────────────────────────────────
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
