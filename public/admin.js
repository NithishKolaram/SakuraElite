if (!sessionStorage.getItem('isAdmin')) {
    window.location.href = 'index.html';
}

let currentViewMonth = new Date();
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let allUnits = [];
let currentMonthData = [];

// ── Formatting ──────────────────────────────────────────────────────────────

function formatRupees(amount) {
    const n = parseFloat(amount) || 0;
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// ── Toast notifications ──────────────────────────────────────────────────────

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 280);
    }, 3500);
}

function showSuccess(message) { showToast(message, 'success'); }
function showError(message)   { showToast(message, 'error'); }

// ── Month helpers ────────────────────────────────────────────────────────────

function getMonthString(date) {
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function getMonthDisplay(date) {
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function updateMonthDisplay() {
    const el = document.getElementById('currentMonthDisplay');
    if (el) el.textContent = getMonthDisplay(currentViewMonth);

    const now = new Date();
    const isCurrentMonth =
        currentViewMonth.getFullYear() === now.getFullYear() &&
        currentViewMonth.getMonth()    === now.getMonth();
    const nextBtn = document.getElementById('nextMonthBtn');
    if (nextBtn) nextBtn.disabled = isCurrentMonth;
}

// ── Stats strip ──────────────────────────────────────────────────────────────

async function loadStats() {
    try {
        const monthYear = getMonthString(currentViewMonth);
        const res = await fetch(`/api/admin/stats?monthYear=${encodeURIComponent(monthYear)}`);
        const result = await res.json();
        if (!result.success) return;

        const d = result.data;
        const $ = id => document.getElementById(id);

        if ($('statTotalUnits')) $('statTotalUnits').textContent = d.total_units;
        if ($('statPaid'))       $('statPaid').textContent       = d.paid_count;
        if ($('statPending'))    $('statPending').textContent    = d.pending_count;
        if ($('statCollected'))  $('statCollected').textContent  = formatRupees(d.total_collected);

        const pct  = d.total_units > 0 ? Math.round((d.paid_count / d.total_units) * 100) : 0;
        const fill = $('progressFill');
        const text = $('progressText');
        if (fill) fill.style.width = `${pct}%`;
        if (text) text.textContent = `${d.paid_count} of ${d.total_units} paid (${pct}%)`;
    } catch (err) {
        console.error('Stats load error:', err);
    }
}

// ── Main data load ───────────────────────────────────────────────────────────

async function loadAdminData() {
    try {
        const monthYear = getMonthString(currentViewMonth);

        const [unitsRes, monthRes] = await Promise.all([
            fetch('/api/admin/units'),
            fetch(`/api/admin/month?monthYear=${encodeURIComponent(monthYear)}`)
        ]);

        const unitsResult = await unitsRes.json();
        const monthResult = await monthRes.json();

        if (unitsResult.success) {
            allUnits = unitsResult.data;
            populateUnitsTable();
        }

        if (monthResult.success) {
            currentMonthData = monthResult.data;
            populateCurrentMonthTable();
        }

        updateMonthDisplay();
        loadStats();

        document.getElementById('loadingOverlay')?.remove();

        const billing = document.getElementById('currentMonthCard');
        const units   = document.getElementById('allUnitsCard');
        if (billing) billing.style.display = 'block';
        if (units)   units.style.display   = 'block';

    } catch (err) {
        console.error('Load error:', err);
        showError('Failed to load data. Please refresh.');
        document.getElementById('loadingOverlay')?.remove();
    }
}

// ── Table: units ─────────────────────────────────────────────────────────────

function populateUnitsTable() {
    const tbody = document.getElementById('unitsTableBody');
    if (!tbody) return;

    tbody.innerHTML = allUnits.map(unit => {
        const tenantCount = unit.tenant_names
            ? unit.tenant_names.split(',').filter(n => n.trim()).length
            : 0;
        const escapedNames = (unit.tenant_names || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        return `
        <tr>
            <td><strong class="unit-tag">${unit.unit_number}</strong></td>
            <td>
                <input type="number" value="${unit.rent || 0}" min="0" step="100"
                    onchange="debouncedUnitUpdate('${unit.unit_number}', 'rent', this.value)"
                    class="inline-edit" style="width:110px;">
            </td>
            <td>
                <input type="number" value="${unit.num_tenants || 0}" min="0"
                    onchange="debouncedUnitUpdate('${unit.unit_number}', 'num_tenants', this.value)"
                    class="inline-edit" style="width:70px;">
            </td>
            <td>
                <input type="number" value="${unit.num_cars || 0}" min="0"
                    onchange="debouncedUnitUpdate('${unit.unit_number}', 'num_cars', this.value)"
                    class="inline-edit" style="width:70px;">
            </td>
            <td>
                <input type="number" value="${unit.num_two_wheelers || 0}" min="0"
                    onchange="debouncedUnitUpdate('${unit.unit_number}', 'num_two_wheelers', this.value)"
                    class="inline-edit" style="width:70px;">
            </td>
            <td>
                <button class="btn-link" onclick="openTenantModal('${unit.unit_number}', '${escapedNames}')">
                    ${tenantCount > 0 ? `${tenantCount} tenant${tenantCount > 1 ? 's' : ''}` : 'Add names'}
                </button>
            </td>
        </tr>`;
    }).join('');
}

// ── Table: billing ───────────────────────────────────────────────────────────

function populateCurrentMonthTable() {
    const tbody = document.getElementById('currentMonthBody');
    if (!tbody) return;

    if (currentMonthData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    No billing generated for this month yet.<br>
                    <button class="btn btn-primary" style="margin-top:14px;"
                        onclick="document.getElementById('autoGenerateBtn').click()">
                        Generate Now
                    </button>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = currentMonthData.map(record => {
        const rent   = parseFloat(record.rent)         || 0;
        const water  = parseFloat(record.water_bill)   || 0;
        const maint  = parseFloat(record.maintenance)  || 0;
        const corpus = parseFloat(record.corpus)       || 0;
        const total  = rent + water + maint + corpus;
        const isPaid = record.status === 'paid';

        const methodSelect = `
            <select onchange="debouncedPaymentUpdate(${record.id}, 'payment_method', this.value)"
                class="inline-edit" style="width:110px;">
                <option value="">Method</option>
                <option value="Cash"          ${record.payment_method === 'Cash'          ? 'selected' : ''}>Cash</option>
                <option value="UPI"           ${record.payment_method === 'UPI'           ? 'selected' : ''}>UPI</option>
                <option value="Bank Transfer" ${record.payment_method === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer</option>
                <option value="Razorpay"      ${record.payment_method === 'Razorpay'      ? 'selected' : ''}>Razorpay</option>
            </select>`;

        return `
        <tr class="${isPaid ? 'row-paid' : 'row-pending'}">
            <td><strong class="unit-tag">${record.unit_number}</strong></td>
            <td>
                <input type="number" step="0.01" value="${rent.toFixed(2)}"
                    onchange="debouncedPaymentUpdate(${record.id}, 'rent', this.value)"
                    class="inline-edit" style="width:90px;">
            </td>
            <td>
                <input type="number" step="0.01" value="${water.toFixed(2)}"
                    onchange="debouncedPaymentUpdate(${record.id}, 'water_bill', this.value)"
                    class="inline-edit" style="width:90px;">
            </td>
            <td>
                <input type="number" step="0.01" value="${maint.toFixed(2)}"
                    onchange="debouncedPaymentUpdate(${record.id}, 'maintenance', this.value)"
                    class="inline-edit" style="width:90px;">
            </td>
            <td>
                <input type="number" step="0.01" value="${corpus.toFixed(2)}"
                    onchange="debouncedPaymentUpdate(${record.id}, 'corpus', this.value)"
                    class="inline-edit" style="width:90px;">
            </td>
            <td><strong>${formatRupees(total)}</strong></td>
            <td>
                <select onchange="updatePaymentStatus(${record.id}, this.value)"
                    class="status-select ${isPaid ? 'status-paid' : 'status-pending'}">
                    <option value="pending" ${!isPaid ? 'selected' : ''}>Pending</option>
                    <option value="paid"    ${ isPaid ? 'selected' : ''}>Paid</option>
                </select>
            </td>
            <td>
                ${isPaid
                    ? `<input type="date" value="${record.paid_date || ''}"
                        onchange="debouncedPaymentUpdate(${record.id}, 'paid_date', this.value)"
                        class="inline-edit" style="width:135px;">`
                    : '<span style="color:#aaa;">—</span>'}
            </td>
            <td>${isPaid ? methodSelect : '<span style="color:#aaa;">—</span>'}</td>
        </tr>`;
    }).join('');
}

// ── API: update unit ─────────────────────────────────────────────────────────

async function updateUnitInfo(unitNumber, field, value) {
    try {
        const res    = await fetch(`/api/admin/unit/${unitNumber}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value })
        });
        const result = await res.json();
        if (result.success) {
            showSuccess(`Updated for ${unitNumber}`);
        } else {
            showError(result.error || 'Failed to update');
            loadAdminData();
        }
    } catch {
        showError('Failed to update unit');
        loadAdminData();
    }
}

// ── API: update payment field ────────────────────────────────────────────────

async function updatePayment(recordId, field, value) {
    try {
        const res    = await fetch(`/api/admin/payment/${recordId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value })
        });
        const result = await res.json();
        if (result.success) {
            showSuccess('Payment updated');
            loadAdminData();
        } else {
            showError(result.error || 'Failed to update');
            loadAdminData();
        }
    } catch {
        showError('Failed to update payment');
        loadAdminData();
    }
}

const debouncedUnitUpdate    = debounce(updateUnitInfo, 900);
const debouncedPaymentUpdate = debounce(updatePayment,  900);

// ── API: update payment status ───────────────────────────────────────────────

window.updatePaymentStatus = async function(recordId, status) {
    const data = { status };
    if (status === 'paid') {
        data.paid_date = new Date().toISOString().split('T')[0];
    } else {
        data.paid_date = null;
        data.payment_method = null;
    }
    try {
        const res    = await fetch(`/api/admin/payment/${recordId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            showSuccess(status === 'paid' ? 'Marked as paid' : 'Marked as pending');
            loadAdminData();
        } else {
            showError(result.error || 'Failed to update status');
            loadAdminData();
        }
    } catch {
        showError('Failed to update status');
        loadAdminData();
    }
};

// ── Modal: tenant names ──────────────────────────────────────────────────────

window.openTenantModal = function(unitNumber, tenantNames) {
    document.getElementById('tenantModalUnit').value    = unitNumber;
    document.getElementById('tenantModalTitle').textContent = `Tenant Names — ${unitNumber}`;
    document.getElementById('tenantNamesTextarea').value =
        tenantNames.split(',').filter(n => n.trim()).join('\n');
    document.getElementById('tenantModal').style.display = 'flex';
};

window.closeTenantModal = function() {
    document.getElementById('tenantModal').style.display = 'none';
};

window.saveTenantNames = async function() {
    const unitNumber = document.getElementById('tenantModalUnit')?.value;
    const textarea   = document.getElementById('tenantNamesTextarea');
    if (!unitNumber || !textarea) return;

    const names = textarea.value.split('\n').filter(n => n.trim()).join(',');
    try {
        const res    = await fetch(`/api/admin/unit/${unitNumber}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenant_names: names })
        });
        const result = await res.json();
        if (result.success) {
            showSuccess('Tenant names saved');
            closeTenantModal();
            loadAdminData();
        } else {
            showError(result.error || 'Failed to save');
        }
    } catch {
        showError('Failed to save tenant names');
    }
};

