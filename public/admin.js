// admin.js - UPDATED VERSION

if (!sessionStorage.getItem('isAdmin')) {
    window.location.href = 'index.html';
}

let currentViewMonth = new Date();
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let allUnits = [];
let currentMonthData = [];

function formatRupees(amount) {
    return `₹${parseFloat(amount).toFixed(2)}`;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function updateUnitInfo(unitNumber, field, value) {
    try {
        const response = await fetch(`/api/admin/unit/${unitNumber}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value })
        });
        const result = await response.json();
        if (result.success) {
            showSuccess(`${field} updated for ${unitNumber}`);
        } else {
            showError(result.error || 'Failed to update');
            loadAdminData();
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to update unit');
        loadAdminData();
    }
}

async function updatePayment(recordId, field, value) {
    try {
        const response = await fetch(`/api/admin/payment/${recordId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value })
        });
        const result = await response.json();
        if (result.success) {
            showSuccess(`Payment ${field} updated`);
            loadAdminData();
        } else {
            showError(result.error || 'Failed to update');
            loadAdminData();
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to update payment');
        loadAdminData();
    }
}

const debouncedUnitUpdate = debounce(updateUnitInfo, 1000);
const debouncedPaymentUpdate = debounce(updatePayment, 1000);

function getCurrentMonthString() {
    return `${String(currentViewMonth.getMonth() + 1).padStart(2, '0')}/${currentViewMonth.getFullYear()}`;
}

function getCurrentMonthDisplay() {
    return `${monthNames[currentViewMonth.getMonth()]} ${currentViewMonth.getFullYear()}`;
}

// FIXED: Safe element updates
function updateMonthDisplay() {
    const display = getCurrentMonthDisplay();
    
    // Only update if elements exist
    const monthDisplayEl = document.getElementById('currentMonthDisplay');
    const monthSpanEl = document.getElementById('currentMonthSpan');
    
    if (monthDisplayEl) {
        monthDisplayEl.textContent = display;
    }
    
    if (monthSpanEl) {
        monthSpanEl.textContent = display;
    }
}

async function loadAdminData() {
    try {
        const unitsResponse = await fetch('/api/admin/units');
        const unitsResult = await unitsResponse.json();
        
        if (unitsResult.success) {
            allUnits = unitsResult.data;
            populateUnitsTable();
        }

        const monthYear = getCurrentMonthString();
        const monthResponse = await fetch(`/api/admin/month?monthYear=${encodeURIComponent(monthYear)}`);
        const monthResult = await monthResponse.json();
        
        if (monthResult.success) {
            currentMonthData = monthResult.data;
            populateCurrentMonthTable();
        }

        updateMonthDisplay();
        
        // FIXED: Check if elements exist before updating
        const loadingEl = document.getElementById('loading');
        const currentMonthCardEl = document.getElementById('currentMonthCard');
        const allUnitsCardEl = document.getElementById('allUnitsCard');
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (currentMonthCardEl) currentMonthCardEl.style.display = 'block';
        if (allUnitsCardEl) allUnitsCardEl.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading admin data:', error);
        
        // FIXED: Safe element updates in error handling
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';
        
        showError('Failed to load data. Please try again.');
    }
}

function populateUnitsTable() {
    const tbody = document.getElementById('unitsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = allUnits.map(unit => {
        const tenantCount = unit.tenant_names ? unit.tenant_names.split(',').filter(n => n.trim()).length : 0;
        return `
        <tr>
            <td><strong>${unit.unit_number}</strong></td>
            <td>
                <input type="number" value="${unit.num_tenants || 0}" min="0"
                    onchange="debouncedUnitUpdate('${unit.unit_number}', 'num_tenants', this.value)" 
                    class="inline-edit" style="width: 80px;">
            </td>
            <td>
                <input type="number" value="${unit.num_cars || 0}" min="0"
                    onchange="debouncedUnitUpdate('${unit.unit_number}', 'num_cars', this.value)" 
                    class="inline-edit" style="width: 80px;">
            </td>
            <td>
                <input type="number" value="${unit.num_two_wheelers || 0}" min="0"
                    onchange="debouncedUnitUpdate('${unit.unit_number}', 'num_two_wheelers', this.value)" 
                    class="inline-edit" style="width: 80px;">
            </td>
            <td>
                <button class="action-btn" onclick="openTenantModal('${unit.unit_number}', '${(unit.tenant_names || '').replace(/'/g, "\\'")}')">
                    ${tenantCount > 0 ? `Edit Names (${tenantCount})` : 'Add Names'}
                </button>
            </td>
        </tr>
    `;
    }).join('');
}

