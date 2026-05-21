// --- Ledger Management Core ---
let ledgers = JSON.parse(localStorage.getItem('ledgers')) || [
    { id: 'default', name: '個人帳本', title: '我的財富管理' }
];
let currentLedgerId = localStorage.getItem('currentLedgerId') || 'default';

// --- Cloud Sync State ---
let syncUrl = localStorage.getItem('syncUrl') || '';
let isSyncing = false;
let hasFetchedThisSession = false; // Only pull from cloud once per page load


// ---- First-time Setup Logic ----
(function checkSetup() {
    const overlay = document.getElementById('setup-overlay');
    if (!overlay) return;

    // If syncUrl already saved, hide overlay immediately
    if (syncUrl) {
        overlay.style.display = 'none';
        return;
    }

    // Show overlay
    overlay.style.display = 'flex';
    // Hide main app until setup done
    document.querySelector('.app-container')?.style.setProperty('display', 'none');

    const connectBtn = document.getElementById('setup-connect-btn');
    const skipBtn    = document.getElementById('setup-skip-btn');
    const statusEl   = document.getElementById('setup-status');
    const urlInput   = document.getElementById('setup-sync-url');

    function dismissSetup() {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            overlay.style.display = 'none';
            document.querySelector('.app-container')?.style.removeProperty('display');
        }, 500);
    }

    connectBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) { statusEl.textContent = '請輸入同步連結。'; statusEl.style.color = '#fb7185'; return; }

        connectBtn.disabled = true;
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 連線中...';
        statusEl.textContent = '';

        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data && Object.keys(data).length > 0) {
                // Save URL first
                localStorage.setItem('syncUrl', url);
                syncUrl = url;
                // Write all cloud data to localStorage
                for (const key in data) {
                    if (key.startsWith('ledger_data_') || key === 'ledgers') {
                        localStorage.setItem(key, typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]));
                    }
                }
                statusEl.textContent = '✅ 資料同步成功！即將進入...';
                statusEl.style.color = '#10b981';
                setTimeout(dismissSetup, 1200);
            } else {
                // URL works but no data yet — first use
                localStorage.setItem('syncUrl', url);
                syncUrl = url;
                statusEl.textContent = '✅ 連線成功！尚無雲端資料，進入空白帳本...';
                statusEl.style.color = '#10b981';
                setTimeout(dismissSetup, 1200);
            }
        } catch (e) {
            statusEl.textContent = '⚠️ 連線失敗，請確認連結是否正確。';
            statusEl.style.color = '#fb7185';
            connectBtn.disabled = false;
            connectBtn.innerHTML = '<i class="fas fa-link"></i> 連線並同步資料';
        }
    });

    skipBtn.addEventListener('click', () => {
        localStorage.setItem('syncUrl', ''); // Mark as seen, no URL
        dismissSetup();
    });
})();


// State for active ledger
let transactions = [];
let accounts = [];
let categories = {};
let budgets = {};
let notes = '';           // Bulletin board notes HTML (synced via cloud)
let myChart = null;
let combinedChart = null;
let expensePieChart = null;
let currentRange = 'daily';

// --- DOM Elements ---
const mainTitle = document.getElementById('main-title');
const ledgerSwitch = document.getElementById('ledger-switch');
const balanceEl = document.getElementById('total-balance');
const monthlyIncomeEl = document.getElementById('monthly-income');
const monthlyExpenseEl = document.getElementById('monthly-expense');
const dailyIncomeEl = document.getElementById('daily-income');
const dailyExpenseEl = document.getElementById('daily-expense');
const listEl = document.getElementById('transaction-list');
const accountsContainer = document.getElementById('accounts-container');
const form = document.getElementById('transaction-form');
const modal = document.getElementById('modal');
const addBtn = document.getElementById('add-btn');
const exportBtn = document.getElementById('export-btn');
const closeBtn = document.getElementById('close-modal');
const dateInput = document.getElementById('date');
const typeRadios = document.querySelectorAll('input[name="type"]');
const toAccountGroup = document.getElementById('to-account-group');
const installmentGroup = document.getElementById('installment-group');
const excludeStatsCheckbox = document.getElementById('exclude-stats');
const categorySelect = document.getElementById('category');
const subcategorySelect = document.getElementById('subcategory');
const manageAccountsBtn = document.getElementById('manage-accounts-btn');
const accountModal = document.getElementById('account-modal');
const closeAccountModal = document.getElementById('close-account-modal');
const accountManagerList = document.getElementById('account-manager-list');
const addAccountForm = document.getElementById('add-account-form');
const accountSelect = document.getElementById('account');
const toAccountSelect = document.getElementById('to-account');
const manageCategoriesBtn = document.getElementById('manage-categories-btn');
const categoryModal = document.getElementById('category-modal');
const closeCategoryModal = document.getElementById('close-category-modal');
const categoryManagerList = document.getElementById('category-manager-list');
const addCategoryForm = document.getElementById('add-category-form');
const addSubcategoryForm = document.getElementById('add-subcategory-form');
const targetCategoryLabel = document.getElementById('target-category-label');
const privacyToggle = document.getElementById('privacy-toggle');
const toggleViewBtn = document.getElementById('toggle-view-btn');
const backupBtn = document.getElementById('backup-btn');
const restoreBtn = document.getElementById('restore-btn');
const restoreInput = document.getElementById('restore-input');
const syncSettingsBtn = document.getElementById('sync-settings-btn');
const syncModal = document.getElementById('sync-modal');
const closeSyncModal = document.getElementById('close-sync-modal');
const syncForm = document.getElementById('sync-form');
const syncUrlInput = document.getElementById('sync-url');
const forceSyncBtn = document.getElementById('force-sync-btn');
const manageLedgersBtn = document.getElementById('manage-ledgers-btn');
const ledgerModal = document.getElementById('ledger-modal');
const closeLedgerModal = document.getElementById('close-ledger-modal');
const ledgerManagerList = document.getElementById('ledger-manager-list');
const addLedgerForm = document.getElementById('add-ledger-form');
const annualReportBtn = document.getElementById('annual-report-btn');
const reportModal = document.getElementById('report-modal');
const closeReportModal = document.getElementById('close-report-modal');
const reportYearSelect = document.getElementById('report-year-select');
const reportTable = document.getElementById('annual-report-table');
const printReportBtn = document.getElementById('print-report-btn');
const manageBudgetBtn = document.getElementById('manage-budget-btn');
const budgetModal = document.getElementById('budget-modal');
const closeBudgetModal = document.getElementById('close-budget-modal');
const budgetManagerList = document.getElementById('budget-manager-list');
const saveBudgetBtn = document.getElementById('save-budget-btn');
const budgetContainer = document.getElementById('budget-container');
const accountDetailsModal = document.getElementById('account-details-modal');
const closeAccountDetailsModal = document.getElementById('close-account-details-modal');
const accountDetailsName = document.getElementById('account-details-name');
const accountDetailsBalance = document.getElementById('account-details-balance');
const accountDetailsList = document.getElementById('account-details-list');

// --- Privacy Logic ---
let privacyMode = localStorage.getItem('privacyMode') === 'true';
function updatePrivacyUI() {
    document.body.classList.toggle('privacy-mode', privacyMode);
    if (privacyToggle) {
        privacyToggle.querySelector('i').className = privacyMode ? 'fas fa-eye-slash' : 'fas fa-eye';
    }
}
updatePrivacyUI();

// --- Cloud Sync ---
function setSyncStatus(status, text) {
    if (!syncSettingsBtn) return;
    syncSettingsBtn.className = `icon-btn sync-status ${status}`;
    const span = document.getElementById('sync-text');
    if (span) span.innerText = text;
    const icon = syncSettingsBtn.querySelector('i');
    if (icon) icon.className = status === 'syncing' ? 'fas fa-spinner fa-spin' : (status === 'online' ? 'fas fa-check-circle' : 'fas fa-cloud-upload-alt');
}

function fetchWithTimeout(url, options = {}, ms = 12000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), ms);
        fetch(url, options)
            .then(res => { clearTimeout(timer); resolve(res); })
            .catch(err => { clearTimeout(timer); reject(err); });
    });
}

async function fetchFromCloud() {
    if (!syncUrl) return false;
    setSyncStatus('syncing', '同步中');
    try {
        const response = await fetchWithTimeout(syncUrl, {}, 12000);
        const raw = await response.text(); // get raw text first
        let data;
        try { data = JSON.parse(raw); } catch(e) {
            console.warn('fetchFromCloud: invalid JSON response', raw.substring(0, 200));
            setSyncStatus('offline', '資料格式錯誤');
            return false;
        }
        
        console.log('fetchFromCloud keys:', Object.keys(data || {}));
        
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
            let wroteAny = false;
            for (const key in data) {
                if (key.startsWith('ledger_data_') || key === 'ledgers') {
                    // Validate: only write if the value is non-empty
                    const val = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
                    if (val && val !== '{}' && val !== 'null') {
                        localStorage.setItem(key, val);
                        wroteAny = true;
                    }
                }
            }
            setSyncStatus('online', '已同步');
            return wroteAny;
        }
        setSyncStatus('online', '已同步');
        return false;
    } catch (e) {
        console.warn('fetchFromCloud error:', e.message);
        setSyncStatus('offline', e.message === 'timeout' ? '同步逾時' : '未連線');
        return false;
    }
}

async function pushToCloud() {
    if (!syncUrl || isSyncing) return;
    isSyncing = true;
    setSyncStatus('syncing', '同步中');
    const allData = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('ledger_data_') || key === 'ledgers') allData[key] = localStorage.getItem(key);
    }
    try {
        // no-cors: response is opaque, so we assume success if no exception thrown
        await fetchWithTimeout(syncUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify(allData) }, 12000);
        setSyncStatus('online', '已同步');
    } catch (e) {
        console.warn('pushToCloud:', e.message);
        setSyncStatus('offline', e.message === 'timeout' ? '同步逾時' : '同步失敗');
    }
    isSyncing = false;
}

// --- Data Core ---
function formatNumber(num) { return Math.round(parseFloat(num || 0)).toLocaleString('en-US'); }

async function loadLedgerData() {
    // Only pull from cloud once per session to avoid overwriting fresh local saves
    if (syncUrl && !hasFetchedThisSession) {
        hasFetchedThisSession = true;
        await fetchFromCloud();
    }
    const raw = localStorage.getItem(`ledger_data_${currentLedgerId}`);
    const data = raw ? JSON.parse(raw) : {};
    transactions = data.transactions || [];
    accounts = data.accounts || [
        { id: 1, name: '現金', type: '現金', initialBalance: 0, includeInNetWorth: true },
        { id: 2, name: '銀行帳戶', type: '銀行帳戶', initialBalance: 0, includeInNetWorth: true }
    ];
    categories = data.categories || {
        expense: [{ name: '飲食', sub: ['早餐', '午餐', '晚餐'] }, { name: '交通', sub: [] }, { name: '其他', sub: [] }],
        income: [{ name: '薪資', sub: [] }, { name: '獎金', sub: [] }, { name: '其他', sub: [] }],
        transfer: [{ name: '轉帳', sub: [] }, { name: '信用卡還款', sub: [] }]
    };
    let loadedBudgets = data.budgets || {};
    if (loadedBudgets && Object.keys(loadedBudgets).length > 0 && !loadedBudgets.default && !loadedBudgets.monthly) {
        // Migration: Old format { "飲食": 5000 } -> New format { default: { "飲食": 5000 }, monthly: {} }
        budgets = { default: { ...loadedBudgets }, monthly: {} };
    } else {
        budgets = {
            default: loadedBudgets.default || {},
            monthly: loadedBudgets.monthly || {}
        };
    }
    // Load notes (HTML string)
    notes = data.notes || '';
}

