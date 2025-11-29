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

let pricePerLiter = 0;

// Format currency
function formatRupees(amount) {
    return `₹${parseFloat(amount).toFixed(2)}`;
}

// Format date
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN');
}

// Load summary
async function loadSummary() {
    try {
        const response = await fetch(`http://localhost:3000/api/water/summary?monthYear=${encodeURIComponent(currentMonth)}`);
        const result = await response.json();

        if (result.success) {
            const data = result.data;
            document.getElementById('totalTankers').textContent = data.total_tankers;
            document.getElementById('totalLiters').textContent = `${data.total_liters} L`;
            document.getElementById('totalCost').textContent = formatRupees(data.total_cost);
            
            pricePerLiter = data.price_per_liter;
            document.getElementById('pricePerLiter').textContent = `${formatRupees(data.price_per_liter)}/L`;
            
            // After loading summary, refresh meter readings to show updated costs
            loadMeterReadings();
        }
    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

// Load tanker history
async function loadTankerHistory() {
    try {
        const response = await fetch('http://localhost:3000/api/water/tankers');
        const result = await response.json();

        if (result.success) {
            const tbody = document.getElementById('tankerHistoryBody');
            
            if (result.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No tankers added yet</td></tr>';
                return;
            }

            tbody.innerHTML = result.data.map(tanker => `
                <tr>
                    <td>${formatDate(tanker.tanker_date)}</td>
                    <td>${tanker.month_year}</td>
                    <td>${tanker.liters} L</td>
                    <td>${formatRupees(tanker.cost)}</td>
                    <td>${tanker.notes || '-'}</td>
                    <td>
                        <button class="action-btn" onclick="deleteTanker(${tanker.id})">Delete</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading tankers:', error);
    }
}

// Load meter readings
async function loadMeterReadings() {
    try {
        const response = await fetch(`http://localhost:3000/api/water/readings?monthYear=${encodeURIComponent(currentMonth)}`);
        const result = await response.json();

        if (result.success) {
            const tbody = document.getElementById('meterReadingsBody');
            
            if (result.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No meter readings yet</td></tr>';
                return;
            }

            tbody.innerHTML = result.data.map(reading => {
                // Calculate cost based on current price per liter
                const litersConsumed = reading.liters_consumed || 0;
                const cost = litersConsumed * pricePerLiter;
                
                return `
                    <tr>
                        <td><strong>${reading.unit_number}</strong></td>
                        <td><input type="number" value="${reading.start_reading}" 
                            onchange="updateReading(${reading.id}, 'start_reading', this.value)" class="inline-edit"></td>
                        <td><input type="number" value="${reading.end_reading}" 
                            onchange="updateReading(${reading.id}, 'end_reading', this.value)" class="inline-edit"></td>
                        <td><strong>${litersConsumed} L</strong></td>
                        <td><strong>${formatRupees(cost)}</strong></td>
                    </tr>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading readings:', error);
    }
}

// Add tanker
document.getElementById('addTankerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        month_year: currentMonth,
        tanker_date: document.getElementById('tankerDate').value,
        liters: parseInt(document.getElementById('tankerLiters').value),
        cost: parseFloat(document.getElementById('tankerCost').value),
        notes: document.getElementById('tankerNotes').value
    };

    try {
        const response = await fetch('http://localhost:3000/api/water/tanker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Tanker added successfully!');
            document.getElementById('addTankerForm').reset();
            loadAll();
        } else {
            showError(result.error || 'Failed to add tanker');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to add tanker');
    }
});

// Delete tanker
window.deleteTanker = async function(id) {
    if (!confirm('Are you sure you want to delete this tanker?')) return;

    try {
        const response = await fetch(`http://localhost:3000/api/water/tanker/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Tanker deleted successfully!');
            loadAll();
        } else {
            showError(result.error || 'Failed to delete tanker');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to delete tanker');
    }
}

// Update meter reading
window.updateReading = async function(id, field, value) {
    try {
        const response = await fetch(`http://localhost:3000/api/water/reading/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: parseInt(value) })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Reading updated');
            // Reload to recalculate liters consumed
            loadMeterReadings();
        } else {
            showError(result.error || 'Failed to update');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to update reading');
    }
}

// Calculate and update water bills - NOW UPDATES PAYMENT_HISTORY TABLE
document.getElementById('calculateWaterBillsBtn').addEventListener('click', async () => {
    // if (!confirm('This will calculate water bills based on meter readings and update payment_history table for all units. Continue?')) return;

    try {
        const response = await fetch('http://localhost:3000/api/water/calculate-bills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month_year: currentMonth })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Water bills calculated and updated in payment_history successfully!');
            loadAll();
        } else {
            showError(result.error || 'Failed to calculate bills');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to calculate bills');
    }
});

// Load all data 
function loadAll() {
    // Load summary first, then it will trigger meter readings reload
    loadSummary();
    loadTankerHistory();
}

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

// Load on page load
loadAll();