// Check if admin is logged in
if (!sessionStorage.getItem('isAdmin')) {
    window.location.href = 'index.html';
}

// Get current month/year
const now = new Date();
const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const currentMonthDisplay = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

// Format currency
function formatRupees(amount) {
    return `₹${parseFloat(amount).toFixed(2)}`;
}

// Format date
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN');
}

// Update all month displays
function updateMonthDisplays() {
    const mainDisplay = document.getElementById('currentMonthDisplay');
    const monthDisplay2 = document.getElementById('currentMonthDisplay2');
    
    if (mainDisplay) {
        mainDisplay.textContent = currentMonthDisplay;
    }
    
    if (monthDisplay2) {
        monthDisplay2.textContent = currentMonthDisplay;
    }
}

// Load balance summary with breakdown
async function loadBalance() {
    try {
        const response = await fetch(`/api/maintenance/balance?monthYear=${encodeURIComponent(currentMonth)}`);
        const result = await response.json();

        if (result.success) {
            const data = result.data;
            
            // Update balance elements if they exist
            const openingBalanceEl = document.getElementById('openingBalance');
            const totalCollectedEl = document.getElementById('totalCollected');
            const totalExpensesEl = document.getElementById('totalExpenses');
            const closingBalanceEl = document.getElementById('closingBalance');
            const maintenanceCollectedEl = document.getElementById('maintenanceCollected');
            const corpusCollectedEl = document.getElementById('corpusCollected');
            
            if (openingBalanceEl) openingBalanceEl.textContent = formatRupees(data.opening_balance || 0);
            if (totalCollectedEl) totalCollectedEl.textContent = formatRupees(data.total_collected || 0);
            if (totalExpensesEl) totalExpensesEl.textContent = formatRupees(data.total_expenses || 0);
            if (closingBalanceEl) closingBalanceEl.textContent = formatRupees(data.closing_balance || 0);
            
            // Show breakdown of maintenance and corpus funds
            if (maintenanceCollectedEl) maintenanceCollectedEl.textContent = formatRupees(data.maintenance_collected || 0);
            if (corpusCollectedEl) corpusCollectedEl.textContent = formatRupees(data.corpus_collected || 0);
        } else {
            // If no balance record exists, show zeros
            const openingBalanceEl = document.getElementById('openingBalance');
            const totalCollectedEl = document.getElementById('totalCollected');
            const totalExpensesEl = document.getElementById('totalExpenses');
            const closingBalanceEl = document.getElementById('closingBalance');
            const maintenanceCollectedEl = document.getElementById('maintenanceCollected');
            const corpusCollectedEl = document.getElementById('corpusCollected');
            
            if (openingBalanceEl) openingBalanceEl.textContent = formatRupees(0);
            if (totalCollectedEl) totalCollectedEl.textContent = formatRupees(0);
            if (totalExpensesEl) totalExpensesEl.textContent = formatRupees(0);
            if (closingBalanceEl) closingBalanceEl.textContent = formatRupees(0);
            if (maintenanceCollectedEl) maintenanceCollectedEl.textContent = formatRupees(0);
            if (corpusCollectedEl) corpusCollectedEl.textContent = formatRupees(0);
        }
    } catch (error) {
        console.error('Error loading balance:', error);
        showError('Failed to load balance');
    }
}

// Add event listener for Update Collected Amount button
const updateBtn = document.getElementById('updateBtn');
if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
        try {
            // Refresh the collected amount
            const response = await fetch('/api/maintenance/refresh-collected', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month_year: currentMonth })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showSuccess('Collected amount updated successfully!');
                await loadAll();
            } else {
                showError(result.error || 'Failed to update collected amount');
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Failed to update collected amount');
        }
    });
}