function saveLedgerData() {
    const data = { transactions, accounts, categories, budgets, notes };
    localStorage.setItem(`ledger_data_${currentLedgerId}`, JSON.stringify(data));
    pushToCloud();
}

function calculateAccountBalance(accountName, upToDate = new Date()) {
    const acc = accounts.find(a => a.name === accountName);
    if (!acc) return 0;
    let bal = acc.initialBalance || 0;
    const targetDate = new Date(upToDate);
    transactions.forEach(t => {
        if (new Date(t.date) > targetDate) return;
        if (t.account === accountName) {
            if (t.type === 'expense' || t.type === 'transfer') bal -= t.amount;
            if (t.type === 'income') bal += t.amount;
        }
        if (t.type === 'transfer' && t.toAccount === accountName) bal += t.amount;
    });
    return bal;
}

// --- Rendering ---
function updateSummary() {
    let monthlyIncome = 0, monthlyExpense = 0;
    let dailyIncome = 0, dailyExpense = 0;
    let netWorth = 0;
    
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    transactions.forEach(t => {
        if (t.excludeFromStats) return;
        
        if (t.date.startsWith(thisMonthStr)) {
            if (t.type === 'income') monthlyIncome += t.amount;
            if (t.type === 'expense') monthlyExpense += t.amount;
        }
        
        if (t.date.startsWith(todayStr)) {
            if (t.type === 'income') dailyIncome += t.amount;
            if (t.type === 'expense') dailyExpense += t.amount;
        }
    });
    accounts.forEach(acc => { if (acc.includeInNetWorth !== false) netWorth += calculateAccountBalance(acc.name); });
    balanceEl.innerText = `$ ${formatNumber(netWorth)}`;
    if (monthlyIncomeEl) monthlyIncomeEl.innerText = `$ ${formatNumber(monthlyIncome)}`;
    if (monthlyExpenseEl) monthlyExpenseEl.innerText = `$ ${formatNumber(monthlyExpense)}`;
    if (dailyIncomeEl) dailyIncomeEl.innerText = `$ ${formatNumber(dailyIncome)}`;
    if (dailyExpenseEl) dailyExpenseEl.innerText = `$ ${formatNumber(dailyExpense)}`;
}

function renderTransactions() {
    listEl.innerHTML = '';
    const searchInput = document.getElementById('transaction-search');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let filtered = transactions.slice();

    if (query) {
        filtered = filtered.filter(t => {
            return (
                (t.description || '').toLowerCase().includes(query) ||
                (t.category || '').toLowerCase().includes(query) ||
                (t.subcategory || '').toLowerCase().includes(query) ||
                (t.account || '').toLowerCase().includes(query) ||
                (t.date || '').toLowerCase().includes(query) ||
                String(t.amount).includes(query)
            );
        });
    }

    if (filtered.length === 0) {
        listEl.innerHTML = query
            ? `<div class="empty-state"><i class="fas fa-search" style="font-size:1.5rem; opacity:0.4; margin-bottom:0.5rem;"></i><br>找不到符合「${query}」的交易</div>`
            : '<div class="empty-state">尚無交易紀錄</div>';
        return;
    }

    // Show result count when searching
    if (query) {
        const countBanner = document.createElement('div');
        countBanner.className = 'search-result-count';
        countBanner.innerHTML = `<i class="fas fa-filter"></i> 找到 <strong>${filtered.length}</strong> 筆符合結果`;
        listEl.appendChild(countBanner);
    }

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id).forEach(t => {
        const item = document.createElement('div'); 
        item.className = `transaction-item ${t.excludeFromStats ? 'excluded' : ''}`;
        item.style.cursor = 'pointer';
        item.onclick = (e) => {
            if (!e.target.closest('button')) editTransaction(t.id);
        };
        
        let sign = '', amountClass = t.type;
        if (t.type === 'income') sign = '+'; else if (t.type === 'expense') sign = '-'; else sign = '⇌';

        // Highlight matching text
        const highlight = (text) => {
            if (!query || !text) return text || '';
            const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="search-highlight">$1</mark>');
        };

        item.innerHTML = `
            <div class="item-info">
                <div class="item-icon"><i class="fas fa-receipt"></i></div>
                <div class="item-details"><h4>${highlight(t.description)}</h4><p>${highlight(t.category)}${t.subcategory ? ' • ' + highlight(t.subcategory) : ''} • ${highlight(t.account)}</p><span class="item-date">${t.date.replace('T', ' ')}</span></div>
            </div>
            <div class="item-amount ${amountClass}"><strong class="amount">${sign} $${formatNumber(t.amount)}</strong>
            <button class="btn-delete" onclick="event.stopPropagation(); removeTransaction(${t.id})"><i class="fas fa-trash-alt"></i></button></div>
        `;
        listEl.appendChild(item);
    });
}


function renderAccounts() {
    accountsContainer.innerHTML = '';

    const typeGroups = [
        { label: '現金', types: ['現金'], icon: 'fa-money-bill-wave', isLiability: false },
        { label: '銀行帳戶', types: ['銀行帳戶', '銀行', '儲蓄'], icon: 'fa-university', isLiability: false },
        { label: '信用卡', types: ['信用卡'], icon: 'fa-credit-card', isLiability: true },
        { label: '投資帳戶', types: ['投資帳戶', '投資', '基金', '股票'], icon: 'fa-chart-line', isLiability: false },
        { label: '其他', types: ['__other__'], icon: 'fa-wallet', isLiability: false },
    ];

    const renderPartition = (isIncluded) => {
        const classified = {};
        typeGroups.forEach(g => classified[g.label] = []);
        const assignedIds = new Set();

        const partitionAccounts = accounts.filter(a => isIncluded ? a.includeInNetWorth !== false : a.includeInNetWorth === false);

        if (partitionAccounts.length === 0) return null;

        typeGroups.filter(g => g.label !== '其他').forEach(group => {
            partitionAccounts.forEach(acc => {
                if (!assignedIds.has(acc.id) && group.types.some(t => acc.type === t || acc.type.includes(t))) {
                    classified[group.label].push(acc);
                    assignedIds.add(acc.id);
                }
            });
        });
        partitionAccounts.forEach(acc => { if (!assignedIds.has(acc.id)) classified['其他'].push(acc); });

        let grandTotal = 0;
        let hasAny = false;

        const partitionContainer = document.createElement('div');
        if (!isIncluded) {
            partitionContainer.style.marginTop = '2rem';
            partitionContainer.style.paddingTop = '1rem';
            partitionContainer.style.borderTop = '1px dashed var(--glass-border)';
            partitionContainer.style.opacity = '0.85';
            
            const title = document.createElement('h4');
            title.innerText = '不計入資產的帳戶';
            title.style.color = 'var(--text-muted)';
            title.style.marginBottom = '1.2rem';
            title.style.marginTop = '0';
            title.style.textAlign = 'center';
            partitionContainer.appendChild(title);
        }

        typeGroups.forEach(group => {
            const groupAccounts = classified[group.label];
            if (groupAccounts.length === 0) return;
            hasAny = true;

            const subtotal = groupAccounts.reduce((s, acc) => s + calculateAccountBalance(acc.name), 0);
            grandTotal += subtotal;

            const header = document.createElement('div');
            header.className = 'account-group-header';
            header.innerHTML = `<i class="fas ${group.icon}"></i> ${group.label}`;
            partitionContainer.appendChild(header);

            groupAccounts.forEach(acc => {
                const bal = calculateAccountBalance(acc.name);
                const row = document.createElement('div');
                row.className = 'account-row';
                row.style.cursor = 'pointer';
                row.onclick = () => showAccountDetails(acc.name);
                row.innerHTML = `
                    <span class="account-row-name amount">${acc.name}</span>
                    <span class="account-row-bal amount ${bal < 0 ? 'neg-bal' : 'pos-bal'}">$ ${formatNumber(bal)}</span>
                `;
                partitionContainer.appendChild(row);
            });

            const sub = document.createElement('div');
            sub.className = 'account-subtotal';
            sub.innerHTML = `
                <span>小計</span>
                <span class="amount ${subtotal < 0 ? 'neg-bal' : ''}">$ ${formatNumber(subtotal)}</span>
            `;
            partitionContainer.appendChild(sub);
        });

        if (hasAny) {
            const total = document.createElement('div');
            total.className = 'account-grand-total';
            if (!isIncluded) {
                total.style.background = 'rgba(255, 255, 255, 0.4)';
                total.style.color = 'var(--text-muted)';
                total.style.borderColor = 'transparent';
                total.innerHTML = `
                    <span>不計入資產總額</span>
                    <span class="amount ${grandTotal < 0 ? 'neg-bal' : ''}">$ ${formatNumber(grandTotal)}</span>
                `;
            } else {
                total.innerHTML = `
                    <span>流動資金總額</span>
                    <span class="amount ${grandTotal < 0 ? 'neg-bal' : ''}">$ ${formatNumber(grandTotal)}</span>
                `;
            }
            partitionContainer.appendChild(total);
        }

        return hasAny ? partitionContainer : null;
    };

    const includedNodes = renderPartition(true);
    const excludedNodes = renderPartition(false);

    if (includedNodes) accountsContainer.appendChild(includedNodes);
    if (excludedNodes) accountsContainer.appendChild(excludedNodes);
}

