// Check if admin is logged in
if (!sessionStorage.getItem('isAdmin')) {
    window.location.href = 'index.html';
}

// Get current month/year
const now = new Date();
const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const currentMonthDisplay = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

document.getElementById('currentMonthDisplay').textContent = currentMonthDisplay;

// Format currency
function formatRupees(amount) {
    return `₹${parseFloat(amount).toFixed(2)}`;
}

// Format date
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN');
}

// Load balance summary with breakdown
async function loadBalance() {
    try {
        const response = await fetch(`http://localhost:3000/api/maintenance/balance?monthYear=${encodeURIComponent(currentMonth)}`);
        const result = await response.json();

        if (result.success) {
            const data = result.data;
            document.getElementById('openingBalance').textContent = formatRupees(data.opening_balance);
            document.getElementById('totalCollected').textContent = formatRupees(data.total_collected);
            document.getElementById('totalExpenses').textContent = formatRupees(data.total_expenses);
            document.getElementById('closingBalance').textContent = formatRupees(data.closing_balance);
            
            // Show breakdown of maintenance and corpus funds
            document.getElementById('maintenanceCollected').textContent = formatRupees(data.maintenance_collected || 0);
            document.getElementById('corpusCollected').textContent = formatRupees(data.corpus_collected || 0);
        }
    } catch (error) {
        console.error('Error loading balance:', error);
        showError('Failed to load balance');
    }
}

// Carry forward balance to next month
document.getElementById('updateBtn').addEventListener('click', async () => {
    await loadAll();
    showSuccess('Data refreshed successfully!');
});

document.getElementById('carryForwardBtn').addEventListener('click', async () => {
    if (!confirm('This will carry forward the closing balance to next month as opening balance. Continue?')) return;

    try {
        const response = await fetch('http://localhost:3000/api/maintenance/carry-forward', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month_year: currentMonth })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Balance carried forward to next month successfully!');
            loadBalance();
        } else {
            showError(result.error || 'Failed to carry forward balance');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to carry forward balance');
    }
});

// Load current month expenses
async function loadCurrentMonthExpenses() {
    try {
        const response = await fetch(`http://localhost:3000/api/maintenance/expenses?monthYear=${encodeURIComponent(currentMonth)}`);
        const result = await response.json();

        if (result.success) {
            const tbody = document.getElementById('expenseHistoryBody');
            
            if (result.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No expenses added yet</td></tr>';
                return;
            }

            tbody.innerHTML = result.data.map(expense => `
                <tr>
                    <td>${formatDate(expense.expense_date)}</td>
                    <td>${expense.description}</td>
                    <td><span style="background: #f0f0f0; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">${expense.category || '-'}</span></td>
                    <td><strong style="color: #e74c3c;">${formatRupees(expense.amount)}</strong></td>
                    <td style="color: #666;">${expense.notes || '-'}</td>
                    <td>
                        <button class="action-btn" onclick="deleteExpense(${expense.id})" style="color: #e74c3c; border-color: #e74c3c;">Delete</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading expenses:', error);
    }
}

// Load all expenses
async function loadAllExpenses() {
    try {
        const response = await fetch('http://localhost:3000/api/maintenance/expenses/all');
        const result = await response.json();

        if (result.success) {
            const tbody = document.getElementById('allExpensesBody');
            
            if (result.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No expenses yet</td></tr>';
                return;
            }

            tbody.innerHTML = result.data.map(expense => `
                <tr>
                    <td>${formatDate(expense.expense_date)}</td>
                    <td><span style="background: #e3f2fd; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${expense.month_year}</span></td>
                    <td>${expense.description}</td>
                    <td><span style="background: #f0f0f0; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">${expense.category || '-'}</span></td>
                    <td><strong style="color: #e74c3c;">${formatRupees(expense.amount)}</strong></td>
                    <td style="color: #666;">${expense.notes || '-'}</td>
                    <td>
                        <button class="action-btn" onclick="deleteExpense(${expense.id})" style="color: #e74c3c; border-color: #e74c3c;">Delete</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading all expenses:', error);
    }
}

// Add expense
document.getElementById('addExpenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        month_year: currentMonth,
        expense_date: document.getElementById('expenseDate').value,
        description: document.getElementById('expenseDescription').value,
        amount: parseFloat(document.getElementById('expenseAmount').value),
        category: document.getElementById('expenseCategory').value,
        notes: document.getElementById('expenseNotes').value
    };

    try {
        const response = await fetch('http://localhost:3000/api/maintenance/expense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Expense added successfully!');
            document.getElementById('addExpenseForm').reset();
            loadAll();
        } else {
            showError(result.error || 'Failed to add expense');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to add expense');
    }
});

// Delete expense
window.deleteExpense = async function(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
        const response = await fetch(`http://localhost:3000/api/maintenance/expense/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Expense deleted successfully!');
            loadAll();
        } else {
            showError(result.error || 'Failed to delete expense');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to delete expense');
    }
}

// Load all data
function loadAll() {
    loadBalance();
    loadCurrentMonthExpenses();
    loadAllExpenses();
}

// Auto-refresh balance every 10 seconds
setInterval(() => {
    loadBalance();
}, 10000);

// Navigation
document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'admin.html';
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('isAdmin');
    window.location.href = 'index.html';
});

// Show messages
function showSuccess(message) {
    const el = document.getElementById('successMessage');
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}

function showError(message) {
    const el = document.getElementById('errorMessage');
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 5000);
}

// Set today's date as default
document.getElementById('expenseDate').valueAsDate = new Date();

// Load on page load
loadAll();
