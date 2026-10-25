// ==========================================
// FinBot Dashboard Frontend Logic
// ==========================================

const formatIDR = (num) => {
  return 'Rp' + Math.round(num || 0).toLocaleString('id-ID');
};

// 1. Live WIB Clock
function updateClock() {
  const clockEl = document.getElementById('live-clock');
  if (!clockEl) return;
  const now = new Date();
  const options = {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  clockEl.textContent = new Intl.DateTimeFormat('id-ID', options).format(now) + ' WIB';
}
setInterval(updateClock, 1000);
updateClock();

// 2. Fetch Dashboard Statistics
async function loadDashboardStats() {
  const refreshTimeEl = document.getElementById('refresh-time');
  if (refreshTimeEl) refreshTimeEl.textContent = 'Memuat...';

  try {
    const res = await fetch('/api/proxy/stats');
    if (!res.ok) throw new Error('Gagal mengambil data dari proxy backend');
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Terjadi kesalahan backend');

    const summary = data.summary || {};
    const rules = data.rules || [];
    const recent = data.recent || [];

    // Render Stats
    document.getElementById('stat-income').textContent = formatIDR(summary.totalIncome);
    document.getElementById('stat-expense').textContent = formatIDR(summary.totalExpense);
    document.getElementById('stat-savings').textContent =
      'Selisih: ' + formatIDR(summary.netSavings);

    // Ratio Needs vs Wants
    const totalExp = summary.totalExpense || 1;
    const needsPct = Math.round(((summary.needsTotal || 0) / totalExp) * 100);
    const wantsPct = Math.round(((summary.wantsTotal || 0) / totalExp) * 100);

    document.getElementById('stat-ratio').textContent = `${needsPct}% : ${wantsPct}%`;
    document.getElementById('bar-needs').style.width = `${needsPct}%`;
    document.getElementById('bar-wants').style.width = `${wantsPct}%`;
    document.getElementById('text-needs').textContent = formatIDR(summary.needsTotal);
    document.getElementById('text-wants').textContent = formatIDR(summary.wantsTotal);

    // Bocor Halus
    document.getElementById('stat-microleak').textContent = formatIDR(summary.microLeakTotal);
    document.getElementById('stat-leak-count').textContent =
      `${summary.microLeakCount || 0} Transaksi Impulsif`;

    // Render Categories
    renderCategories(summary.categoryBreakdown || {}, summary.totalExpense || 0);

    // Render Rules
    renderRules(rules);

    // Render Recent Transactions
    renderTransactions(recent);

    if (refreshTimeEl) {
      const now = new Date();
      refreshTimeEl.textContent = `Sinkron ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (err) {
    console.error('Error loading stats:', err);
    if (refreshTimeEl) refreshTimeEl.textContent = 'Offline / Gagal';
  }
}

function renderCategories(breakdown, totalExpense) {
  const listEl = document.getElementById('category-list');
  const entries = Object.entries(breakdown);

  if (entries.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Belum ada pengeluaran bulan ini.</div>';
    return;
  }

  entries.sort(([, a], [, b]) => b - a);

  listEl.innerHTML = entries
    .map(([cat, amount]) => {
      const pct = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
      return `
      <div class="category-item">
        <div class="category-info">
          <span class="category-name">${cat}</span>
          <span class="category-amount">${formatIDR(amount)} (${pct}%)</span>
        </div>
        <div class="category-bar-bg">
          <div class="category-bar-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
    })
    .join('');
}

function renderRules(rules) {
  const rulesListEl = document.getElementById('rules-list');
  const rulesCountEl = document.getElementById('rules-count');

  if (rulesCountEl) rulesCountEl.textContent = `${rules.length} Aturan`;

  if (rules.length === 0) {
    rulesListEl.innerHTML = '<div class="empty-state">Belum ada aturan tersimpan di database.</div>';
    return;
  }

  rulesListEl.innerHTML = rules
    .map((r) => `<div class="rule-pill">📌 ${r}</div>`)
    .join('');
}

function renderTransactions(transactions) {
  const rowsEl = document.getElementById('transaction-rows');

  if (transactions.length === 0) {
    rowsEl.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 24px; color: var(--text-dim);">
          Belum ada data transaksi yang tercatat.
        </td>
      </tr>
    `;
    return;
  }

  rowsEl.innerHTML = transactions
    .map((t) => {
      const isExpense = t.type === 'EXPENSE';
      const typeBadge = `<span class="badge ${isExpense ? 'badge-expense' : 'badge-income'}">${t.type}</span>`;
      const classBadge = `<span class="badge ${t.class === 'Needs' ? 'badge-needs' : 'badge-wants'}">${t.class}</span>`;
      const leakBadge = t.is_micro_leak
        ? `<span class="badge badge-leak-yes">⚠️ Bocor</span>`
        : `<span class="badge badge-leak-no">-</span>`;

      return `
      <tr>
        <td style="color: var(--text-muted); font-size: 12px;">${t.created_at || '-'}</td>
        <td><span class="badge" style="background: rgba(255,255,255,0.08); font-weight: 600;">${t.user_name || 'Tonyy'}</span></td>
        <td>${typeBadge}</td>
        <td><b>${t.category}</b></td>
        <td>${t.desc || t.description || '-'}</td>
        <td>${classBadge}</td>
        <td>${leakBadge}</td>
        <td style="text-align: right; font-weight: 700; color: ${isExpense ? '#f87171' : 'var(--accent-emerald)'};">
          ${isExpense ? '-' : '+'}${formatIDR(t.amount)}
        </td>
      </tr>
    `;
    })
    .join('');
}

// 3. Chat Modal / Simulator Logic
const modal = document.getElementById('chat-modal');
const openChatBtn = document.getElementById('open-chat-btn');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatHistory = document.getElementById('chat-history');
const refreshBtn = document.getElementById('refresh-btn');

if (openChatBtn) {
  openChatBtn.addEventListener('click', () => {
    modal.classList.add('open');
    chatInput.focus();
  });
}

if (closeChatBtn) {
  closeChatBtn.addEventListener('click', () => {
    modal.classList.remove('open');
  });
}

if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });
}

if (refreshBtn) {
  refreshBtn.addEventListener('click', loadDashboardStats);
}

// Format WhatsApp text (*bold*, _italic_) to HTML
function formatWhatsAppText(text) {
  let formatted = text
    .replace(/\*([^\*]+)\*/g, '<b>$1</b>')
    .replace(/_([^_]+)_/g, '<i>$1</i>')
    .replace(/~([^~]+)~/g, '<del>$1</del>')
    .replace(/\n/g, '<br/>');
  return formatted;
}

if (chatForm) {
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    // Tambahkan bubble user
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble bubble-user';
    userBubble.textContent = text;
    chatHistory.appendChild(userBubble);
    chatInput.value = '';
    chatHistory.scrollTop = chatHistory.scrollHeight;

    // Loading indicator
    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'chat-bubble bubble-bot';
    loadingBubble.innerHTML = '<i>FinBot sedang memproses...</i>';
    chatHistory.appendChild(loadingBubble);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    try {
      const res = await fetch('/api/proxy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: '6281234567890',
          message: text,
          sendWhatsApp: false, // jangan dispatch pesan keluar saat tes dari dashboard
        }),
      });

      const result = await res.json();
      if (result.success && result.reply) {
        loadingBubble.innerHTML = formatWhatsAppText(result.reply);
      } else {
        loadingBubble.innerHTML = '❌ ' + (result.error || 'Gagal memproses pesan');
      }

      // Refresh data statistik di background
      loadDashboardStats();
    } catch (err) {
      loadingBubble.innerHTML = '❌ Error koneksi ke server: ' + err.message;
    }

    chatHistory.scrollTop = chatHistory.scrollHeight;
  });
}

// Inisialisasi awal & polling setiap 20 detik
loadDashboardStats();
setInterval(loadDashboardStats, 20000);