function renderBudgetWidget() {
    budgetContainer.innerHTML = '';
    const expenseCats = categories.expense || [];
    
    const widgetMonthInput = document.getElementById('widget-budget-month');
    const now = new Date();
    const defaultMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    if (!widgetMonthInput.value) {
        widgetMonthInput.value = defaultMonthKey;
    }
    
    const currentMonthKey = widgetMonthInput.value;
    const monthlyOverride = budgets.monthly[currentMonthKey] || {};
    
    const getCatBudget = (catName) => {
        return monthlyOverride[catName] !== undefined ? monthlyOverride[catName] : (budgets.default[catName] || 0);
    };

    const activeBudgets = expenseCats.filter(cat => getCatBudget(cat.name) > 0);
    if (activeBudgets.length === 0) { budgetContainer.innerHTML = '<div class="empty-state">未設定預算</div>'; return; }
    
    activeBudgets.forEach(cat => {
        const budgetAmount = getCatBudget(cat.name);
        const actualAmount = transactions.filter(t => t.category === cat.name && t.type === 'expense' && t.date.startsWith(currentMonthKey)).reduce((s, t) => s + t.amount, 0);
        const percentage = Math.min((actualAmount / budgetAmount) * 100, 100);
        const statusClass = percentage > 90 ? 'danger' : (percentage > 70 ? 'warning' : 'safe');
        const item = document.createElement('div'); item.className = 'budget-item';
        item.innerHTML = `
            <div class="budget-info"><span>${cat.name}</span><span class="amount">$ ${formatNumber(actualAmount)} / $ ${formatNumber(budgetAmount)}</span></div>
            <div class="budget-progress-bg"><div class="budget-progress-bar ${statusClass}" style="width:${percentage}%"></div></div>
        `;
        budgetContainer.appendChild(item);
    });
}

document.getElementById('widget-budget-month').addEventListener('change', renderBudgetWidget);

// --- Managers Logic ---
function renderAccountManager() {
    accountManagerList.innerHTML = accounts.map(acc => `
        <div class="transaction-item" style="margin-bottom: 0.5rem; justify-content: space-between; display: flex; align-items: center; width: 100%;">
            <div><strong>${acc.name}</strong> (${acc.type})</div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="icon-btn" onclick="editAccount(${acc.id})"><i class="fas fa-edit"></i></button>
                <button class="icon-btn" onclick="removeAccount(${acc.id})" style="color:var(--primary)"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

window.editAccount = function(id) {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    document.getElementById('edit-account-id').value = acc.id;
    document.getElementById('new-account-name').value = acc.name;
    document.getElementById('new-account-type').value = acc.type;
    document.getElementById('new-account-balance').value = acc.initialBalance;
    document.getElementById('new-account-networth').checked = acc.includeInNetWorth !== false;
    document.getElementById('account-form-title').innerText = '編輯帳戶';
    document.getElementById('account-submit-btn').innerText = '儲存變更';
    document.getElementById('cancel-account-edit').classList.remove('hidden');
};

window.removeAccount = function(id) {
    if (confirm('確定要刪除此帳戶嗎？所有相關餘額將受影響。')) {
        accounts = accounts.filter(a => a.id !== id);
        saveLedgerData(); init(); renderAccountManager();
    }
};

function renderCategoryManager() {
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'expense';
    const cats = categories[activeTab] || [];
    categoryManagerList.innerHTML = cats.map((cat, idx) => `
        <div class="category-item-container" data-idx="${idx}">
            <div class="category-header">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-grip-vertical category-handle" style="cursor: grab; color: var(--text-muted); opacity: 0.5;"></i>
                    <strong>${cat.name}</strong>
                </div>
                <div class="category-actions">
                    <button class="icon-btn" onclick="showAddSub(${idx})" title="增加子類別"><i class="fas fa-plus"></i></button>
                    <button class="icon-btn" onclick="removeCategory('${activeTab}', ${idx})" style="color:var(--primary)" title="刪除主類別"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div style="padding-left: 1.5rem; margin-top: 1rem; display:flex; flex-wrap:wrap; gap:0.5rem;">
                ${cat.sub.map((s, sidx) => `
                    <span class="badge" style="background:var(--secondary); padding:6px 12px; border-radius:12px; font-size:0.85rem; cursor:pointer; color:var(--text-muted); border: 1px solid rgba(251,113,133,0.1);" 
                          onclick="removeSubcategory('${activeTab}', ${idx}, ${sidx})">
                        ${s} <i class="fas fa-times" style="margin-left:5px; font-size:0.7rem; opacity:0.6;"></i>
                    </span>`).join('')}
            </div>
        </div>
    `).join('');

    if (typeof Sortable !== 'undefined') {
        if (window.categorySortable) {
            window.categorySortable.destroy();
        }
        window.categorySortable = new Sortable(categoryManagerList, {
            handle: '.category-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                const oldIndex = evt.oldIndex;
                const newIndex = evt.newIndex;
                if (oldIndex === newIndex) return;
                
                const movedItem = categories[activeTab].splice(oldIndex, 1)[0];
                categories[activeTab].splice(newIndex, 0, movedItem);
                
                saveLedgerData();
                renderCategoryManager();
                updateCategorySelect();
            }
        });
    }
}

window.removeCategory = function(type, idx) { categories[type].splice(idx, 1); saveLedgerData(); renderCategoryManager(); updateCategorySelect(); };
window.removeSubcategory = function(type, cIdx, sIdx) { categories[type][cIdx].sub.splice(sIdx, 1); saveLedgerData(); renderCategoryManager(); updateCategorySelect(); };
window.showAddSub = function(idx) {
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    targetCategoryLabel.innerText = categories[activeTab][idx].name;
    addSubcategoryForm.dataset.idx = idx;
    addSubcategoryForm.classList.remove('hidden');
};

function renderLedgerManager() {
    ledgerManagerList.innerHTML = ledgers.map(l => `
        <div class="transaction-item" style="margin-bottom: 0.5rem; justify-content: space-between; display: flex; align-items: center; width: 100%;">
            <div><strong>${l.name}</strong><br><small>${l.title || ''}</small></div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="icon-btn" onclick="editLedger('${l.id}')"><i class="fas fa-edit"></i></button>
                <button class="icon-btn" onclick="removeLedger('${l.id}')" ${l.id === 'default' ? 'disabled' : ''}><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

window.editLedger = function(id) {
    const l = ledgers.find(ledger => ledger.id === id);
    if (!l) return;
    document.getElementById('edit-ledger-id').value = l.id;
    document.getElementById('new-ledger-name').value = l.name;
    document.getElementById('new-ledger-title').value = l.title || '';
    document.getElementById('ledger-form-title').innerText = '編輯帳本';
    document.getElementById('ledger-submit-btn').innerText = '儲存變更';
    document.getElementById('cancel-ledger-edit').classList.remove('hidden');
};

window.removeLedger = function(id) { if (confirm('確定刪除此帳本？')) { ledgers = ledgers.filter(l => l.id !== id); localStorage.setItem('ledgers', JSON.stringify(ledgers)); renderLedgerManager(); populateLedgerSwitch(); } };


// --- Select Updates ---
function updateCategorySelect() {
    const type = document.querySelector('input[name="type"]:checked').value;
    const cats = categories[type] || [];
    categorySelect.innerHTML = cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    updateSubcategorySelect();
}

function updateSubcategorySelect() {
    const type = document.querySelector('input[name="type"]:checked').value;
    const catName = categorySelect.value;
    const cat = categories[type]?.find(c => c.name === catName);
    subcategorySelect.innerHTML = (cat?.sub.map(s => `<option value="${s}">${s}</option>`).join('')) || '<option value="">(無)</option>';
}

function populateAccountSelects() {
    const options = accounts.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
    accountSelect.innerHTML = options;
    toAccountSelect.innerHTML = options;
}

function populateLedgerSwitch() {
    ledgerSwitch.innerHTML = ledgers.map(l => `<option value="${l.id}" ${l.id === currentLedgerId ? 'selected' : ''}>${l.name}</option>`).join('');
}

// --- Sortable & Charts ---
function initDraggable() {
    const zones = document.querySelectorAll('.widget-column');
    if (typeof Sortable === 'undefined') return;
    zones.forEach(zone => {
        new Sortable(zone, {
            group: 'dashboard', handle: '.widget-handle', animation: 200, ghostClass: 'sortable-ghost',
            onEnd: () => {
                const layout = {};
                document.querySelectorAll('.widget-column').forEach(z => {
                    layout[z.id] = Array.from(z.children).filter(c => c.id).map(c => c.id);
                });
                localStorage.setItem('widgetLayout', JSON.stringify(layout));
                initCharts();
            }
        });
    });
}

function applyLayout() {
    const saved = JSON.parse(localStorage.getItem('widgetLayout'));
    if (!saved) return;
    for (const zoneId in saved) {
        const zone = document.getElementById(zoneId);
        if (zone) saved[zoneId].forEach(id => { const el = document.getElementById(id); if (el) zone.appendChild(el); });
    }
}

function getTrendData(range) {
    const labels = [];
    const income = [];
    const expense = [];
    const netWorth = [];
    const now = new Date();

    if (range === 'daily') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            
            labels.push(d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }));
            
            const dayT = transactions.filter(t => t.date.startsWith(dateStr) && !t.excludeFromStats);
            income.push(dayT.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
            expense.push(dayT.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
            
            // Net worth calculation up to this date
            let currentNetWorth = 0;
            accounts.forEach(acc => { if (acc.includeInNetWorth !== false) currentNetWorth += calculateAccountBalance(acc.name, d); });
            netWorth.push(currentNetWorth);
        }
    } else if (range === 'monthly') {
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const monthStr = `${yyyy}-${mm}`;
            
            labels.push(d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'short' }));
            
            const monthT = transactions.filter(t => t.date.startsWith(monthStr) && !t.excludeFromStats);
            income.push(monthT.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
            expense.push(monthT.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
            
            // Net worth at the end of this month
            const lastDay = new Date(yyyy, d.getMonth() + 1, 0);
            let currentNetWorth = 0;
            accounts.forEach(acc => { if (acc.includeInNetWorth !== false) currentNetWorth += calculateAccountBalance(acc.name, lastDay); });
            netWorth.push(currentNetWorth);
        }
    } else if (range === 'yearly') {
        for (let i = 2; i >= 0; i--) {
            const year = now.getFullYear() - i;
            labels.push(`${year} 年`);
            
            const yearT = transactions.filter(t => t.date.startsWith(year.toString()) && !t.excludeFromStats);
            income.push(yearT.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
            expense.push(yearT.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
            
            // Net worth at the end of this year
            const lastDay = new Date(year, 11, 31);
            let currentNetWorth = 0;
            accounts.forEach(acc => { if (acc.includeInNetWorth !== false) currentNetWorth += calculateAccountBalance(acc.name, lastDay); });
            netWorth.push(currentNetWorth);
        }
    }
    return { labels, income, expense, netWorth };
}

function initCharts() {
    const trendCtx = document.getElementById('combinedChart')?.getContext('2d');
    if (!trendCtx) return;
    if (combinedChart) combinedChart.destroy();

    const range = currentRange;
    const data = getTrendData(range);

    combinedChart = new Chart(trendCtx, {
        data: {
            labels: data.labels,
            datasets: [
                {
                    type: 'line',
                    label: '資產總值',
                    data: data.netWorth,
                    borderColor: 'rgba(76, 5, 25, 0.4)',
                    borderWidth: 2,
                    pointBackgroundColor: '#4c0519',
                    pointRadius: 4,
                    tension: 0.3,
                    fill: false,
                    yAxisID: 'yNetWorth'
                },
                {
                    type: 'bar',
                    label: '收入',
                    data: data.income,
                    backgroundColor: 'rgba(16, 185, 129, 0.6)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 6,
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: '支出',
                    data: data.expense,
                    backgroundColor: 'rgba(251, 113, 133, 0.6)',
                    borderColor: '#fb7185',
                    borderWidth: 1,
                    borderRadius: 6,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { family: 'Outfit', weight: '600' } } },
                datalabels: false // Disable globally registered datalabels for trend chart
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: '收支金額' },
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                yNetWorth: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: '資產淨值' },
                    beginAtZero: false,
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });

    // Render pie chart separately
    renderPieChart();
}

