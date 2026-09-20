// ============================================================
// Siachen Mark — Admin Panel JavaScript
// Admin Email: khapluali19@gmail.com | Password: khaplu123
// ============================================================
'use strict';

let allKeys = [];

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const session = requireAdmin();
  if (!session) return;

  // Mobile menu
  const btn = document.getElementById('btn-menu');
  const sidebar = document.getElementById('sidebar');
  if (btn && sidebar) btn.addEventListener('click', () => sidebar.classList.toggle('open'));

  // Load data
  allKeys = JSON.parse(localStorage.getItem('sm_issued_keys') || '[]');
  loadPaymentFieldValues();

  // Load pending payment requests badge count
  updatePendingBadge();

  // Render default tab
  renderOverviewTab();
});

// ── Tab Switching ─────────────────────────────────────────
function switchAdminTab(tab) {
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));

  const pageEl = document.getElementById('tab-' + tab);
  const tabBtns = document.querySelectorAll('.admin-tab');
  const tabMap = { overview: 0, requests: 1, users: 2, keygen: 3, payments: 4 };

  if (pageEl) pageEl.classList.add('active');
  if (tabBtns[tabMap[tab]]) tabBtns[tabMap[tab]].classList.add('active');

  hideAlert();

  if (tab === 'overview') renderOverviewTab();
  if (tab === 'requests') renderPaymentRequestsTable();
  if (tab === 'users')    renderUsersTable();
  if (tab === 'keygen') {
    populateUserDropdown();
    renderKeysTable();
  }
}

// ── Overview Tab ──────────────────────────────────────────
function renderOverviewTab() {
  const users = getUsers().filter(u => u.role !== 'admin');
  const proUsers  = users.filter(u => u.tier === 'paid').length;
  const freeUsers = users.filter(u => u.tier === 'free').length;

  setEl('asc-total-users', users.length);
  setEl('asc-pro-users',   proUsers);
  setEl('asc-free-users',  freeUsers);
  setEl('asc-keys-issued', allKeys.length);

  // Recent users (last 5)
  const recent = [...users].sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt)).slice(0, 5);
  const container = document.getElementById('recent-users-list');
  if (!container) return;

  if (recent.length === 0) {
    container.innerHTML = `<div class="empty-box"><div class="empty-icon">👥</div><p>No users registered yet.</p></div>`;
    return;
  }

  const rowsHTML = recent.map(u => `
    <div class="audit-row" style="grid-template-columns:2fr 1fr 1fr;cursor:default">
      <div class="ar-info">
        <div class="ar-name">${u.name}</div>
        <div class="ar-meta"><span>📧 ${u.email}</span>${u.phone ? `<span>📞 ${u.phone}</span>` : ''}</div>
      </div>
      <span class="tier-badge-sm ${u.tier === 'paid' ? 'tb-paid' : 'tb-free'}">${u.tier === 'paid' ? '✨ Pro' : '🆓 Free'}</span>
      <span style="font-size:12px;color:var(--muted)">${new Date(u.joinedAt).toLocaleDateString()}</span>
    </div>`).join('');

  container.innerHTML = `<div class="users-table"><div id="recent-rows">${rowsHTML}</div></div>`;
}

// ── Users Table ───────────────────────────────────────────
function renderUsersTable() {
  const searchVal = (document.getElementById('user-search')?.value || '').toLowerCase();
  const users = getUsers()
    .filter(u => u.role !== 'admin')
    .filter(u => !searchVal || u.name.toLowerCase().includes(searchVal) || u.email.toLowerCase().includes(searchVal));

  const container = document.getElementById('users-tbody');
  if (!container) return;

  if (users.length === 0) {
    container.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted)">No users found.</div>`;
    return;
  }

  container.innerHTML = users.map(u => {
    const daysLeft = u.tier === 'paid' && u.keyExpiry
      ? Math.max(0, Math.ceil((u.keyExpiry - Date.now()) / 86400000))
      : null;

    const expiryStr = u.tier === 'paid' && u.keyExpiry
      ? new Date(u.keyExpiry).toLocaleDateString()
      : '—';

    const tierClass = u.tier === 'paid' ? 'tb-paid' : u.tier === 'admin' ? 'tb-admin' : 'tb-free';
    const tierLabel = u.tier === 'paid' ? `✨ Pro (${daysLeft}d)` : u.tier === 'admin' ? '👑 Admin' : '🆓 Free';

    return `
      <div class="table-row">
        <div>
          <div style="font-weight:600;color:var(--text)">${u.name}</div>
          <div style="font-size:11px;color:var(--muted)">${u.email}</div>
        </div>
        <span class="tier-badge-sm ${tierClass}">${tierLabel}</span>
        <span>${u.auditCount || 0}</span>
        <span style="font-size:11px;color:var(--muted);font-family:monospace">${u.licenseKey || '—'}</span>
        <span style="font-size:12px">${expiryStr}</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-give-key" onclick="assignKeyToUser('${u.id}')">🔑 Give Key</button>
          <button class="btn-give-key" onclick="removeUserKey('${u.id}')" style="color:var(--error)">✕ Revoke</button>
        </div>
      </div>`;
  }).join('');
}