// ── Month navigation ─────────────────────────────────────────────────────────

document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
    currentViewMonth = new Date(currentViewMonth.getFullYear(), currentViewMonth.getMonth() - 1, 1);
    loadAdminData();
});

document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
    currentViewMonth = new Date(currentViewMonth.getFullYear(), currentViewMonth.getMonth() + 1, 1);
    loadAdminData();
});

// ── Auto-generate billing ────────────────────────────────────────────────────

document.getElementById('autoGenerateBtn')?.addEventListener('click', async () => {
    const monthYear = getMonthString(currentViewMonth);
    const display   = getMonthDisplay(currentViewMonth);

    if (!confirm(`Generate billing for all units for ${display}?`)) return;

    try {
        const res    = await fetch('/api/admin/generate-month', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month_year: monthYear })
        });
        const result = await res.json();
        if (result.success) {
            showSuccess(`Billing for ${display} generated!`);
            loadAdminData();
        } else {
            showError(result.error || 'Failed to generate billing');
        }
    } catch {
        showError('Failed to generate billing. Please try again.');
    }
});

// ── Logout ───────────────────────────────────────────────────────────────────

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('isAdmin');
    window.location.href = 'index.html';
});

// ── Close modal on backdrop click ────────────────────────────────────────────

window.addEventListener('click', e => {
    const modal = document.getElementById('tenantModal');
    if (modal && e.target === modal) closeTenantModal();
});

// ── Auto-refresh & init ──────────────────────────────────────────────────────

let autoRefreshInterval;

function startAutoRefresh() {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(loadAdminData, 30000);
}

async function triggerAutoGenerateCheck() {
    try {
        await fetch('/api/admin/auto-generate-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    } catch { /* non-critical */ }
}

document.addEventListener('DOMContentLoaded', () => {
    loadAdminData();
    startAutoRefresh();
    setTimeout(triggerAutoGenerateCheck, 1200);
    setInterval(triggerAutoGenerateCheck, 3_600_000);
});