function renderPieChart() {
    const pieCtx = document.getElementById('expenseChart')?.getContext('2d');
    if (!pieCtx) return;
    if (expensePieChart) expensePieChart.destroy();

    const monthInput = document.getElementById('widget-pie-month');
    const now = new Date();
    if (!monthInput.value) {
        monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const selectedMonth = monthInput.value;

    const expenseTransactions = transactions.filter(t => t.type === 'expense' && !t.excludeFromStats && t.date.startsWith(selectedMonth));
    const categoryTotals = {};
    expenseTransactions.forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    const pieLabels = Object.keys(categoryTotals);
    const pieData = Object.values(categoryTotals);
    const totalPieAmount = pieData.reduce((a, b) => a + b, 0);
    
    // Generate vibrant colors for the pie chart
    const bgColors = pieLabels.map((_, i) => `hsl(${(i * 360 / Math.max(pieLabels.length, 1) + 340) % 360}, 80%, 65%)`);

    expensePieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: pieLabels.length ? pieLabels : ['無資料'],
            datasets: [{
                data: pieData.length ? pieData : [1],
                backgroundColor: pieData.length ? bgColors : ['#eee'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            onClick: (evt, elements) => {
                if (!pieLabels.length || !elements.length) return;
                const idx = elements[0].index;
                const categoryName = pieLabels[idx];
                if (categoryName) showCategoryDetails(categoryName, selectedMonth);
            },
            plugins: {
                legend: {
                    position: 'right',
                    labels: { font: { family: 'Outfit', size: 12 } },
                    onClick: (evt, legendItem) => {
                        const categoryName = legendItem.text;
                        if (categoryName && categoryName !== '無資料') showCategoryDetails(categoryName, selectedMonth);
                    }
                },
                tooltip: { 
                    callbacks: {
                        label: function(context) {
                            if (!pieLabels.length) return '無資料';
                            let label = context.label || '';
                            if (label) label += ': ';
                            const val = context.raw;
                            const percent = totalPieAmount > 0 ? ((val / totalPieAmount) * 100).toFixed(1) : 0;
                            label += `$ ${formatNumber(val)} (${percent}%) — 點擊查看明細`;
                            return label;
                        }
                    }
                },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 11, family: 'Outfit' },
                    formatter: (value, ctx) => {
                        if (!pieLabels.length || totalPieAmount === 0 || value === 0) return null;
                        const percentage = (value * 100 / totalPieAmount);
                        // Only show label if slice is >= 5%
                        return percentage >= 5 ? percentage.toFixed(0) + "%" : null;
                    },
                    textStrokeColor: 'rgba(0,0,0,0.2)',
                    textStrokeWidth: 2,
                    anchor: 'center',
                    align: 'center',
                    display: function(context) {
                        return typeof ChartDataLabels !== 'undefined';
                    }
                }
            }
        }
    });
    // Make the canvas cursor pointer to hint it's clickable
    pieCtx.canvas.style.cursor = 'pointer';
}

function showCategoryDetails(categoryName, monthStr) {
    const modal = document.getElementById('category-details-modal');
    if (!modal) return;

    // All expense transactions for this category & month
    const filtered = transactions.filter(
        t => t.type === 'expense' && !t.excludeFromStats && t.category === categoryName && t.date.startsWith(monthStr)
    );
    const total = filtered.reduce((s, t) => s + t.amount, 0);
    const [year, mon] = monthStr.split('-');

    // --- Build subcategory summary ---
    // Group: key = subcategory name or '' (no subcategory)
    const subMap = {};
    filtered.forEach(t => {
        const key = t.subcategory || '';
        if (!subMap[key]) subMap[key] = { total: 0, count: 0 };
        subMap[key].total += t.amount;
        subMap[key].count++;
    });

    // Sort: named subcategories first (by total desc), then '' last
    const subEntries = Object.entries(subMap).sort((a, b) => {
        if (a[0] === '' && b[0] !== '') return 1;
        if (a[0] !== '' && b[0] === '') return -1;
        return b[1].total - a[1].total;
    });

    // --- Update modal header (Level 1) ---
    document.getElementById('category-details-name').textContent = categoryName;
    document.getElementById('category-details-sub-name').textContent = ' — 消費明細';
    document.getElementById('category-details-total-label').textContent = '總支出';
    document.getElementById('category-details-total').textContent = `$ ${formatNumber(total)}`;
    document.getElementById('category-details-month-label').textContent = `${year} 年 ${parseInt(mon)} 月`;
    document.getElementById('category-details-count').textContent = `${filtered.length} 筆`;
    document.getElementById('category-details-back-btn').classList.add('hidden');

    // --- Render subcategory rows ---
    const listEl = document.getElementById('category-details-list');
    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="empty-state">此類別本月無消費紀錄</div>';
    } else if (subEntries.length === 1 && subEntries[0][0] === '') {
        // No subcategories at all — show transactions directly
        _renderTransactionList(listEl, filtered, categoryName, monthStr);
    } else {
        // Show subcategory breakdown
        listEl.innerHTML = subEntries.map(([subName, info]) => {
            const displayName = subName || '其他';
            const pct = total > 0 ? ((info.total / total) * 100).toFixed(1) : 0;
            return `
                <div class="cat-sub-row" onclick="showSubcategoryDetails('${categoryName}', '${subName}', '${monthStr}')">
                    <div class="cat-sub-row-left">
                        <div class="cat-sub-row-name">${displayName}</div>
                        <div class="cat-sub-row-bar-wrap">
                            <div class="cat-sub-row-bar" style="width:${pct}%"></div>
                        </div>
                    </div>
                    <div class="cat-sub-row-right">
                        <span class="cat-sub-row-amount">- $ ${formatNumber(info.total)}</span>
                        <span class="cat-sub-row-count">${info.count} 筆</span>
                        <i class="fas fa-chevron-right cat-sub-row-arrow"></i>
                    </div>
                </div>
            `;
        }).join('');
    }

    modal.classList.add('active');
}

window.showSubcategoryDetails = function(categoryName, subName, monthStr) {
    const filtered = transactions
        .filter(t => {
            if (t.type !== 'expense' || t.excludeFromStats) return false;
            if (t.category !== categoryName) return false;
            if (!t.date.startsWith(monthStr)) return false;
            const tSub = t.subcategory || '';
            return tSub === subName;
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);

    const total = filtered.reduce((s, t) => s + t.amount, 0);
    const displaySubName = subName || '其他';
    const [year, mon] = monthStr.split('-');

    // Update header to Level 2
    document.getElementById('category-details-name').textContent = categoryName;
    document.getElementById('category-details-sub-name').textContent = ` › ${displaySubName}`;
    document.getElementById('category-details-total-label').textContent = '小計';
    document.getElementById('category-details-total').textContent = `$ ${formatNumber(total)}`;
    document.getElementById('category-details-month-label').textContent = `${year} 年 ${parseInt(mon)} 月`;
    document.getElementById('category-details-count').textContent = `${filtered.length} 筆`;

    // Show back button
    const backBtn = document.getElementById('category-details-back-btn');
    backBtn.classList.remove('hidden');
    backBtn.onclick = () => showCategoryDetails(categoryName, monthStr);

    const listEl = document.getElementById('category-details-list');
    _renderTransactionList(listEl, filtered, categoryName, monthStr);
};

function _renderTransactionList(listEl, filtered, categoryName, monthStr) {
    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="empty-state">無相關消費紀錄</div>';
        return;
    }
    listEl.innerHTML = filtered.map(t => {
        const subLabel = t.subcategory
            ? `<span style="font-size:0.78rem; opacity:0.7;"> • ${t.subcategory}</span>`
            : '';
        return `
            <div class="transaction-item" style="cursor:pointer;"
                 onclick="editTransaction(${t.id}); document.getElementById('category-details-modal').classList.remove('active');">
                <div class="item-info">
                    <div class="item-icon"><i class="fas fa-receipt"></i></div>
                    <div class="item-details">
                        <h4>${t.description || '(無描述)'}</h4>
                        <p>${t.account}${subLabel}</p>
                        <span class="item-date">${t.date.replace('T', ' ')}</span>
                    </div>
                </div>
                <div class="item-amount expense">
                    <strong class="amount">- $${formatNumber(t.amount)}</strong>
                </div>
            </div>
        `;
    }).join('');
}

document.getElementById('widget-pie-month')?.addEventListener('change', renderPieChart);
document.getElementById('close-category-details-modal')?.addEventListener('click', () => {
    document.getElementById('category-details-modal').classList.remove('active');
});
document.getElementById('category-details-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
});

// Transaction search listeners
const transactionSearchInput = document.getElementById('transaction-search');
const transactionSearchClear = document.getElementById('transaction-search-clear');

if (transactionSearchInput) {
    transactionSearchInput.addEventListener('input', (e) => {
        renderTransactions();
        if (e.target.value.trim() !== '') {
            transactionSearchClear.classList.remove('hidden');
        } else {
            transactionSearchClear.classList.add('hidden');
        }
    });
}

if (transactionSearchClear) {
    transactionSearchClear.addEventListener('click', () => {
        if (transactionSearchInput) {
            transactionSearchInput.value = '';
            renderTransactions();
            transactionSearchClear.classList.add('hidden');
        }
    });
}

// Range toggle buttons
document.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRange = btn.dataset.range;
    initCharts();
}));

// --- Main Init ---
async function init() {
    await loadLedgerData();
    applyLayout();
    populateLedgerSwitch();
    updateMainTitle();
    updateSummary();
    renderTransactions();
    renderAccounts();
    renderBudgetWidget();
    populateAccountSelects();
    updateCategorySelect();
    initDraggable();
    initCharts();
    refreshNotesEditor(); // Sync notes editor with cloud-loaded data
}

// Update the notes editor content when ledger data is reloaded
function refreshNotesEditor() {
    const editor = document.getElementById('notes-editor');
    if (!editor) return;
    // Only overwrite if the global notes differs from what's displayed
    if (editor.innerHTML !== notes) {
        editor.innerHTML = notes || '';
        const charCount = document.getElementById('notes-char-count');
        if (charCount) {
            const count = (editor.innerText || '').replace(/\s/g, '').length;
            charCount.textContent = `${count} 字`;
        }
    }
}

function updateMainTitle() { const l = ledgers.find(l => l.id === currentLedgerId); mainTitle.innerText = l ? (l.title || l.name) : '我的財富管理'; }