window.openTenantModal = function(unitNumber, tenantNames) {
    const modalUnitEl = document.getElementById('tenantModalUnit');
    const modalTitleEl = document.getElementById('tenantModalTitle');
    const textareaEl = document.getElementById('tenantNamesTextarea');
    const modalEl = document.getElementById('tenantModal');
    
    if (modalUnitEl && modalTitleEl && textareaEl && modalEl) {
        modalUnitEl.value = unitNumber;
        modalTitleEl.textContent = `Edit Tenant Names - ${unitNumber}`;
        textareaEl.value = tenantNames.split(',').join('\n');
        modalEl.style.display = 'block';
    }
}

window.closeTenantModal = function() {
    const modalEl = document.getElementById('tenantModal');
    if (modalEl) modalEl.style.display = 'none';
}

window.saveTenantNames = async function() {
    const unitNumber = document.getElementById('tenantModalUnit')?.value;
    const textarea = document.getElementById('tenantNamesTextarea');
    
    if (!unitNumber || !textarea) return;
    
    const names = textarea.value.split('\n').filter(name => name.trim()).join(',');
    
    try {
        const response = await fetch(`/api/admin/unit/${unitNumber}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenant_names: names })
        });
        const result = await response.json();
        if (result.success) {
            showSuccess('Tenant names updated successfully!');
            closeTenantModal();
            loadAdminData();
        } else {
            showError(result.error || 'Failed to update tenant names');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to update tenant names');
    }
}

function populateCurrentMonthTable() {
    const tbody = document.getElementById('currentMonthBody');
    if (!tbody) return;
    
    if (currentMonthData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No data for this month. Click "Auto-Generate This Month" to create entries.</td></tr>';
        return;
    }

    tbody.innerHTML = currentMonthData.map(record => {
        const total = parseFloat(record.rent) + parseFloat(record.water_bill) + parseFloat(record.maintenance || 0) + parseFloat(record.corpus || 0);
        return `
            <tr>
                <td><strong>${record.unit_number}</strong></td>
                <td>
                    <input type="number" step="0.01" value="${record.rent}" 
                        onchange="debouncedPaymentUpdate(${record.id}, 'rent', this.value)" 
                        class="inline-edit" style="width: 100px;">
                </td>
                <td>
                    <input type="number" step="0.01" value="${record.water_bill}" 
                        onchange="debouncedPaymentUpdate(${record.id}, 'water_bill', this.value)" 
                        class="inline-edit" style="width: 100px;">
                </td>
                <td>
                    <input type="number" step="0.01" value="${record.maintenance || 0}" 
                        onchange="debouncedPaymentUpdate(${record.id}, 'maintenance', this.value)" 
                        class="inline-edit" style="width: 100px;">
                </td>
                <td>
                    <input type="number" step="0.01" value="${record.corpus || 0}" 
                        onchange="debouncedPaymentUpdate(${record.id}, 'corpus', this.value)" 
                        class="inline-edit" style="width: 100px;">
                </td>
                <td><strong>${formatRupees(total)}</strong></td>
                <td>
                    <select onchange="updatePaymentStatus(${record.id}, this.value)" class="inline-select">
                        <option value="pending" ${record.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="paid" ${record.status === 'paid' ? 'selected' : ''}>Paid</option>
                    </select>
                </td>
                <td>
                    ${record.status === 'paid' ? `
                        <input type="date" value="${record.paid_date || ''}" 
                            onchange="debouncedPaymentUpdate(${record.id}, 'paid_date', this.value)" 
                            class="inline-edit" style="width: 140px;">
                        <select onchange="debouncedPaymentUpdate(${record.id}, 'payment_method', this.value)" class="inline-select" style="margin-top: 4px;">
                            <option value="">Method</option>
                            <option value="Cash" ${record.payment_method === 'Cash' ? 'selected' : ''}>Cash</option>
                            <option value="UPI" ${record.payment_method === 'UPI' ? 'selected' : ''}>UPI</option>
                            <option value="Bank Transfer" ${record.payment_method === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer</option>
                        </select>
                    ` : '<span style="color: #999;">-</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

window.updatePaymentStatus = async function(recordId, status) {
    const data = { status };
    
    if (status === 'paid') {
        data.paid_date = new Date().toISOString().split('T')[0];
    } else {
        data.paid_date = null;
        data.payment_method = null;
    }
    
    try {
        const response = await fetch(`/api/admin/payment/${recordId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
            showSuccess('Payment status updated');
            loadAdminData();
        } else {
            showError(result.error || 'Failed to update status');
            loadAdminData();
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to update status');
        loadAdminData();
    }
}

// FIXED: Check if element exists before adding event listener
const autoGenerateBtn = document.getElementById('autoGenerateBtn');
if (autoGenerateBtn) {
    autoGenerateBtn.addEventListener('click', async () => {
        const monthYear = getCurrentMonthString();
        const display = getCurrentMonthDisplay();
        
        if (!confirm(`Generate billing for all units for ${display}?`)) return;

        try {
            const response = await fetch('/api/admin/generate-month', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month_year: monthYear })
            });
            const result = await response.json();
            if (result.success) {
                showSuccess('Month billing generated successfully!');
                loadAdminData();
            } else {
                showError(result.error || 'Failed to generate billing');
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Failed to generate billing. Please try again.');
        }
    });
}

window.rolloverUnpaid = async function() {
    if (!confirm('This will add unpaid bills from previous months to the current month. Continue?')) {
        return;
    }
    
    try {
        const monthYear = getCurrentMonthString();
        const response = await fetch('/api/admin/rollover-unpaid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_month: monthYear })
        });
        const result = await response.json();
        if (result.success) {
            showSuccess(`Rolled over ${result.count} unpaid bills`);
            loadAdminData();
        } else {
            showError(result.error || 'Failed to rollover bills');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to rollover bills');
    }
}

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

// FIXED: Check if element exists before adding event listener
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('isAdmin');
        window.location.href = 'index.html';
    });
}

window.onclick = function(event) {
    const modal = document.getElementById('tenantModal');
    if (event.target === modal && modal) {
        closeTenantModal();
    }
}

// Auto-refresh data to keep sync across pages
let autoRefreshInterval;

function startAutoRefresh() {
    // Stop any existing interval
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Load data immediately
    loadAdminData();
    
    // Set interval for auto-refresh (every 30 seconds)
    autoRefreshInterval = setInterval(loadAdminData, 30000);
}

// Add auto-sync check for new month generation
async function checkForNewMonthGeneration() {
    try {
        const response = await fetch('/api/admin/auto-generate-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (result.success) {
            console.log('Month generation check completed');
            loadAdminData(); // Reload to show new month if generated
        }
    } catch (error) {
        console.error('Error checking for new month:', error);
    }
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    loadAdminData();
    startAutoRefresh();
    
    // Check for new month generation on page load
    setTimeout(checkForNewMonthGeneration, 1000);
    
    // Also check every hour
    setInterval(checkForNewMonthGeneration, 3600000);
});

// Also call loadAdminData on window load as fallback
window.addEventListener('load', function() {
    if (!document.getElementById('unitsTableBody') || !document.getElementById('currentMonthBody')) {
        loadAdminData();
    }
});