// Add event listener for Carry Forward button
const carryForwardBtn = document.getElementById('carryForwardBtn');
if (carryForwardBtn) {
    carryForwardBtn.addEventListener('click', async () => {
        if (!confirm('This will carry forward the closing balance to next month as opening balance. Continue?')) return;

        try {
            const response = await fetch('/api/maintenance/carry-forward', {
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
}

// Load current month expenses
async function loadCurrentMonthExpenses() {
    try {
        const response = await fetch(`/api/maintenance/expenses?monthYear=${encodeURIComponent(currentMonth)}`);
        const result = await response.json();

        if (result.success) {
            const tbody = document.getElementById('expenseHistoryBody');
            
            if (!tbody) return;
            
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
        const response = await fetch('/api/maintenance/expenses/all');
        const result = await response.json();

        if (result.success) {
            const tbody = document.getElementById('allExpensesBody');
            
            if (!tbody) return;
            
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
const addExpenseForm = document.getElementById('addExpenseForm');
if (addExpenseForm) {
    addExpenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            month_year: currentMonth,
            expense_date: document.getElementById('expenseDate').value,
            description: document.getElementById('expenseDescription').value,
            amount: parseFloat(document.getElementById('expenseAmount').value) || 0,
            category: document.getElementById('expenseCategory').value,
            notes: document.getElementById('expenseNotes').value
        };

        // Validate required fields
        if (!data.expense_date || !data.description || !data.amount) {
            showError('Please fill in all required fields: Date, Description, and Amount');
            return;
        }

        try {
            const response = await fetch('/api/maintenance/expense', {
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
}

// Delete expense
window.deleteExpense = async function(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
        const response = await fetch(`/api/maintenance/expense/${id}`, {
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

// Enhanced auto-refresh
let maintenanceAutoRefreshInterval;

function startMaintenanceAutoRefresh() {
    if (maintenanceAutoRefreshInterval) {
        clearInterval(maintenanceAutoRefreshInterval);
    }
    
    // Load immediately
    loadAll();
    
    // Set interval for auto-refresh (every 30 seconds)
    maintenanceAutoRefreshInterval = setInterval(() => {
        loadBalance(); // More frequent balance check
    }, 10000);
    
    // Full reload every 60 seconds
    setInterval(loadAll, 60000);
}

// Check for new month and initialize if needed
async function checkMaintenanceMonth() {
    try {
        const response = await fetch(`/api/maintenance/balance?monthYear=${encodeURIComponent(currentMonth)}`);
        const result = await response.json();
        
        if (!result.success || !result.data) {
            // No balance record for this month, check if we should carry forward
            await initializeMaintenanceForMonth(currentMonth);
        }
    } catch (error) {
        console.error('Error checking maintenance:', error);
    }
}

async function initializeMaintenanceForMonth(monthYear) {
    try {
        // Check previous month
        const [month, year] = monthYear.split('/');
        const prevMonth = parseInt(month) === 1 ? 12 : parseInt(month) - 1;
        const prevYear = parseInt(month) === 1 ? parseInt(year) - 1 : parseInt(year);
        const prevMonthYear = `${String(prevMonth).padStart(2, '0')}/${prevYear}`;
        
        // Get previous month's balance
        const response = await fetch(`/api/maintenance/balance?monthYear=${encodeURIComponent(prevMonthYear)}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            // Carry forward automatically
            const closingBalance = parseFloat(result.data.closing_balance) || 0;
            
            // Create new balance record with carried forward amount
            await fetch('/api/maintenance/refresh-collected', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month_year: monthYear })
            });
            
            console.log(`Auto-initialized maintenance for ${monthYear} with opening balance: ${closingBalance}`);
        }
    } catch (error) {
        console.error('Error initializing maintenance:', error);
    }
}

// Navigation
const backBtn = document.getElementById('backBtn');
if (backBtn) {
    backBtn.addEventListener('click', () => {
        window.location.href = 'admin.html';
    });
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('isAdmin');
        window.location.href = 'index.html';
    });
}

// Show messages
function showSuccess(message) {
    const el = document.getElementById('successMessage');
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
        setTimeout(() => {
            if (el) el.style.display = 'none';
        }, 3000);
    }
}

function showError(message) {
    const el = document.getElementById('errorMessage');
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
        setTimeout(() => {
            if (el) el.style.display = 'none';
        }, 5000);
    }
}

// Set today's date as default
const expenseDateInput = document.getElementById('expenseDate');
if (expenseDateInput) {
    expenseDateInput.valueAsDate = new Date();
}

// Initialize the page
window.addEventListener('load', () => {
    // Update all month displays
    updateMonthDisplays();
    
    // Check and initialize maintenance for current month
    checkMaintenanceMonth();
    
    // Load all data
    loadAll();
    
    // Start auto-refresh
    startMaintenanceAutoRefresh();
});

// Also handle DOMContentLoaded as backup
document.addEventListener('DOMContentLoaded', function() {
    updateMonthDisplays();
});

// Auto-refresh balance every 10 seconds
setInterval(() => {
    loadBalance();
}, 10000);