// --- Event Listeners ---
function resetFormToAddMode() {
    editingTransactionId = null;
    form.reset();
    // Reset type to expense
    const expenseRadio = document.querySelector('input[name="type"][value="expense"]');
    if (expenseRadio) expenseRadio.checked = true;
    // Set today's date and time (local timezone)
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    dateInput.value = (new Date(now - tzOffset)).toISOString().slice(0, 16);
    // Reset title and button
    document.querySelector('#modal h3').innerText = '新增交易紀錄';
    const submitBtn = document.querySelector('#modal .btn-submit');
    if (submitBtn) submitBtn.innerText = '確認新增';
    // Reset conditional fields
    updateFormVisibility();
    updateCategorySelect();
}

addBtn.addEventListener('click', () => {
    resetFormToAddMode();
    modal.classList.add('active');
});
closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    resetFormToAddMode(); // Clean up state when dismissed
});

manageAccountsBtn.addEventListener('click', () => { renderAccountManager(); accountModal.classList.add('active'); });
closeAccountModal.addEventListener('click', () => accountModal.classList.remove('active'));
manageCategoriesBtn.addEventListener('click', () => { renderCategoryManager(); categoryModal.classList.add('active'); });
closeCategoryModal.addEventListener('click', () => categoryModal.classList.remove('active'));
manageLedgersBtn.addEventListener('click', () => { renderLedgerManager(); ledgerModal.classList.add('active'); });
closeLedgerModal.addEventListener('click', () => ledgerModal.classList.remove('active'));
privacyToggle.addEventListener('click', () => { privacyMode = !privacyMode; localStorage.setItem('privacyMode', privacyMode); updatePrivacyUI(); });
toggleViewBtn?.addEventListener('click', () => {
    document.body.classList.toggle('mobile-mode');
    const isMobile = document.body.classList.contains('mobile-mode');
    toggleViewBtn.innerHTML = isMobile ? '<i class="fas fa-desktop"></i> 電腦模式' : '<i class="fas fa-mobile-alt"></i> 手機模式';
});
syncSettingsBtn.addEventListener('click', () => { syncUrlInput.value = syncUrl; syncModal.classList.add('active'); });
syncForm.addEventListener('submit', (e) => { e.preventDefault(); syncUrl = syncUrlInput.value.trim(); localStorage.setItem('syncUrl', syncUrl); syncModal.classList.remove('active'); init(); });
let currentBudgetMonth = 'default';

function renderBudgetManagerList(monthKey) {
    const sourceObj = monthKey === 'default' ? budgets.default : (budgets.monthly[monthKey] || {});
    budgetManagerList.innerHTML = (categories.expense || []).map(cat => `
        <div class="form-group"><label>${cat.name}</label><input type="number" data-cat="${cat.name}" value="${sourceObj[cat.name] !== undefined ? sourceObj[cat.name] : (monthKey === 'default' ? 0 : '')}" placeholder="${monthKey === 'default' ? '0' : '預設: ' + (budgets.default[cat.name] || 0)}"></div>
    `).join('');
}

manageBudgetBtn.addEventListener('click', () => {
    const monthInput = document.getElementById('budget-month');
    monthInput.value = '';
    currentBudgetMonth = 'default';
    renderBudgetManagerList('default');
    budgetModal.classList.add('active');
});

document.getElementById('budget-month').addEventListener('change', (e) => {
    const val = e.target.value;
    currentBudgetMonth = val ? val : 'default';
    renderBudgetManagerList(currentBudgetMonth);
});

document.getElementById('budget-set-default-btn').addEventListener('click', () => {
    const monthInput = document.getElementById('budget-month');
    monthInput.value = '';
    currentBudgetMonth = 'default';
    renderBudgetManagerList('default');
});

saveBudgetBtn.addEventListener('click', () => {
    const monthKey = currentBudgetMonth;
    const targetObj = monthKey === 'default' ? budgets.default : (budgets.monthly[monthKey] = budgets.monthly[monthKey] || {});
    
    document.querySelectorAll('#budget-manager-list input').forEach(input => {
        const val = input.value;
        if (monthKey === 'default') {
            targetObj[input.dataset.cat] = +val;
        } else {
            if (val === '') {
                delete targetObj[input.dataset.cat];
            } else {
                targetObj[input.dataset.cat] = +val;
            }
        }
    });
    saveLedgerData(); renderBudgetWidget(); budgetModal.classList.remove('active');
});
closeBudgetModal.addEventListener('click', () => budgetModal.classList.remove('active'));
closeSyncModal.addEventListener('click', () => syncModal.classList.remove('active'));

function updateFormVisibility() {
    const typeRadio = document.querySelector('input[name="type"]:checked');
    const val = typeRadio ? typeRadio.value : 'expense';
    
    if (toAccountGroup) {
        if (val === 'transfer') {
            toAccountGroup.classList.remove('hidden');
        } else {
            toAccountGroup.classList.add('hidden');
        }
    }
    
    let isCreditCard = false;
    if (accountSelect && accountSelect.value) {
        const selectedAccount = accounts.find(a => a.name === accountSelect.value);
        if (selectedAccount && selectedAccount.type === '信用卡') {
            isCreditCard = true;
        }
    }
    
    if (installmentGroup) {
        if (val === 'expense' && isCreditCard) {
            installmentGroup.classList.remove('hidden');
        } else {
            installmentGroup.classList.add('hidden');
        }
    }
}

typeRadios.forEach(r => r.addEventListener('change', () => {
    updateFormVisibility();
    updateCategorySelect();
}));

accountSelect.addEventListener('change', updateFormVisibility);
categorySelect.addEventListener('change', updateSubcategorySelect);

let editingTransactionId = null;

window.editTransaction = function(id) {
    const t = transactions.find(item => item.id === id);
    if (!t) return;
    
    editingTransactionId = id;
    document.querySelector(`input[name="type"][value="${t.type}"]`).checked = true;
    let tDate = t.date;
    if (tDate && tDate.length === 10) tDate += "T00:00"; // Backward compatibility for old date-only strings
    document.getElementById('date').value = tDate;
    document.getElementById('amount').value = t.amount;
    accountSelect.value = t.account;
    if (t.type === 'transfer') {
        toAccountGroup.classList.remove('hidden');
        toAccountSelect.value = t.toAccount;
    } else {
        toAccountGroup.classList.add('hidden');
    }
    updateCategorySelect();
    categorySelect.value = t.category;
    updateSubcategorySelect();
    subcategorySelect.value = t.subcategory;
    document.getElementById('description').value = t.description;
    excludeStatsCheckbox.checked = t.excludeFromStats;
    
    if (t.installments) document.getElementById('installments').value = t.installments;
    if (t.interestRate) document.getElementById('interest-rate').value = t.interestRate;
    
    updateFormVisibility();
    
    document.querySelector('#modal h3').innerText = '編輯交易紀錄';
    document.querySelector('#modal .btn-submit').innerText = '儲存變更';
    modal.classList.add('active');
};

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="type"]:checked').value;
    const amount = +document.getElementById('amount').value;
    
    const selectedAccountName = accountSelect.value;
    const selectedAccount = accounts.find(a => a.name === selectedAccountName);
    const isCreditCard = selectedAccount && selectedAccount.type === '信用卡';
    
    const data = {
        type,
        date: document.getElementById('date').value,
        amount,
        account: selectedAccountName,
        toAccount: type === 'transfer' ? toAccountSelect.value : null,
        category: categorySelect.value,
        subcategory: subcategorySelect.value,
        description: document.getElementById('description').value,
        excludeFromStats: excludeStatsCheckbox.checked,
        installments: (type === 'expense' && isCreditCard) ? +document.getElementById('installments').value : null,
        interestRate: (type === 'expense' && isCreditCard) ? +document.getElementById('interest-rate').value : null
    };

    if (editingTransactionId) {
        const idx = transactions.findIndex(t => t.id === editingTransactionId);
        transactions[idx] = { ...transactions[idx], ...data };
        editingTransactionId = null;
    } else {
        transactions.push({ id: Date.now(), ...data });
    }
    
    saveLedgerData(); 
    init(); 
    modal.classList.remove('active'); 
    form.reset();
    updateFormVisibility();
    document.querySelector('#modal h3').innerText = '新增收支紀錄';
    document.querySelector('#modal .btn-submit').innerText = '確認新增';
});

ledgerSwitch.addEventListener('change', (e) => { currentLedgerId = e.target.value; localStorage.setItem('currentLedgerId', currentLedgerId); init(); });

addAccountForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-account-id').value;
    const name = document.getElementById('new-account-name').value;
    const type = document.getElementById('new-account-type').value;
    const balance = +document.getElementById('new-account-balance').value;
    const include = document.getElementById('new-account-networth').checked;
    
    if (id) {
        const idx = accounts.findIndex(a => a.id == id);
        accounts[idx] = { ...accounts[idx], name, type, initialBalance: balance, includeInNetWorth: include };
    } else {
        accounts.push({ id: Date.now(), name, type, initialBalance: balance, includeInNetWorth: include });
    }
    saveLedgerData(); renderAccounts(); renderAccountManager(); addAccountForm.reset();
    document.getElementById('edit-account-id').value = '';
    document.getElementById('account-form-title').innerText = '新增帳戶';
    document.getElementById('account-submit-btn').innerText = '確認帳戶';
    document.getElementById('cancel-account-edit').classList.add('hidden');
});

document.getElementById('cancel-account-edit')?.addEventListener('click', () => {
    addAccountForm.reset();
    document.getElementById('edit-account-id').value = '';
    document.getElementById('account-form-title').innerText = '新增帳戶';
    document.getElementById('account-submit-btn').innerText = '確認帳戶';
    document.getElementById('cancel-account-edit').classList.add('hidden');
});

addCategoryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    const name = document.getElementById('new-category-name').value;
    categories[activeTab].push({ name, sub: [] });
    saveLedgerData(); renderCategoryManager(); addCategoryForm.reset(); updateCategorySelect();
});

addSubcategoryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    const idx = addSubcategoryForm.dataset.idx;
    const name = document.getElementById('new-subcategory-name').value;
    categories[activeTab][idx].sub.push(name);
    saveLedgerData(); renderCategoryManager(); addSubcategoryForm.reset(); addSubcategoryForm.classList.add('hidden'); updateCategorySelect();
});

addLedgerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-ledger-id').value;
    const name = document.getElementById('new-ledger-name').value;
    const title = document.getElementById('new-ledger-title').value;
    
    if (id) {
        const idx = ledgers.findIndex(l => l.id === id);
        if (idx !== -1) ledgers[idx] = { ...ledgers[idx], name, title };
    } else {
        const newId = 'ledger_' + Date.now();
        ledgers.push({ id: newId, name, title });
    }
    
    localStorage.setItem('ledgers', JSON.stringify(ledgers));
    addLedgerForm.reset(); 
    document.getElementById('edit-ledger-id').value = '';
    document.getElementById('ledger-form-title').innerText = '建立新帳本';
    document.getElementById('ledger-submit-btn').innerText = '新增帳本';
    document.getElementById('cancel-ledger-edit').classList.add('hidden');
    renderLedgerManager(); 
    populateLedgerSwitch();
    updateMainTitle();
});

