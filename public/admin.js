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

let allUnits = [];
let currentMonthData = [];

// Format currency in rupees
function formatRupees(amount) {
    return `₹${parseFloat(amount).toFixed(2)}`;
}

// Debounce function for auto-save
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

// Update unit info
async function updateUnitInfo(unitNumber, field, value) {
    try {
        const response = await fetch(`http://localhost:3000/api/admin/unit/${unitNumber}`, {
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

// Update payment info
async function updatePayment(recordId, field, value) {
    try {
        const response = await fetch(`http://localhost:3000/api/admin/payment/${recordId}`, {
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

// Create debounced update functions
const debouncedUnitUpdate = debounce(updateUnitInfo, 1000);
const debouncedPaymentUpdate = debounce(updatePayment, 1000);

// Load all data
async function loadAdminData() {
    try {
        // Load all units
        const unitsResponse = await fetch('http://localhost:3000/api/admin/units');
        const unitsResult = await unitsResponse.json();
        
        if (unitsResult.success) {
            allUnits = unitsResult.data;
            populateUnitsTable();
        }

        // Load current month data
        const monthResponse = await fetch(`http://localhost:3000/api/admin/month?monthYear=${encodeURIComponent(currentMonth)}`);
        const monthResult = await monthResponse.json();
        
        if (monthResult.success) {
            currentMonthData = monthResult.data;
            populateCurrentMonthTable();
        }

        document.getElementById('loading').style.display = 'none';
        document.getElementById('currentMonthCard').style.display = 'block';
        document.getElementById('allUnitsCard').style.display = 'block';

    } catch (error) {
        console.error('Error loading admin data:', error);
        document.getElementById('loading').style.display = 'none';
        showError('Failed to load data. Please try again.');
    }
}

// Populate units table
function populateUnitsTable() {
    const tbody = document.getElementById('unitsTableBody');
    
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

// Open tenant modal
window.openTenantModal = function(unitNumber, tenantNames) {
    document.getElementById('tenantModalUnit').value = unitNumber;
    document.getElementById('tenantModalTitle').textContent = `Edit Tenant Names - ${unitNumber}`;
    document.getElementById('tenantNamesTextarea').value = tenantNames.split(',').join('\n');
    document.getElementById('tenantModal').style.display = 'block';
}

// Close tenant modal
window.closeTenantModal = function() {
    document.getElementById('tenantModal').style.display = 'none';
}

// Save tenant names
window.saveTenantNames = async function() {
    const unitNumber = document.getElementById('tenantModalUnit').value;
    const textarea = document.getElementById('tenantNamesTextarea');
    const names = textarea.value.split('\n').filter(name => name.trim()).join(',');
    
    try {
        const response = await fetch(`http://localhost:3000/api/admin/unit/${unitNumber}`, {
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

// Populate current month table with inline editing and CORPUS column
function populateCurrentMonthTable() {
    const tbody = document.getElementById('currentMonthBody');
    
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

// Update payment status
window.updatePaymentStatus = async function(recordId, status) {
    const data = { status };
    
    if (status === 'paid') {
        data.paid_date = new Date().toISOString().split('T')[0];
    } else {
        data.paid_date = null;
        data.payment_method = null;
    }
    
    try {
        const response = await fetch(`http://localhost:3000/api/admin/payment/${recordId}`, {
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

// Auto-generate current month
document.getElementById('autoGenerateBtn').addEventListener('click', async () => {
    if (!confirm(`Generate billing for all units for ${currentMonthDisplay}?`)) return;

    try {
        const response = await fetch('http://localhost:3000/api/admin/generate-month', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month_year: currentMonth })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Current month billing generated successfully!');
            loadAdminData();
        } else {
            showError(result.error || 'Failed to generate billing');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to generate billing. Please try again.');
    }
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

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('isAdmin');
    window.location.href = 'index.html';
});

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('tenantModal');
    if (event.target === modal) {
        closeTenantModal();
    }
}

// Load data on page load
loadAdminData();

// Auto-refresh admin data every 15 seconds to keep data in sync
setInterval(() => {
    loadAdminData();
}, 15000);
