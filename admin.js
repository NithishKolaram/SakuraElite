// Check if admin is logged in
if (!sessionStorage.getItem('isAdmin')) {
    window.location.href = 'index.html';
}

// Get current month/year
const now = new Date();
const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const currentMonthDisplay = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

console.log('Current month format:', currentMonth);

document.getElementById('currentMonthDisplay').textContent = currentMonthDisplay;

let allUnits = [];
let currentMonthData = [];

// Format currency in rupees
function formatRupees(amount) {
    return `₹${parseFloat(amount).toFixed(2)}`;
}

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
        console.log(`Fetching month data for: ${currentMonth}`);
        const monthResponse = await fetch(`http://localhost:3000/api/admin/month?monthYear=${encodeURIComponent(currentMonth)}`);
        const monthResult = await monthResponse.json();
        
        if (monthResult.success) {
            currentMonthData = monthResult.data;
            populateCurrentMonthTable();
        } else {
            console.warn('Month data error:', monthResult);
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
    
    tbody.innerHTML = allUnits.map(unit => `
        <tr>
            <td><strong>${unit.unit_number}</strong></td>
            <td>${formatRupees(unit.rent)}</td>
            <td>${unit.num_tenants || 0}</td>
            <td>${unit.num_cars || 0}</td>
            <td>
                <button class="action-btn" onclick="editBaseUnit('${unit.unit_number}')">Edit</button>
            </td>
        </tr>
    `).join('');
}

// Populate current month table
function populateCurrentMonthTable() {
    const tbody = document.getElementById('currentMonthBody');
    
    if (currentMonthData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No data for this month. Click "Auto-Generate This Month" to create entries.</td></tr>';
        return;
    }

    tbody.innerHTML = currentMonthData.map(record => {
        const total = parseFloat(record.rent) + parseFloat(record.water_bill);
        return `
            <tr>
                <td><strong>${record.unit_number}</strong></td>
                <td>${formatRupees(record.rent)}</td>
                <td>${formatRupees(record.water_bill)}</td>
                <td>${formatRupees(record.maintenance)}</td>
                <td><strong>${formatRupees(total)}</strong></td>
                <td><span class="status-${record.status}">${record.status.charAt(0).toUpperCase() + record.status.slice(1)}</span></td>
                <td>
                    <button class="action-btn" onclick="editPayment(${record.id})">Edit</button>
                </td>
            </tr>
        `;
    }).join('');
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

// Edit payment
function editPayment(recordId) {
    const record = currentMonthData.find(r => r.id === recordId);
    if (!record) return;

    document.getElementById('modalTitle').textContent = `Edit ${record.unit_number} - ${currentMonthDisplay}`;
    document.getElementById('editRecordId').value = record.id;
    document.getElementById('editUnitNumber').value = record.unit_number;
    document.getElementById('editRent').value = record.rent;
    document.getElementById('editWaterBill').value = record.water_bill;
    document.getElementById('editStatus').value = record.status;
    
    if (record.paid_date) {
        document.getElementById('editPaidDate').value = record.paid_date;
    }
    if (record.payment_method) {
        document.getElementById('editPaymentMethod').value = record.payment_method;
    }

    togglePaidFields(record.status);
    document.getElementById('editModal').style.display = 'block';
}

// Toggle paid date and method fields
document.getElementById('editStatus').addEventListener('change', (e) => {
    togglePaidFields(e.target.value);
});

function togglePaidFields(status) {
    const paidDateGroup = document.getElementById('paidDateGroup');
    const paymentMethodGroup = document.getElementById('paymentMethodGroup');
    
    if (status === 'paid') {
        paidDateGroup.style.display = 'block';
        paymentMethodGroup.style.display = 'block';
    } else {
        paidDateGroup.style.display = 'none';
        paymentMethodGroup.style.display = 'none';
    }
}

// Save payment changes
document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const recordId = document.getElementById('editRecordId').value;
    const data = {
        rent: document.getElementById('editRent').value,
        water_bill: document.getElementById('editWaterBill').value,
        status: document.getElementById('editStatus').value,
        paid_date: document.getElementById('editPaidDate').value || null,
        payment_method: document.getElementById('editPaymentMethod').value || null
    };

    try {
        const response = await fetch(`http://localhost:3000/api/admin/payment/${recordId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Payment updated successfully!');
            closeModal();
            loadAdminData();
        } else {
            showError(result.error || 'Failed to update payment');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to update payment. Please try again.');
    }
});

// Modal controls
document.querySelector('.close').addEventListener('click', closeModal);
document.querySelector('.cancel-btn').addEventListener('click', closeModal);

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
    document.getElementById('editForm').reset();
}

window.addEventListener('click', (e) => {
    const modal = document.getElementById('editModal');
    if (e.target === modal) {
        closeModal();
    }
});

// Show messages
function showSuccess(message) {
    const el = document.getElementById('successMessage');
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 5000);
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

// Load data on page load
loadAdminData();