document.getElementById('cancel-ledger-edit')?.addEventListener('click', () => {
    addLedgerForm.reset();
    document.getElementById('edit-ledger-id').value = '';
    document.getElementById('ledger-form-title').innerText = '建立新帳本';
    document.getElementById('ledger-submit-btn').innerText = '新增帳本';
    document.getElementById('cancel-ledger-edit').classList.add('hidden');
});


// Annual Report Logic
annualReportBtn.addEventListener('click', () => {
    const years = [...new Set(transactions.map(t => new Date(t.date).getFullYear()))].sort((a, b) => b - a);
    if (years.length === 0) years.push(new Date().getFullYear());
    reportYearSelect.innerHTML = years.map(y => `<option value="${y}">${y} 年</option>`).join('');
    generateAnnualReport(reportYearSelect.value);
    reportModal.classList.add('active');
});

function generateAnnualReport(year) {
    year = parseInt(year);
    const months = [1,2,3,4,5,6,7,8,9,10,11,12];
    const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

    const yearT = transactions.filter(t => t.date && !t.excludeFromStats && parseInt(t.date.substring(0,4)) === year);

    function fmtDiff(diff) {
        if (diff === 0) return `<span class="zero-val">0</span>`;
        if (diff < 0) return `<span class="over-budget">(${formatNumber(Math.abs(diff))})</span>`;
        return `<span class="under-budget">${formatNumber(diff)}</span>`;
    }
    function fmtAmt(n) { return n > 0 ? formatNumber(n) : `<span class="zero-val">0</span>`; }

    const allExpCats = categories.expense || [];
    const expData = {};
    allExpCats.forEach(cat => {
        expData[cat.name] = { _total: {} };
        months.forEach(m => expData[cat.name]._total[m] = 0);
        (cat.sub || []).forEach(sub => { expData[cat.name][sub] = {}; months.forEach(m => expData[cat.name][sub][m] = 0); });
    });
    yearT.filter(t => t.type === 'expense').forEach(t => {
        const m = parseInt(t.date.substring(5,7));
        const cat = t.category || '其他'; const sub = t.subcategory || '';
        if (!expData[cat]) { expData[cat] = { _total: {} }; months.forEach(m => expData[cat]._total[m] = 0); }
        if (sub && !expData[cat][sub]) { expData[cat][sub] = {}; months.forEach(m => expData[cat][sub][m] = 0); }
        expData[cat]._total[m] = (expData[cat]._total[m] || 0) + t.amount;
        if (sub) expData[cat][sub][m] = (expData[cat][sub][m] || 0) + t.amount;
    });

    const allIncCats = categories.income || [];
    const incData = {};
    allIncCats.forEach(cat => {
        incData[cat.name] = { _total: {} };
        months.forEach(m => incData[cat.name]._total[m] = 0);
        (cat.sub || []).forEach(sub => { incData[cat.name][sub] = {}; months.forEach(m => incData[cat.name][sub][m] = 0); });
    });
    yearT.filter(t => t.type === 'income').forEach(t => {
        const m = parseInt(t.date.substring(5,7));
        const cat = t.category || '其他'; const sub = t.subcategory || '';
        if (!incData[cat]) { incData[cat] = { _total: {} }; months.forEach(m => incData[cat]._total[m] = 0); }
        if (sub && !incData[cat][sub]) { incData[cat][sub] = {}; months.forEach(m => incData[cat][sub][m] = 0); }
        incData[cat]._total[m] = (incData[cat]._total[m] || 0) + t.amount;
        if (sub) incData[cat][sub][m] = (incData[cat][sub][m] || 0) + t.amount;
    });

    const grandExpM = {}; months.forEach(m => grandExpM[m] = 0);
    const grandIncM = {}; months.forEach(m => grandIncM[m] = 0);
    Object.values(expData).forEach(d => months.forEach(m => grandExpM[m] += d._total[m] || 0));
    Object.values(incData).forEach(d => months.forEach(m => grandIncM[m] += d._total[m] || 0));

    const getBudgetForMonth = (year, m, catName) => {
        const monthKey = `${year}-${String(m).padStart(2, '0')}`;
        const monthlyOverride = budgets.monthly[monthKey] || {};
        return +(monthlyOverride[catName] !== undefined ? monthlyOverride[catName] : (budgets.default[catName] || 0));
    };

    const grandBgtM = {};
    months.forEach(m => grandBgtM[m] = allExpCats.reduce((s, cat) => s + getBudgetForMonth(year, m, cat.name), 0));
    const yearBudgetTotalAll = months.reduce((s, m) => s + grandBgtM[m], 0);

    let html = `<div class="report-table-wrapper"><table class="report-table budget-report">
    <thead>
        <tr class="month-header-row">
            <th class="item-col" rowspan="2">細項</th>
            ${months.map(m => `<th colspan="3" class="month-group-header">${monthNames[m-1]}</th>`).join('')}
            <th colspan="3" class="month-group-header year-total-header">年度合計</th>
        </tr>
        <tr class="sub-header-row">
            ${months.map(() => `<th class="bgt-col">預算</th><th class="act-col">實花</th><th class="dif-col">差額</th>`).join('')}
            <th class="bgt-col">年度預算</th><th class="act-col">年度實花</th><th class="dif-col">年度差額</th>
        </tr>
    </thead>
    <tbody>`;

    html += `<tr class="section-divider"><td colspan="40">▼ 支出項目</td></tr>`;

    let yearActualTotal = 0;
    Object.entries(expData).forEach(([catName, catData]) => {
        const subs = Object.keys(catData).filter(k => k !== '_total' && Object.values(catData[k]).some(v => v > 0));
        const catYearActual = months.reduce((s, m) => s + (catData._total[m] || 0), 0);
        const catYearBudget = months.reduce((s, m) => s + getBudgetForMonth(year, m, catName), 0);
        yearActualTotal += catYearActual;

        html += `<tr class="cat-total-row">
            <td class="item-name cat-label">${catName}</td>
            ${months.map(m => {
                const act = catData._total[m] || 0;
                const bgt = getBudgetForMonth(year, m, catName);
                return `<td class="bgt-val">${bgt > 0 ? formatNumber(bgt) : '<span class="zero-val">0</span>'}</td><td class="act-val">${fmtAmt(act)}</td><td class="dif-val">${fmtDiff(bgt - act)}</td>`;
            }).join('')}
            <td class="bgt-val year-col">${catYearBudget > 0 ? formatNumber(catYearBudget) : '<span class="zero-val">0</span>'}</td>
            <td class="act-val year-col">${fmtAmt(catYearActual)}</td>
            <td class="dif-val year-col">${fmtDiff(catYearBudget - catYearActual)}</td>
        </tr>`;

        subs.forEach(sub => {
            const subYearAct = months.reduce((s, m) => s + (catData[sub][m] || 0), 0);
            html += `<tr class="sub-detail-row">
                <td class="item-name sub-label">${sub}</td>
                ${months.map(m => `<td class="bgt-val"></td><td class="act-val">${fmtAmt(catData[sub][m] || 0)}</td><td class="dif-val"></td>`).join('')}
                <td class="bgt-val year-col"></td><td class="act-val year-col">${fmtAmt(subYearAct)}</td><td class="dif-val year-col"></td>
            </tr>`;
        });
    });

    html += `<tr class="grand-total-row">
        <td class="item-name">花費總額</td>
        ${months.map(m => `<td class="bgt-val">${formatNumber(grandBgtM[m])}</td><td class="act-val">${fmtAmt(grandExpM[m])}</td><td class="dif-val">${fmtDiff(grandBgtM[m] - grandExpM[m])}</td>`).join('')}
        <td class="bgt-val year-col">${formatNumber(yearBudgetTotalAll)}</td>
        <td class="act-val year-col">${fmtAmt(yearActualTotal)}</td>
        <td class="dif-val year-col">${fmtDiff(yearBudgetTotalAll - yearActualTotal)}</td>
    </tr>`;

    html += `<tr class="balance-row">
        <td class="item-name">Balance</td>
        ${months.map(m => { const bal = grandIncM[m] - grandExpM[m]; return `<td class="bgt-val"></td><td class="act-val">${fmtAmt(Math.abs(bal))}</td><td class="dif-val">${fmtDiff(bal)}</td>`; }).join('')}
        <td class="bgt-val year-col"></td>
        <td class="act-val year-col">${fmtAmt(Math.abs(months.reduce((s,m) => s + grandIncM[m] - grandExpM[m], 0)))}</td>
        <td class="dif-val year-col">${fmtDiff(months.reduce((s,m) => s + grandIncM[m] - grandExpM[m], 0))}</td>
    </tr>`;

    html += `<tr class="section-divider income-section"><td colspan="40">▼ 收入項目</td></tr>`;

    Object.entries(incData).forEach(([catName, catData]) => {
        const subs = Object.keys(catData).filter(k => k !== '_total' && Object.values(catData[k]).some(v => v > 0));
        const catYearAct = months.reduce((s, m) => s + (catData._total[m] || 0), 0);
        html += `<tr class="cat-total-row income-cat">
            <td class="item-name cat-label">${catName}</td>
            ${months.map(m => `<td class="bgt-val"></td><td class="act-val income-val">${fmtAmt(catData._total[m] || 0)}</td><td class="dif-val"></td>`).join('')}
            <td class="bgt-val year-col"></td><td class="act-val year-col income-val">${fmtAmt(catYearAct)}</td><td class="dif-val year-col"></td>
        </tr>`;
        subs.forEach(sub => {
            const subYearAct = months.reduce((s, m) => s + (catData[sub][m] || 0), 0);
            html += `<tr class="sub-detail-row">
                <td class="item-name sub-label">${sub}</td>
                ${months.map(m => `<td class="bgt-val"></td><td class="act-val income-val">${fmtAmt(catData[sub][m] || 0)}</td><td class="dif-val"></td>`).join('')}
                <td class="bgt-val year-col"></td><td class="act-val year-col income-val">${fmtAmt(subYearAct)}</td><td class="dif-val year-col"></td>
            </tr>`;
        });
    });

    const incYearTotal = months.reduce((s,m) => s + grandIncM[m], 0);
    html += `<tr class="grand-total-row income-grand">
        <td class="item-name">總收入</td>
        ${months.map(m => `<td class="bgt-val"></td><td class="act-val income-val">${fmtAmt(grandIncM[m])}</td><td class="dif-val"></td>`).join('')}
        <td class="bgt-val year-col"></td><td class="act-val year-col income-val">${fmtAmt(incYearTotal)}</td><td class="dif-val year-col"></td>
    </tr>`;

    html += `</tbody></table></div>`;
    reportTable.innerHTML = html;
}

