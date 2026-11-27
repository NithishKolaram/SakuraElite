if (!sessionStorage.getItem('isAdmin')) {
    window.location.href = 'index.html';
}

const now = new Date();
const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const currentMonthDisplay = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

let allExpensesData = []; // cached for filtering

// ── Format helpers ────────────────────────────────────────────────────────────

function formatRupees(amount) {
    return `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN');
}

// ── Month display ─────────────────────────────────────────────────────────────

function updateMonthDisplays() {
    const a = document.getElementById('currentMonthDisplay');
    const b = document.getElementById('currentMonthDisplay2');
    if (a) a.textContent = currentMonthDisplay;
    if (b) b.textContent = currentMonthDisplay;
}

// ── Notifications ─────────────────────────────────────────────────────────────

function showSuccess(message) {
    const el = document.getElementById('successMessage');
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3500);
}

function showError(message) {
    const el = document.getElementById('errorMessage');
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

// ── Balance ───────────────────────────────────────────────────────────────────

async function loadBalance() {
    try {
        const res = await fetch(`/api/maintenance/balance?monthYear=${encodeURIComponent(currentMonth)}`);
        const result = await res.json();
        const data = result.success ? result.data : null;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = formatRupees(val); };
        set('openingBalance',       data?.opening_balance      ?? 0);
        set('totalCollected',       data?.total_collected      ?? 0);
        set('totalExpenses',        data?.total_expenses       ?? 0);
        set('closingBalance',       data?.closing_balance      ?? 0);
        set('maintenanceCollected', data?.maintenance_collected ?? 0);
        set('corpusCollected',      data?.corpus_collected     ?? 0);
    } catch (err) {
        console.error('Balance error:', err);
    }
}

// ── Update collected (manual refresh) ────────────────────────────────────────

document.getElementById('updateBtn')?.addEventListener('click', async () => {
    try {
        const res = await fetch('/api/maintenance/refresh-collected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month_year: currentMonth })
        });
        const result = await res.json();
        if (result.success) { showSuccess('Collected amount refreshed!'); loadBalance(); }
        else showError(result.error || 'Failed to refresh');
    } catch { showError('Failed to refresh'); }
});

// ── Carry forward ─────────────────────────────────────────────────────────────

document.getElementById('carryForwardBtn')?.addEventListener('click', async () => {
    if (!confirm('Carry this month\'s closing balance to next month as opening balance?')) return;
    try {
        const res = await fetch('/api/maintenance/carry-forward', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month_year: currentMonth })
        });
        const result = await res.json();
        if (result.success) { showSuccess('Balance carried forward!'); loadBalance(); }
        else showError(result.error || 'Failed to carry forward');
    } catch { showError('Failed to carry forward balance'); }
});

// ── Current month expenses ────────────────────────────────────────────────────

async function loadCurrentMonthExpenses() {
    try {
        const res = await fetch(`/api/maintenance/expenses?monthYear=${encodeURIComponent(currentMonth)}`);
        const result = await res.json();
        const tbody = document.getElementById('expenseHistoryBody');
        if (!tbody) return;

        if (!result.success || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No expenses this month</td></tr>';
            return;
        }

        tbody.innerHTML = result.data.map(e => `
            <tr>
                <td data-label="Date">${formatDate(e.expense_date)}</td>
                <td data-label="Description">${e.description}</td>
                <td data-label="Category" class="col-hide-xs">
                    <span class="category-badge">${e.category || '—'}</span>
                </td>
                <td data-label="Amount"><strong style="color:#e53e3e;">${formatRupees(e.amount)}</strong></td>
                <td data-label="Notes" class="col-hide-xs" style="color:var(--text-muted);">${e.notes || '—'}</td>
                <td data-label="Action">
                    <button class="action-btn" onclick="deleteExpense(${e.id})" style="color:#e53e3e;border-color:#fed7d7;">Delete</button>
                </td>
            </tr>`).join('');
    } catch (err) {
        console.error('Expense load error:', err);
    }
}

// ── All expenses ──────────────────────────────────────────────────────────────

async function loadAllExpenses() {
    try {
        const res = await fetch('/api/maintenance/expenses/all');
        const result = await res.json();
        if (!result.success) return;

        allExpensesData = result.data;
        populateMonthFilter(result.data);
        renderAllExpenses(result.data);
    } catch (err) {
        console.error('All expenses error:', err);
    }
}

function populateMonthFilter(data) {
    const select = document.getElementById('historyMonthFilter');
    if (!select) return;
    const months = [...new Set(data.map(e => e.month_year))].sort((a, b) => {
        const [ma, ya] = a.split('/');
        const [mb, yb] = b.split('/');
        return new Date(yb, mb - 1) - new Date(ya, ma - 1);
    });
    select.innerHTML = '<option value="">All Months</option>' +
        months.map(m => `<option value="${m}">${m}</option>`).join('');
}

function renderAllExpenses(data) {
    const tbody = document.getElementById('allExpensesBody');
    if (!tbody) return;
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No expenses found</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(e => `
        <tr>
            <td data-label="Date">${formatDate(e.expense_date)}</td>
            <td data-label="Month"><span class="category-badge">${e.month_year}</span></td>
            <td data-label="Description">${e.description}</td>
            <td data-label="Category" class="col-hide-xs">
                <span class="category-badge">${e.category || '—'}</span>
            </td>
            <td data-label="Amount"><strong style="color:#e53e3e;">${formatRupees(e.amount)}</strong></td>
            <td data-label="Notes" class="col-hide-xs" style="color:var(--text-muted);">${e.notes || '—'}</td>
            <td data-label="Action">
                <button class="action-btn" onclick="deleteExpense(${e.id})" style="color:#e53e3e;border-color:#fed7d7;">Delete</button>
            </td>
        </tr>`).join('');
}

// ── View All History toggle ────────────────────────────────────────────────────

document.getElementById('viewAllHistoryBtn')?.addEventListener('click', async () => {
    const card = document.getElementById('allHistoryCard');
    if (!card) return;
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await loadAllExpenses();
});

document.getElementById('closeAllHistoryBtn')?.addEventListener('click', () => {
    const card = document.getElementById('allHistoryCard');
    if (card) card.style.display = 'none';
});

document.getElementById('historyMonthFilter')?.addEventListener('change', (e) => {
    const filterMonth = e.target.value;
    const filtered = filterMonth
        ? allExpensesData.filter(ex => ex.month_year === filterMonth)
        : allExpensesData;
    renderAllExpenses(filtered);
});

// ── Add expense ───────────────────────────────────────────────────────────────

document.getElementById('addExpenseForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        month_year:   currentMonth,
        expense_date: document.getElementById('expenseDate').value,
        description:  document.getElementById('expenseDescription').value,
        amount:       parseFloat(document.getElementById('expenseAmount').value) || 0,
        category:     document.getElementById('expenseCategory').value,
        notes:        document.getElementById('expenseNotes').value
    };
    if (!data.expense_date || !data.description || !data.amount) {
        showError('Date, description, and amount are required');
        return;
    }
    try {
        const res = await fetch('/api/maintenance/expense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            showSuccess('Expense added!');
            e.target.reset();
            document.getElementById('expenseDate').valueAsDate = new Date();
            loadAll();
        } else {
            showError(result.error || 'Failed to add expense');
        }
    } catch { showError('Failed to add expense'); }
});

// ── Delete expense ─────────────────────────────────────────────────────────────

window.deleteExpense = async function(id) {
    if (!confirm('Delete this expense?')) return;
    try {
        const res = await fetch(`/api/maintenance/expense/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) { showSuccess('Expense deleted'); loadAll(); }
        else showError(result.error || 'Failed to delete');
    } catch { showError('Failed to delete expense'); }
};

// ── Navigation ────────────────────────────────────────────────────────────────

document.getElementById('backBtn')?.addEventListener('click', () => { window.location.href = 'admin.html'; });
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('isAdmin');
    window.location.href = 'index.html';
});

// ── Load ──────────────────────────────────────────────────────────────────────

function loadAll() {
    loadBalance();
    loadCurrentMonthExpenses();
    // All history only loaded when "View All History" is clicked
}

window.addEventListener('load', () => {
    updateMonthDisplays();

    const expenseDateInput = document.getElementById('expenseDate');
    if (expenseDateInput) expenseDateInput.valueAsDate = new Date();

    loadAll();

    setInterval(loadBalance, 30000);
});
