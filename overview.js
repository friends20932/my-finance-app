// --- Data Loading & Formatting ---
function formatNumber(num) { 
    return Math.round(parseFloat(num)).toLocaleString('en-US'); 
}

let syncUrl = localStorage.getItem('syncUrl') || '';

function getLedgerData(ledgerId) {
    const raw = localStorage.getItem(`ledger_data_${ledgerId}`);
    return raw ? JSON.parse(raw) : { transactions: [], accounts: [] };
}

async function fetchFromCloud() {
    if (!syncUrl) return false;
    try {
        const response = await fetch(syncUrl);
        const data = await response.json();
        if (data && Object.keys(data).length > 0) {
            for (const key in data) {
                if (key.startsWith('ledger_data_') || key === 'ledgers') {
                    localStorage.setItem(key, typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]));
                }
            }
        }
        return true;
    } catch (error) {
        console.error("Fetch from cloud failed:", error);
        return false;
    }
}

function calculateLedgerStats(data) {
    const transactions = data.transactions || [];
    const accounts = data.accounts || [];
    let totalIncome = 0, totalExpense = 0;
    
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentMonthPrefix = `${currentYear}-${currentMonth}`;

    let monthIncome = 0, monthExpense = 0;
    let yearIncome = 0, yearExpense = 0;

    transactions.forEach(t => {
        if (!t.excludeFromStats) {
            if (t.type === 'income') totalIncome += t.amount;
            if (t.type === 'expense') totalExpense += t.amount;
            
            if (t.date && t.date.startsWith(currentMonthPrefix)) {
                if (t.type === 'income') monthIncome += t.amount;
                if (t.type === 'expense') monthExpense += t.amount;
            }
            if (t.date && t.date.startsWith(currentYear)) {
                if (t.type === 'income') yearIncome += t.amount;
                if (t.type === 'expense') yearExpense += t.amount;
            }
        }
    });
    let netWorth = 0;
    const today = new Date();
    today.setHours(23, 59, 59, 999); // include all of today
    accounts.forEach(acc => {
        if (acc.includeInNetWorth !== false) {
            let bal = acc.initialBalance || 0;
            transactions.forEach(t => {
                if (new Date(t.date) > today) return; // skip future-dated transactions
                if (t.type === 'income' && t.account === acc.name) bal += t.amount;
                if (t.type === 'expense' && t.account === acc.name) bal -= t.amount;
                if (t.type === 'transfer') { 
                    if (t.account === acc.name) bal -= t.amount; 
                    if (t.toAccount === acc.name) bal += t.amount; 
                }
            });
            netWorth += bal;
        }
    });
    return { netWorth, totalIncome, totalExpense, monthIncome, monthExpense, yearIncome, yearExpense };
}

// --- Render Overview ---
async function renderOverview() {
    if (syncUrl) {
        const titleEl = document.getElementById('main-title');
        const originalText = titleEl.innerText;
        titleEl.innerText = "同步資料中...";
        await fetchFromCloud();
        titleEl.innerText = originalText;
    }

    const ledgers = JSON.parse(localStorage.getItem('ledgers')) || [];
    const container = document.getElementById('ledgers-overview-container');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
    container.style.gap = '2rem';
    
    let grandNetWorth = 0, grandIncome = 0, grandExpense = 0;
    container.innerHTML = '';

    if (ledgers.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>尚無帳本資料</p></div>';
        return;
    }

    ledgers.forEach(ledger => {
        const data = getLedgerData(ledger.id);
        const stats = calculateLedgerStats(data);
        grandNetWorth += stats.netWorth;
        grandIncome += stats.totalIncome;
        grandExpense += stats.totalExpense;

        const card = document.createElement('div');
        card.className = 'draggable-widget glass';
        card.style.padding = '1.5rem';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 0.5rem;">
                <h3 style="color: var(--primary); margin: 0;">${ledger.name}</h3>
                <span style="background:var(--secondary); color:var(--text-muted); font-size:0.75rem; padding:4px 8px; border-radius:8px; font-weight:600;">帳本淨值</span>
            </div>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">${ledger.title || ''}</p>
            
            <h2 style="font-size: 2rem; margin-bottom: 1.5rem; color:var(--text-main);" class="amount">$ ${formatNumber(stats.netWorth.toFixed(2))}</h2>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; background: rgba(0,0,0,0.02); padding: 1rem; border-radius: 12px; border: 1px solid rgba(0,0,0,0.03);">
                <div>
                    <span class="small-label" style="margin-bottom:6px; display:block;">當月收支</span>
                    <p style="font-size: 0.95rem; margin: 0; font-weight: 600; font-family: 'Outfit';">
                        <span style="color:#10b981;">+$${formatNumber(stats.monthIncome)}</span><br>
                        <span style="color:#fb7185;">-$${formatNumber(stats.monthExpense)}</span>
                    </p>
                </div>
                <div>
                    <span class="small-label" style="margin-bottom:6px; display:block;">當年收支</span>
                    <p style="font-size: 0.95rem; margin: 0; font-weight: 600; font-family: 'Outfit';">
                        <span style="color:#10b981;">+$${formatNumber(stats.yearIncome)}</span><br>
                        <span style="color:#fb7185;">-$${formatNumber(stats.yearExpense)}</span>
                    </p>
                </div>
            </div>
            
            <button class="btn-secondary" style="width: 100%;" onclick="enterLedger('${ledger.id}')">進入此帳本</button>
        `;
        container.appendChild(card);
    });

    document.getElementById('grand-total-balance').innerText = `$ ${formatNumber(grandNetWorth.toFixed(2))}`;
    document.getElementById('grand-total-income').innerText = `$ ${formatNumber(grandIncome.toFixed(2))}`;
    document.getElementById('grand-total-expense').innerText = `$ ${formatNumber(grandExpense.toFixed(2))}`;
}

// Privacy Toggle
const privacyToggle = document.getElementById('privacy-toggle');
let privacyMode = localStorage.getItem('privacyMode') === 'true';
if (privacyMode) document.body.classList.add('privacy-mode');
if (privacyToggle) {
    privacyToggle.querySelector('i').className = privacyMode ? 'fas fa-eye-slash' : 'fas fa-eye';
    privacyToggle.addEventListener('click', () => {
        privacyMode = !privacyMode;
        localStorage.setItem('privacyMode', privacyMode);
        document.body.classList.toggle('privacy-mode', privacyMode);
        privacyToggle.querySelector('i').className = privacyMode ? 'fas fa-eye-slash' : 'fas fa-eye';
    });
}

window.enterLedger = function(ledgerId) {
    localStorage.setItem('currentLedgerId', ledgerId);
    window.location.href = 'app.html';
};

renderOverview();