closeReportModal.addEventListener('click', () => reportModal.classList.remove('active'));

if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        if (transactions.length === 0) {
            alert('目前沒有交易紀錄可以匯出！');
            return;
        }

        // Prepare CSV header
        const headers = ['日期', '類型', '主類別', '子類別', '帳戶', '項目說明', '金額'];
        const csvRows = [];
        csvRows.push(headers.join(','));

        // Prepare CSV rows
        const typeMap = { 'income': '收入', 'expense': '支出', 'transfer': '轉帳' };
        
        // Sort transactions by date (newest first)
        const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);

        sortedTransactions.forEach(t => {
            const row = [
                t.date.split('T')[0], 
                typeMap[t.type] || t.type,
                `"${t.category || ''}"`,
                `"${t.subcategory || ''}"`,
                `"${(t.type === 'transfer' && t.toAccount) ? (t.account + ' -> ' + t.toAccount) : (t.account || '')}"`,
                `"${(t.description || '').replace(/"/g, '""')}"`, 
                t.amount
            ];
            csvRows.push(row.join(','));
        });

        // Add BOM for Excel UTF-8 compatibility
        const csvContent = '\uFEFF' + csvRows.join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        a.download = `transactions_${dateStr}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

backupBtn.addEventListener('click', () => {
    const data = {}; for(let i=0; i<localStorage.length; i++) data[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
    const blob = new Blob([JSON.stringify(data)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'backup.json'; a.click();
});
restoreBtn.addEventListener('click', () => restoreInput.click());
restoreInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const data = JSON.parse(ev.target.result);
        if(confirm('恢復備份將覆蓋現有資料？')) {
            localStorage.clear(); for(const k in data) localStorage.setItem(k, data[k]);
            location.reload();
        }
    };
    reader.readAsText(file);
});

window.removeTransaction = (id) => { transactions = transactions.filter(t => t.id !== id); saveLedgerData(); init(); };

// ===== Calculator Logic =====
(function initCalculator() {
    const calcPanel = document.getElementById('calc-panel');
    const calcToggleBtn = document.getElementById('calc-toggle-btn');
    const calcExpr = document.getElementById('calc-expr');
    const calcResult = document.getElementById('calc-result');
    const amountInput = document.getElementById('amount');
    if (!calcPanel || !calcToggleBtn || !amountInput) return;

    let expr = '';
    let justEvaled = false;

    function updateDisplay() {
        calcExpr.textContent = expr;
        if (!expr) { calcResult.textContent = '0'; return; }
        try {
            // Safe eval: only allow numbers and operators
            const safeExpr = expr.replace(/[^0-9+\-*/().%]/g, '');
            const val = Function('"use strict"; return (' + safeExpr + ')')();
            if (isFinite(val)) {
                calcResult.textContent = parseFloat(val.toFixed(6)).toString();
            } else {
                calcResult.textContent = '錯誤';
            }
        } catch (e) {
            calcResult.textContent = expr.length > 0 ? '...' : '0';
        }
    }

    function applyToAmount() {
        const raw = calcResult.textContent;
        const val = parseFloat(raw);
        if (!isNaN(val) && raw !== '錯誤') {
            amountInput.value = Math.round(val * 100) / 100;
            amountInput.dispatchEvent(new Event('input'));
        }
    }

    calcToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = !calcPanel.classList.contains('hidden');
        calcPanel.classList.toggle('hidden');
        calcToggleBtn.classList.toggle('active', !isOpen);
        if (!isOpen) {
            // Sync current amount into calc
            const cur = parseFloat(amountInput.value);
            if (!isNaN(cur) && cur > 0) {
                expr = cur.toString();
                justEvaled = false;
                updateDisplay();
            }
        }
    });

    calcPanel.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-val],[data-action]');
        if (!btn) return;
        e.preventDefault();

        const val = btn.dataset.val;
        const action = btn.dataset.action;

        if (action === 'clear') {
            expr = ''; justEvaled = false;
        } else if (action === 'del') {
            if (justEvaled) { expr = ''; justEvaled = false; }
            else expr = expr.slice(0, -1);
        } else if (action === 'pct') {
            // Append /100 wrapping
            try {
                const safeExpr = expr.replace(/[^0-9+\-*/().%]/g, '');
                const val2 = Function('"use strict"; return (' + safeExpr + ')')();
                if (isFinite(val2)) { expr = (val2 / 100).toString(); }
            } catch(e) {}
            justEvaled = true;
        } else if (action === 'eq') {
            // Evaluate
            try {
                const safeExpr = expr.replace(/[^0-9+\-*/().%]/g, '');
                const res = Function('"use strict"; return (' + safeExpr + ')')();
                if (isFinite(res)) {
                    const rounded = parseFloat(res.toFixed(6));
                    expr = rounded.toString();
                    justEvaled = true;
                    updateDisplay();
                    applyToAmount();
                    // Auto close after a short delay
                    setTimeout(() => {
                        calcPanel.classList.add('hidden');
                        calcToggleBtn.classList.remove('active');
                    }, 600);
                    return;
                }
            } catch(e) {}
        } else if (val !== undefined) {
            const ops = ['+', '-', '*', '/'];
            if (justEvaled && !ops.includes(val)) {
                expr = ''; // start fresh number after eval
            }
            justEvaled = false;
            // Prevent double operator
            if (ops.includes(val) && expr && ops.includes(expr.slice(-1))) {
                expr = expr.slice(0, -1);
            }
            // Prevent multiple decimal points in the current number
            if (val === '.') {
                const parts = expr.split(/[+\-*/]/);
                if (parts[parts.length-1].includes('.')) return;
            }
            expr += val;
        }
        updateDisplay();
        // Live sync to amount input
        const cur = parseFloat(calcResult.textContent);
        if (!isNaN(cur) && calcResult.textContent !== '錯誤' && calcResult.textContent !== '...') {
            amountInput.value = Math.round(cur * 100) / 100;
        }
    });

    // Close calc when modal closes
    document.getElementById('close-modal')?.addEventListener('click', () => {
        calcPanel.classList.add('hidden');
        calcToggleBtn.classList.remove('active');
        expr = ''; justEvaled = false;
        updateDisplay();
    });

    // ---- Keyboard input support ----
    document.addEventListener('keydown', (e) => {
        // Only handle keyboard input when calc panel is visible
        if (calcPanel.classList.contains('hidden')) return;
        // Don't intercept if user is typing in another input/textarea
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        const ops = ['+', '-', '*', '/'];
        let handled = true;

        if (e.key >= '0' && e.key <= '9') {
            if (justEvaled && !ops.includes(e.key)) { expr = ''; }
            justEvaled = false;
            expr += e.key;
        } else if (e.key === '.') {
            const parts = expr.split(/[+\-*/]/);
            if (!parts[parts.length - 1].includes('.')) {
                if (justEvaled) { expr = '0'; justEvaled = false; }
                expr += '.';
            }
        } else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
            justEvaled = false;
            if (expr && ops.includes(expr.slice(-1))) {
                expr = expr.slice(0, -1);
            }
            expr += e.key;
        } else if (e.key === 'Enter' || e.key === '=') {
            // Trigger equals
            try {
                const safeExpr = expr.replace(/[^0-9+\-*/().%]/g, '');
                const res = Function('"use strict"; return (' + safeExpr + ')')();
                if (isFinite(res)) {
                    const rounded = parseFloat(res.toFixed(6));
                    expr = rounded.toString();
                    justEvaled = true;
                    updateDisplay();
                    applyToAmount();
                    setTimeout(() => {
                        calcPanel.classList.add('hidden');
                        calcToggleBtn.classList.remove('active');
                    }, 600);
                    return;
                }
            } catch(err) {}
        } else if (e.key === 'Backspace') {
            if (justEvaled) { expr = ''; justEvaled = false; }
            else expr = expr.slice(0, -1);
        } else if (e.key === 'Escape') {
            calcPanel.classList.add('hidden');
            calcToggleBtn.classList.remove('active');
            return;
        } else if (e.key === '%') {
            try {
                const safeExpr = expr.replace(/[^0-9+\-*/().%]/g, '');
                const val2 = Function('"use strict"; return (' + safeExpr + ')')();
                if (isFinite(val2)) { expr = (val2 / 100).toString(); }
            } catch(err) {}
            justEvaled = true;
        } else {
            handled = false;
        }

        if (handled) {
            e.preventDefault();
            updateDisplay();
            const cur = parseFloat(calcResult.textContent);
            if (!isNaN(cur) && calcResult.textContent !== '錯誤' && calcResult.textContent !== '...') {
                amountInput.value = Math.round(cur * 100) / 100;
            }
        }
    });
})();

// ===== Account Details: current account name for filter =====
let _currentAccountDetailsName = '';

function renderAccountDetailsList(accountName, monthFilter) {
    const list = accountDetailsList;
    list.innerHTML = '';
    let accountTransactions = transactions.filter(t => t.account === accountName || t.toAccount === accountName);
    if (monthFilter) {
        accountTransactions = accountTransactions.filter(t => t.date.startsWith(monthFilter));
    }
    if (accountTransactions.length === 0) {
        list.innerHTML = '<div class="empty-state">尚無交易紀錄</div>';
        return;
    }
    accountTransactions.sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id).forEach(t => {
        const item = document.createElement('div');
        item.className = `transaction-item account-detail-item ${t.excludeFromStats ? 'excluded' : ''}`;

        let sign = '', amountClass = t.type;
        let displayAmount = t.amount;

        if (t.type === 'transfer') {
            if (t.account === accountName && t.toAccount === accountName) {
                sign = '⇌';
            } else if (t.toAccount === accountName) {
                sign = '+'; amountClass = 'income';
            } else {
                sign = '-'; amountClass = 'expense';
            }
        } else if (t.type === 'income') {
            sign = '+';
        } else if (t.type === 'expense') {
            sign = '-';
        }

        item.innerHTML = `
            <div class="item-info">
                <div class="item-icon"><i class="fas fa-receipt"></i></div>
                <div class="item-details"><h4>${t.description || t.category}</h4><p>${t.type === 'transfer' ? '轉帳' : t.category}${t.subcategory ? ' • ' + t.subcategory : ''} • ${t.account}</p><span class="item-date">${t.date.replace('T', ' ')}</span></div>
            </div>
            <div class="item-amount ${amountClass}" style="gap: 0.5rem;">
                <strong class="amount">${sign} $${formatNumber(displayAmount)}</strong>
                <div class="detail-actions">
                    <button class="btn-edit-small" title="編輯" onclick="event.stopPropagation(); accountDetailsModal.classList.remove('active'); editTransaction(${t.id});"><i class="fas fa-edit"></i></button>
                    <button class="btn-edit-small" title="刪除" style="color:#e11d48;" onclick="event.stopPropagation(); removeTransactionFromDetails(${t.id}, '${accountName}');"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
        list.appendChild(item);
    });
}