// ── Assign Key to User ────────────────────────────────────
function assignKeyToUser(userId) {
  const validity = parseInt(prompt('Key validity in days (default 30):', '30')) || 30;
  const key = generateKeyString();
  const expiry = Date.now() + (validity * 24 * 60 * 60 * 1000);

  const users = getUsers();
  const userIdx = users.findIndex(u => u.id === userId);
  if (userIdx === -1) { showAlert('User not found.', 'error'); return; }

  users[userIdx].tier       = 'paid';
  users[userIdx].licenseKey = key;
  users[userIdx].keyExpiry  = expiry;
  saveUsers(users);

  // Record key
  allKeys.push({
    key,
    assignedTo: users[userIdx].email,
    userId,
    validity,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(expiry).toISOString()
  });
  saveKeys();

  showAlert(`✅ Key ${key} assigned to ${users[userIdx].email} (${validity} days)`, 'success');
  renderUsersTable();
}

// ── Remove User Key ───────────────────────────────────────
function removeUserKey(userId) {
  if (!confirm('Are you sure you want to revoke this user\'s Pro access?')) return;

  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return;

  users[idx].tier       = 'free';
  users[idx].licenseKey = null;
  users[idx].keyExpiry  = null;
  saveUsers(users);

  showAlert(`✅ Pro access revoked for ${users[idx].email}`, 'success');
  renderUsersTable();
}

// ── Key Generator ─────────────────────────────────────────
function generateKeyString() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `SM-${seg(5)}-${seg(5)}`;
}

function generateKey() {
  const assignTo  = document.getElementById('assign-user')?.value || '';
  const validity  = parseInt(document.getElementById('key-validity')?.value || '30');
  const key       = generateKeyString();
  const expiry    = Date.now() + (validity * 24 * 60 * 60 * 1000);
  const expiryStr = new Date(expiry).toLocaleDateString();

  // Show generated key
  setEl('gk-key-val', key);
  setEl('gk-key-meta', `Valid for ${validity} days — Expires: ${expiryStr}`);
  document.getElementById('generated-key-display').classList.remove('hidden');

  // If assigned to a user, update them
  let assignedEmail = 'Not assigned';
  if (assignTo) {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === assignTo);
    if (idx !== -1) {
      users[idx].tier       = 'paid';
      users[idx].licenseKey = key;
      users[idx].keyExpiry  = expiry;
      saveUsers(users);
      assignedEmail = users[idx].email;
      showAlert(`✅ Key generated and assigned to ${assignedEmail}`, 'success');
    }
  }

  // Record key in history
  allKeys.push({
    key,
    assignedTo: assignedEmail,
    userId: assignTo || null,
    validity,
    issuedAt: new Date().toISOString(),
    expiresAt: expiryStr
  });
  saveKeys();
  renderKeysTable();
}

function copyKey() {
  const key = document.getElementById('gk-key-val')?.textContent || '';
  if (!key || key === '—') return;
  navigator.clipboard.writeText(key).then(() => {
    showAlert('✅ Key copied to clipboard: ' + key, 'success');
  }).catch(() => {
    prompt('Copy this key:', key);
  });
}

function populateUserDropdown() {
  const select = document.getElementById('assign-user');
  if (!select) return;
  const users = getUsers().filter(u => u.role !== 'admin');
  select.innerHTML = '<option value="">— No assignment —</option>' +
    users.map(u => `<option value="${u.id}">${u.name} (${u.email})</option>`).join('');
}

function renderKeysTable() {
  const container = document.getElementById('keys-tbody');
  if (!container) return;

  if (allKeys.length === 0) {
    container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--muted)">No keys issued yet.</div>`;
    return;
  }

  container.innerHTML = [...allKeys].reverse().map(k => {
    const isExpired = k.expiresAt && new Date(k.expiresAt) < new Date();
    const statusColor = isExpired ? '#EF4444' : '#10B981';
    const statusLabel = isExpired ? '❌ Expired' : '✅ Active';

    return `
      <div class="table-row" style="grid-template-columns:2fr 1fr 1fr 1fr 1fr">
        <span style="font-family:monospace;font-size:13px;font-weight:700;color:var(--accent2)">${k.key}</span>
        <span style="font-size:12px;color:var(--muted)">${k.assignedTo}</span>
        <span>${k.validity} days</span>
        <span style="font-size:12px">${new Date(k.issuedAt).toLocaleDateString()}</span>
        <span style="font-weight:600;color:${statusColor}">${statusLabel}</span>
      </div>`;
  }).join('');
}

