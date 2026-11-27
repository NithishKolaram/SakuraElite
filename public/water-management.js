if (!sessionStorage.getItem('isAdmin')) {
    window.location.href = 'index.html';
}

const now = new Date();
const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthNamesShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

let pricePerLiter = 0;

document.getElementById('currentMonthDisplay').textContent =
    `${monthNamesShort[now.getMonth()]} ${now.getFullYear()}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRupees(amount) {
    return `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN');
}

function ordinalSuffix(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function monthYearToLabel(monthYear) {
    const [mm, yyyy] = monthYear.split('/');
    return `${monthNamesShort[parseInt(mm, 10) - 1]} ${yyyy}`;
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

// ── Summary ───────────────────────────────────────────────────────────────────

async function loadSummary() {
    try {
        const res = await fetch(`/api/water/summary?monthYear=${encodeURIComponent(currentMonth)}`);
        const result = await res.json();
        if (result.success) {
            const d = result.data;
            pricePerLiter = d.price_per_liter;
            document.getElementById('totalTankers').textContent = d.total_tankers;
            document.getElementById('totalLiters').textContent = `${d.total_liters.toLocaleString('en-IN')} L`;
            document.getElementById('totalCost').textContent = formatRupees(d.total_cost);
            document.getElementById('pricePerLiter').textContent = `${formatRupees(d.price_per_liter)}/L`;
        }
    } catch (err) {
        console.error('Summary load error:', err);
    }
}

// ── Tanker history ────────────────────────────────────────────────────────────

async function loadTankerHistory(monthYear) {
    const filterMonth = monthYear || currentMonth;
    const isCurrentMonth = filterMonth === currentMonth;

    const label = document.getElementById('tankerMonthLabel');
    if (label) label.textContent = `(${monthYearToLabel(filterMonth)})`;

    const backBtn   = document.getElementById('backToCurrentBtn');
    const filterBtn = document.getElementById('viewOlderTankersBtn');
    if (backBtn)   backBtn.style.display   = isCurrentMonth ? 'none' : '';
    if (filterBtn) filterBtn.style.display = isCurrentMonth ? '' : 'none';

    try {
        const res = await fetch(`/api/water/tankers?monthYear=${encodeURIComponent(filterMonth)}`);
        const result = await res.json();
        const tbody = document.getElementById('tankerHistoryBody');
        if (!tbody) return;

        const rows = (result.data || []).filter(t => t.month_year === filterMonth);

        if (!result.success || rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No tankers found for this month</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(t => `
            <tr>
                <td data-label="Date">${formatDate(t.tanker_date)}</td>
                <td data-label="Month">${t.month_year}</td>
                <td data-label="Liters">${parseInt(t.liters).toLocaleString('en-IN')} L</td>
                <td data-label="Cost">${formatRupees(t.cost)}</td>
                <td data-label="Notes">${t.notes || '—'}</td>
                <td data-label="Action">
                    <button class="action-btn" onclick="deleteTanker(${t.id})" style="color:#e53e3e;border-color:#fed7d7;">Delete</button>
                </td>
            </tr>`).join('');
    } catch (err) {
        console.error('Tanker history error:', err);
    }
}

// ── Meter readings ────────────────────────────────────────────────────────────

async function loadMeterReadings() {
    try {
        const res = await fetch(`/api/water/readings?monthYear=${encodeURIComponent(currentMonth)}`);
        const result = await res.json();
        const tbody = document.getElementById('meterReadingsBody');
        if (!tbody) return;

        if (!result.success || result.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Initialising meter readings…</td></tr>`;
            try {
                const initRes = await fetch('/api/water/initialize-readings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ month_year: currentMonth })
                });
                const initResult = await initRes.json();
                if (initResult.success && initResult.data.length > 0) {
                    renderReadings(initResult.data, tbody);
                } else {
                    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No units found</td></tr>';
                }
            } catch {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Failed to initialise readings</td></tr>';
            }
            return;
        }

        renderReadings(result.data, tbody);
    } catch (err) {
        console.error('Meter readings error:', err);
    }
}

function renderReadings(data, tbody) {
    tbody.innerHTML = data.map(r => {
        const start  = parseInt(r.start_reading) || 0;
        const end    = parseInt(r.end_reading)   || start;
        const liters = Math.max(0, end - start);
        const cost   = liters * pricePerLiter;
        const unit   = r.unit_number;

        return `
        <tr id="row-${unit}">
            <td data-label="Unit"><strong class="unit-tag">${unit}</strong></td>
            <td data-label="Start (prev month)" style="color:var(--text-muted);">${start.toLocaleString('en-IN')}</td>
            <td data-label="End Reading" style="display:flex;gap:6px;align-items:center;">
                <input
                    type="number"
                    id="input-${unit}"
                    value="${end}"
                    min="${start}"
                    class="inline-edit"
                    style="width:90px;"
                    placeholder="Reading">
                <button
                    class="action-btn"
                    onclick="saveReading('${unit}')"
                    style="padding:4px 10px;font-size:12px;white-space:nowrap;">
                    Save
                </button>
            </td>
            <td data-label="Liters Used" id="liters-${unit}"><strong>${parseInt(liters).toLocaleString('en-IN')} L</strong></td>
            <td data-label="Cost" id="cost-${unit}"><strong style="color:var(--green);">${formatRupees(cost)}</strong></td>
        </tr>`;
    }).join('');
}

// Called by Save button — uses unit_number + month_year, no id needed
window.saveReading = async function(unitNumber) {
    const input = document.getElementById(`input-${unitNumber}`);
    if (!input) return;

    const value = parseInt(input.value, 10);
    if (isNaN(value)) { showError('Please enter a valid number'); return; }

    input.disabled = true;
    input.style.outline = '2px solid var(--primary, #6366f1)';

    try {
        const res = await fetch('/api/water/reading-by-unit', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                unit_number: unitNumber,
                month_year:  currentMonth,
                end_reading: value
            })
        });

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error(`Server returned non-JSON (status ${res.status}). Please restart the server and try again.`);
        }

        const result = await res.json();

        if (result.success) {
            input.style.outline = '2px solid #48bb78';
            showSuccess(`${unitNumber} reading saved`);
            setTimeout(() => {
                input.style.outline = '';
                input.disabled = false;
            }, 600);
            await loadSummary();
            await loadMeterReadings();
            await autoCalculateBills();
        } else {
            showError(result.error || 'Failed to update reading');
            input.style.outline = '2px solid #e53e3e';
            setTimeout(() => { input.style.outline = ''; input.disabled = false; }, 1000);
        }
    } catch (err) {
        console.error('Save reading error:', err);
        showError(err.message || 'Network error — reading not saved');
        input.style.outline = '2px solid #e53e3e';
        setTimeout(() => { input.style.outline = ''; input.disabled = false; }, 1000);
    }
};

// ── Auto calculate bills ──────────────────────────────────────────────────────

async function autoCalculateBills() {
    try {
        await fetch('/api/water/calculate-bills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month_year: currentMonth })
        });
    } catch (err) {
        console.error('Auto calculate bills error:', err);
    }
}

// ── Add tanker ────────────────────────────────────────────────────────────────

document.getElementById('addTankerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    let notes = document.getElementById('tankerNotes').value.trim();
    if (!notes) {
        try {
            const countRes = await fetch(`/api/water/tankers?monthYear=${encodeURIComponent(currentMonth)}`);
            const countResult = await countRes.json();
            const existingCount = countResult.success
                ? (countResult.data || []).filter(t => t.month_year === currentMonth).length
                : 0;
            notes = `This is the ${ordinalSuffix(existingCount + 1)} tanker for ${monthNamesShort[now.getMonth()]} ${now.getFullYear()}`;
        } catch {
            notes = '';
        }
    }

    const data = {
        month_year:  currentMonth,
        tanker_date: document.getElementById('tankerDate').value,
        liters:      parseInt(document.getElementById('tankerLiters').value),
        cost:        parseFloat(document.getElementById('tankerCost').value),
        notes
    };
    try {
        const res = await fetch('/api/water/tanker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            showSuccess('Tanker added!');
            e.target.reset();
            await loadAll();
            await autoCalculateBills();
        } else {
            showError(result.error || 'Failed to add tanker');
        }
    } catch { showError('Failed to add tanker'); }
});

// ── Delete tanker ─────────────────────────────────────────────────────────────

window.deleteTanker = async function(id) {
    if (!confirm('Delete this tanker entry?')) return;
    try {
        const res = await fetch(`/api/water/tanker/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            showSuccess('Tanker deleted');
            await loadAll();
            await autoCalculateBills();
        } else {
            showError(result.error || 'Failed to delete');
        }
    } catch { showError('Failed to delete tanker'); }
};

// ── Filter modal ──────────────────────────────────────────────────────────────

const modal = document.getElementById('olderTankersModal');

function populateFilterDropdowns() {
    const monthSel = document.getElementById('filterMonthSelect');
    const yearSel  = document.getElementById('filterYearSelect');
    if (!monthSel || !yearSel) return;

    // Populate months
    monthSel.innerHTML = monthNames.map((name, i) => {
        const val = String(i + 1).padStart(2, '0');
        return `<option value="${val}">${name}</option>`;
    }).join('');

    // Populate years from 2020 to last year
    const lastYear = now.getFullYear() - 1;
    yearSel.innerHTML = '';
    for (let y = lastYear; y >= 2020; y--) {
        yearSel.innerHTML += `<option value="${y}">${y}</option>`;
    }

    // Default to previous month
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    monthSel.value = String(prev.getMonth() + 1).padStart(2, '0');
    yearSel.value  = String(prev.getFullYear());
}

document.getElementById('viewOlderTankersBtn')?.addEventListener('click', () => {
    populateFilterDropdowns();
    modal.style.display = 'flex';
});

document.getElementById('backToCurrentBtn')?.addEventListener('click', () => {
    loadTankerHistory();
});

document.getElementById('olderTankersCancelBtn')?.addEventListener('click', () => {
    modal.style.display = 'none';
});

document.getElementById('olderTankersViewBtn')?.addEventListener('click', () => {
    const mm   = document.getElementById('filterMonthSelect').value;
    const yyyy = document.getElementById('filterYearSelect').value;
    if (!mm || !yyyy) { showError('Please select a month and year'); return; }
    modal.style.display = 'none';
    loadTankerHistory(`${mm}/${yyyy}`);
});

modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
});

// ── Navigation ────────────────────────────────────────────────────────────────

document.getElementById('backBtn')?.addEventListener('click', () => {
    window.location.href = 'admin.html';
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('isAdmin');
    window.location.href = 'index.html';
});

// ── Load all ──────────────────────────────────────────────────────────────────

async function loadAll() {
    await loadSummary();
    loadTankerHistory();
    loadMeterReadings();
}

window.addEventListener('load', () => {
    loadAll();
    setInterval(loadAll, 60000);
});