window.removeTransactionFromDetails = function(id, accountName) {
    if (confirm('確定要刪除此筆交易？')) {
        transactions = transactions.filter(t => t.id !== id);
        saveLedgerData();
        init();
        // re-render details
        const monthFilter = document.getElementById('account-details-month')?.value || '';
        renderAccountDetailsList(accountName, monthFilter);
        // update balance display
        const balance = calculateAccountBalance(accountName);
        accountDetailsBalance.innerText = `$ ${formatNumber(balance)}`;
        accountDetailsBalance.className = `amount ${balance < 0 ? 'neg-bal' : 'pos-bal'}`;
    }
};

function showAccountDetails(accountName) {
    _currentAccountDetailsName = accountName;
    accountDetailsName.innerText = accountName;
    const balance = calculateAccountBalance(accountName);
    accountDetailsBalance.innerText = `$ ${formatNumber(balance)}`;
    accountDetailsBalance.className = `amount ${balance < 0 ? 'neg-bal' : 'pos-bal'}`;

    // Reset month filter
    const monthInput = document.getElementById('account-details-month');
    if (monthInput) monthInput.value = '';

    renderAccountDetailsList(accountName, '');
    accountDetailsModal.classList.add('active');
}

// Month filter listener for account details
document.getElementById('account-details-month')?.addEventListener('change', (e) => {
    renderAccountDetailsList(_currentAccountDetailsName, e.target.value);
});
document.getElementById('account-details-clear-month')?.addEventListener('click', () => {
    const monthInput = document.getElementById('account-details-month');
    if (monthInput) monthInput.value = '';
    renderAccountDetailsList(_currentAccountDetailsName, '');
});

if (closeAccountDetailsModal) {
    closeAccountDetailsModal.addEventListener('click', () => accountDetailsModal.classList.remove('active'));
}

// Tabs in Category Manager
document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); renderCategoryManager();
}));

init();

// ============================================================
// 📌 BULLETIN BOARD NOTES WIDGET
// ============================================================
(function initNotesWidget() {
    const editor = document.getElementById('notes-editor');
    const charCount = document.getElementById('notes-char-count');
    const saveStatus = document.getElementById('notes-save-status');
    const toolbar = document.getElementById('notes-toolbar');
    const tableModal = document.getElementById('notes-table-modal');
    const tableGrid = document.getElementById('notes-table-grid');
    const tableSizeLabel = document.getElementById('notes-table-size-label');
    const tableRowsInput = document.getElementById('notes-table-rows');
    const tableColsInput = document.getElementById('notes-table-cols');
    const tableInsertBtn = document.getElementById('notes-table-insert-btn');
    const closeTableModal = document.getElementById('close-notes-table-modal');
    const insertTableBtn = document.getElementById('notes-insert-table-btn');
    const insertHrBtn = document.getElementById('notes-insert-hr-btn');
    const clearBtn = document.getElementById('notes-clear-btn');

    const collapseBtn = document.getElementById('notes-collapse-btn');
    const widget = document.getElementById('widget-notes');
    const titleRow = widget?.querySelector('.notes-title-row');

    if (!editor) return;

    const STORAGE_KEY = `notes_${currentLedgerId}`;
    const COLLAPSE_KEY = `notes_collapsed_${currentLedgerId}`;

    // ---- Collapse / Expand ----
    function setCollapsed(collapsed) {
        widget.classList.toggle('notes-collapsed', collapsed);
        localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    }

    function toggleCollapse() {
        const isNowCollapsed = !widget.classList.contains('notes-collapsed');
        setCollapsed(isNowCollapsed);
    }

    // Restore collapsed state
    if (localStorage.getItem(COLLAPSE_KEY) === '1') {
        widget.classList.add('notes-collapsed');
    }

    // Click on title row or button to toggle
    if (titleRow) {
        titleRow.addEventListener('click', (e) => {
            // Avoid triggering when clicking inside a child button that does something else
            toggleCollapse();
        });
    }
    // Prevent button double-trigger (it's inside titleRow)
    if (collapseBtn) {
        collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCollapse();
        });
    }


    // ---- Load saved content (from ledger data, synced via cloud) ----
    function loadNotes() {
        // 'notes' is the global variable loaded by loadLedgerData()
        // Also fall back to old standalone localStorage key for one-time migration
        const legacyKey = `notes_${currentLedgerId}`;
        const legacyContent = localStorage.getItem(legacyKey);
        if (notes) {
            editor.innerHTML = notes;
        } else if (legacyContent) {
            // Migrate: move old key into ledger data for cloud sync
            editor.innerHTML = legacyContent;
            notes = legacyContent;
            saveLedgerData();
            localStorage.removeItem(legacyKey);
        }
        updateCharCount();
    }

    // ---- Auto-save with debounce (via saveLedgerData → cloud push) ----
    let saveTimer = null;
    function scheduleAutoSave() {
        if (saveStatus) {
            saveStatus.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 儲存中...';
            saveStatus.classList.add('saving');
        }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            notes = editor.innerHTML; // update global variable
            saveLedgerData();         // save + push to cloud
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fas fa-check-circle"></i> 已自動儲存';
                saveStatus.classList.remove('saving');
            }
        }, 800);
    }

    // ---- Char count ----
    function updateCharCount() {
        const text = editor.innerText || '';
        const count = text.replace(/\s/g, '').length;
        if (charCount) charCount.textContent = `${count} 字`;
    }

    // ---- Editor events ----
    editor.addEventListener('input', () => {
        updateCharCount();
        scheduleAutoSave();
        updateToolbarState();
    });

    editor.addEventListener('keyup', updateToolbarState);
    editor.addEventListener('mouseup', updateToolbarState);

    // Prevent losing contenteditable on paste — paste as plain text
    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/html')
            || (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertHTML', false, text);
    });

    // ---- Toolbar: formatting commands ----
    if (toolbar) {
        toolbar.addEventListener('mousedown', (e) => {
            const btn = e.target.closest('[data-cmd]');
            if (btn) {
                e.preventDefault();
                document.execCommand(btn.dataset.cmd, false, null);
                editor.focus();
                updateToolbarState();
                scheduleAutoSave();
            }

            // Color buttons
            const colorBtn = e.target.closest('.notes-color-btn');
            if (colorBtn) {
                e.preventDefault();
                const color = colorBtn.dataset.color;
                if (color) {
                    document.execCommand('foreColor', false, color);
                } else {
                    document.execCommand('removeFormat', false, null);
                }
                editor.focus();
                scheduleAutoSave();
            }
        });
    }

    // ---- Active state for toolbar buttons ----
    function updateToolbarState() {
        const cmds = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'];
        cmds.forEach(cmd => {
            const btn = toolbar?.querySelector(`[data-cmd="${cmd}"]`);
            if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
        });
    }

    // ---- Insert HR ----
    if (insertHrBtn) {
        insertHrBtn.addEventListener('click', () => {
            editor.focus();
            document.execCommand('insertHTML', false, '<hr>');
            scheduleAutoSave();
        });
    }

    // ---- Clear ----
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('確定要清除所有筆記內容嗎？')) {
                editor.innerHTML = '';
                scheduleAutoSave();
                updateCharCount();
            }
        });
    }

    // ---- Insert Table Modal ----
    let savedRange = null;

    function saveSelection() {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            savedRange = sel.getRangeAt(0).cloneRange();
        }
    }

    function restoreSelection() {
        if (savedRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
        }
    }

    if (insertTableBtn) {
        insertTableBtn.addEventListener('click', () => {
            saveSelection();
            tableModal.classList.add('active');
        });
    }

    if (closeTableModal) {
        closeTableModal.addEventListener('click', () => tableModal.classList.remove('active'));
    }

    tableModal?.addEventListener('click', (e) => {
        if (e.target === tableModal) tableModal.classList.remove('active');
    });

    // ---- Grid Picker (8×8) ----
    if (tableGrid) {
        const GRID_ROWS = 8, GRID_COLS = 8;
        let hoveredRow = 0, hoveredCol = 0;

        // Build grid cells
        for (let r = 1; r <= GRID_ROWS; r++) {
            for (let c = 1; c <= GRID_COLS; c++) {
                const cell = document.createElement('div');
                cell.className = 'notes-grid-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;

                cell.addEventListener('mouseenter', () => {
                    hoveredRow = r; hoveredCol = c;
                    // Highlight all cells in range
                    tableGrid.querySelectorAll('.notes-grid-cell').forEach(el => {
                        el.classList.toggle('highlighted',
                            +el.dataset.row <= r && +el.dataset.col <= c);
                    });
                    if (tableSizeLabel) tableSizeLabel.textContent = `${r} 行 × ${c} 欄`;
                    if (tableRowsInput) tableRowsInput.value = r;
                    if (tableColsInput) tableColsInput.value = c;
                });

                cell.addEventListener('click', () => {
                    insertTable(r, c);
                    tableModal.classList.remove('active');
                });

                tableGrid.appendChild(cell);
            }
        }

        tableGrid.addEventListener('mouseleave', () => {
            tableGrid.querySelectorAll('.notes-grid-cell').forEach(el => el.classList.remove('highlighted'));
            if (tableSizeLabel) tableSizeLabel.textContent = '選擇表格大小';
        });
    }

    // ---- Manual input insert ----
    if (tableInsertBtn) {
        tableInsertBtn.addEventListener('click', () => {
            const r = Math.max(1, Math.min(20, +tableRowsInput.value || 3));
            const c = Math.max(1, Math.min(10, +tableColsInput.value || 3));
            insertTable(r, c);
            tableModal.classList.remove('active');
        });
    }

    // ---- Build & Insert Table HTML ----
    function insertTable(rows, cols) {
        restoreSelection();
        editor.focus();

        let html = '<table><thead><tr>';
        for (let c = 0; c < cols; c++) {
            html += `<th contenteditable="true">欄位 ${c + 1}</th>`;
        }
        html += '</tr></thead><tbody>';
        for (let r = 0; r < rows; r++) {
            html += '<tr>';
            for (let c = 0; c < cols; c++) {
                html += '<td contenteditable="true"></td>';
            }
            html += '</tr>';
        }
        html += '</tbody></table><p><br></p>';

        document.execCommand('insertHTML', false, html);
        scheduleAutoSave();
    }

    // ---- Tab key in table cells ----
    editor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            const sel = window.getSelection();
            const cell = sel.anchorNode?.closest?.('td, th');
            if (cell) {
                e.preventDefault();
                const allCells = Array.from(editor.querySelectorAll('td, th'));
                const idx = allCells.indexOf(cell);
                const next = allCells[idx + 1];
                if (next) {
                    next.focus();
                    // Move cursor to end of next cell
                    const range = document.createRange();
                    range.selectNodeContents(next);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        }
    });

    // ---- Init ----
    loadNotes();
})();

// Disable mouse wheel scroll on number inputs globally to prevent accidental value changes
document.addEventListener('wheel', function(e) {
    if (document.activeElement && document.activeElement.type === 'number') {
        document.activeElement.blur();
    }
});