function saveKeys() {
  localStorage.setItem('sm_issued_keys', JSON.stringify(allKeys));
}

// ── Payment Settings ──────────────────────────────────────
function loadPaymentFieldValues() {
  const pd = JSON.parse(localStorage.getItem('sm_payment_details') || '{}');

  if (pd.bank) {
    setInputVal('ps-bank-name',  pd.bank.name  || '');
    setInputVal('ps-bank-title', pd.bank.title || '');
    setInputVal('ps-bank-acc',   pd.bank.account || '');
    setInputVal('ps-bank-iban',  pd.bank.iban  || '');
  }
  if (pd.easypaisa) {
    setInputVal('ps-ep-name',   pd.easypaisa.name   || '');
    setInputVal('ps-ep-number', pd.easypaisa.number || '');
  }
  if (pd.ach) {
    setInputVal('ps-ach-name',    pd.ach.name    || '');
    setInputVal('ps-ach-routing', pd.ach.routing || '');
    setInputVal('ps-ach-acc',     pd.ach.account || '');
    setInputVal('ps-ach-bank',    pd.ach.bank    || '');
  }
}

function savePaymentSettings(type) {
  const pd = JSON.parse(localStorage.getItem('sm_payment_details') || '{}');

  if (type === 'bank') {
    pd.bank = {
      name:    document.getElementById('ps-bank-name')?.value  || '',
      title:   document.getElementById('ps-bank-title')?.value || '',
      account: document.getElementById('ps-bank-acc')?.value   || '',
      iban:    document.getElementById('ps-bank-iban')?.value  || ''
    };
    showAlert('✅ Bank Transfer details saved successfully!', 'success');
  }
  else if (type === 'easypaisa') {
    pd.easypaisa = {
      name:   document.getElementById('ps-ep-name')?.value   || '',
      number: document.getElementById('ps-ep-number')?.value || ''
    };
    showAlert('✅ EasyPaisa details saved successfully!', 'success');
  }
  else if (type === 'ach') {
    pd.ach = {
      name:    document.getElementById('ps-ach-name')?.value    || '',
      routing: document.getElementById('ps-ach-routing')?.value || '',
      account: document.getElementById('ps-ach-acc')?.value     || '',
      bank:    document.getElementById('ps-ach-bank')?.value    || ''
    };
    showAlert('✅ International/ACH details saved successfully!', 'success');
  }

  localStorage.setItem('sm_payment_details', JSON.stringify(pd));
}

// ── Helpers ───────────────────────────────────────────────
function showAlert(msg, type) {
  const el = document.getElementById('admin-alert');
  if (!el) return;
  el.textContent = msg;
  el.className = `admin-alert ${type === 'success' ? 'alert-success' : 'alert-error'}`;
  el.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function hideAlert() {
  const el = document.getElementById('admin-alert');
  if (el) el.classList.add('hidden');
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setInputVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

// ── Payment Requests Management ───────────────────────────
async function getAdminToken() {
  let token = localStorage.getItem('sm_token');
  const API_BASE = window.location.origin.includes(':3000') ? '' : 'http://localhost:3000';
  if (!token) {
    try {
      const res = await fetch(`${API_BASE}/api/extension/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'khapluali19@gmail.com', password: 'khaplu123' })
      });
      if (res.ok) {
        const data = await res.json();
        token = data.token;
        localStorage.setItem('sm_token', token);
      }
    } catch (e) {
      console.error('Failed to authenticate admin with backend API:', e);
    }
  }
  return token;
}

async function renderPaymentRequestsTable() {
  const container = document.getElementById('requests-tbody');
  if (!container) return;

  const statusFilter = document.getElementById('request-status-filter')?.value || 'PENDING';
  const API_BASE = window.location.origin.includes(':3000') ? '' : 'http://localhost:3000';
  const token = await getAdminToken();

  container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--muted)">Loading payment requests...</div>`;

  try {
    const url = statusFilter === 'ALL'
      ? `${API_BASE}/api/admin/payments`
      : `${API_BASE}/api/admin/payments?status=${statusFilter}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to load payment requests');
    }

    const requests = await res.json();
    updatePendingBadge(requests);

    if (requests.length === 0) {
      container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--muted)">No payment requests found.</div>`;
      return;
    }

    container.innerHTML = requests.map(r => {
      const isPending = r.status === 'PENDING';
      const statusColor = r.status === 'APPROVED' ? '#10B981' : r.status === 'REJECTED' ? '#EF4444' : '#F59E0B';
      const screenshotThumb = r.screenshotUrl
        ? `<button onclick="openScreenshotModal('${r.screenshotUrl}', '${(r.senderName || '').replace(/'/g, "\\'")}')" class="btn-give-key" style="color:var(--accent2)">🖼 View Receipt</button>`
        : '<span style="color:var(--muted);font-size:11px">No screenshot</span>';

      const actions = isPending ? `
        <div style="display:flex;gap:6px;">
          <button onclick="approvePaymentRequest('${r.id}')" class="btn-give-key" style="background:#10B98120;color:#10B981;border-color:#10B98140">✓ Approve</button>
          <button onclick="rejectPaymentRequest('${r.id}')" class="btn-give-key" style="background:#EF444420;color:#EF4444;border-color:#EF444440">✕ Reject</button>
        </div>` : `<span style="font-size:11px;color:var(--muted)">Processed</span>`;

      return `
        <div class="table-row" style="grid-template-columns: 1.5fr 1.5fr 1fr 1fr 1.2fr 1fr 1.5fr;">
          <div>
            <div style="font-weight:600;color:var(--text)">${r.user?.name || 'Unknown'}</div>
            <div style="font-size:11px;color:var(--muted)">${r.user?.email || 'No email'}</div>
          </div>
          <div>
            <div style="font-weight:600;color:var(--accent2)">${r.senderName}</div>
            <div style="font-size:11px;color:var(--muted);font-family:monospace">Trx: ${r.transactionId}</div>
          </div>
          <span style="font-weight:700">PKR ${r.amount}</span>
          <span style="font-size:12px">${new Date(r.paymentDate || r.createdAt).toLocaleDateString()}</span>
          <div>${screenshotThumb}</div>
          <span style="font-weight:700;color:${statusColor}">${r.status}</span>
          <div>${actions}</div>
        </div>`;
    }).join('');

  } catch (err) {
    container.innerHTML = `<div style="padding:24px;text-align:center;color:#EF4444">Error: ${err.message}</div>`;
  }
}

async function updatePendingBadge(requests) {
  const badge = document.getElementById('pending-badge');
  if (!badge) return;

  if (!requests) {
    const API_BASE = window.location.origin.includes(':3000') ? '' : 'http://localhost:3000';
    const token = await getAdminToken();
    try {
      const res = await fetch(`${API_BASE}/api/admin/payments?status=PENDING`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) requests = await res.json();
    } catch (e) {}
  }

  const pendingCount = Array.isArray(requests) ? requests.filter(r => r.status === 'PENDING').length : 0;
  if (pendingCount > 0) {
    badge.textContent = pendingCount;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function openScreenshotModal(url, name) {
  const modal = document.getElementById('screenshot-modal');
  const img = document.getElementById('modal-img');
  const title = document.getElementById('modal-title');
  if (modal && img) {
    img.src = url;
    if (title) title.textContent = `Receipt Screenshot — ${name}`;
    modal.classList.remove('hidden');
  }
}

function closeScreenshotModal() {
  const modal = document.getElementById('screenshot-modal');
  if (modal) modal.classList.add('hidden');
}

async function approvePaymentRequest(id) {
  if (!confirm('Approve this payment request and activate Unlimited subscription for 30 days?')) return;
  const API_BASE = window.location.origin.includes(':3000') ? '' : 'http://localhost:3000';
  const token = await getAdminToken();

  try {
    const res = await fetch(`${API_BASE}/api/admin/payments/${id}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to approve payment');

    showAlert('✅ Payment request approved! 30-day Unlimited subscription activated.', 'success');
    renderPaymentRequestsTable();
  } catch (err) {
    showAlert(`❌ ${err.message}`, 'error');
  }
}

async function rejectPaymentRequest(id) {
  const reason = prompt('Reason for rejection (optional):', 'Invalid transaction receipt or unverified payment.');
  if (reason === null) return;

  const API_BASE = window.location.origin.includes(':3000') ? '' : 'http://localhost:3000';
  const token = await getAdminToken();

  try {
    const res = await fetch(`${API_BASE}/api/admin/payments/${id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ rejectionReason: reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reject payment');

    showAlert('✅ Payment request rejected.', 'success');
    renderPaymentRequestsTable();
  } catch (err) {
    showAlert(`❌ ${err.message}`, 'error');
  }
}
