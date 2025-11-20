// Get unit number from session storage
const unitNumber = sessionStorage.getItem('unitNumber');

if (!unitNumber) {
    window.location.href = 'index.html';
}

// Display unit number in header
document.getElementById('unitDisplay').textContent = `Unit: ${unitNumber}`;

// Current month index for navigation
let currentMonthIndex = 0;
let historyData = [];

// Format currency in rupees
function formatRupees(amount) {
    return `₹${parseFloat(amount).toFixed(2)}`;
}

// Format month/year display
function formatMonthYear(monthYear) {
    const [month, year] = monthYear.split('/');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
}

// Load unit details
async function loadUnitDetails() {
    try {
        const response = await fetch(`http://localhost:3000/api/unit/${unitNumber}`);
        const result = await response.json();

        if (result.success) {
            const data = result.data;

            document.getElementById('loading').style.display = 'none';
            document.getElementById('unitInfo').style.display = 'block';

            // Populate unit information
            document.getElementById('unitNumber').textContent = data.unit_number;
            document.getElementById('numTenants').textContent = data.num_tenants || 0;
            document.getElementById('numCars').textContent = data.num_cars || 0;

            // Populate tenant names
            const tenantsList = document.getElementById('tenantsList');
            const tenants = data.tenant_names ? data.tenant_names.split(',') : [];
            
            if (tenants.length > 0 && tenants[0] !== '') {
                tenantsList.innerHTML = tenants.map(name => 
                    `<div class="tenant-item">${name.trim()}</div>`
                ).join('');
            } else {
                tenantsList.innerHTML = '<p class="no-data">No tenants listed</p>';
            }

            // Load payment history
            loadPaymentHistory();

        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('errorMessage').textContent = 
            'Failed to load unit information. Please try again.';
        document.getElementById('errorMessage').style.display = 'block';
    }
}

// Load payment history
async function loadPaymentHistory() {
    try {
        const response = await fetch(`http://localhost:3000/api/unit/${unitNumber}/history`);
        const result = await response.json();

        if (result.success) {
            historyData = result.data;
            displayMonthlyData(0);
            populateHistoryTable();
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Display data for a specific month
function displayMonthlyData(index) {
    if (historyData.length === 0) {
        document.getElementById('monthlyData').innerHTML = '<p class="no-data">No payment history available</p>';
        return;
    }

    currentMonthIndex = index;
    const monthData = historyData[index];

    // Update month display
    document.getElementById('currentMonth').textContent = formatMonthYear(monthData.month_year);

    // Update navigation buttons
    document.getElementById('prevMonth').disabled = index === historyData.length - 1;
    document.getElementById('nextMonth').disabled = index === 0;

    // Display monthly data
    const rent = parseFloat(monthData.rent) || 0;
    const waterBill = parseFloat(monthData.water_bill) || 0;
    const total = rent + waterBill;

    document.getElementById('monthlyData').innerHTML = `
        <div class="info-grid">
            <div class="info-item">
                <span class="label">Monthly Rent:</span>
                <span class="value amount">${formatRupees(rent)}</span>
            </div>
            <div class="info-item">
                <span class="label">Water Bill:</span>
                <span class="value amount">${formatRupees(waterBill)}</span>
            </div>
            <div class="info-item">
                <span class="label">Total Due:</span>
                <span class="value amount total">${formatRupees(total)}</span>
            </div>
            <div class="info-item">
                <span class="label">Status:</span>
                <span class="value status-${monthData.status}">${monthData.status.charAt(0).toUpperCase() + monthData.status.slice(1)}</span>
            </div>
            ${monthData.paid_date ? `
            <div class="info-item">
                <span class="label">Paid On:</span>
                <span class="value">${new Date(monthData.paid_date).toLocaleDateString('en-IN')}</span>
            </div>
            <div class="info-item">
                <span class="label">Payment Method:</span>
                <span class="value">${monthData.payment_method}</span>
            </div>
            ` : ''}
        </div>
    `;
}

// Populate complete history table
function populateHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    
    if (historyData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No payment history available</td></tr>';
        return;
    }

    tbody.innerHTML = historyData.map(record => {
        const rent = parseFloat(record.rent) || 0;
        const waterBill = parseFloat(record.water_bill) || 0;
        const total = rent + waterBill;
        const paidDate = record.paid_date ? new Date(record.paid_date).toLocaleDateString('en-IN') : '-';
        const paymentMethod = record.payment_method || '-';

        return `
            <tr>
                <td>${formatMonthYear(record.month_year)}</td>
                <td>${formatRupees(rent)}</td>
                <td>${formatRupees(waterBill)}</td>
                <td><strong>${formatRupees(total)}</strong></td>
                <td><span class="status-${record.status}">${record.status.charAt(0).toUpperCase() + record.status.slice(1)}</span></td>
                <td>${paidDate}</td>
                <td>${paymentMethod}</td>
            </tr>
        `;
    }).join('');
}

// Load unit details on page load
loadUnitDetails();

// Navigation buttons
document.getElementById('prevMonth').addEventListener('click', () => {
    if (currentMonthIndex < historyData.length - 1) {
        displayMonthlyData(currentMonthIndex + 1);
    }
});

document.getElementById('nextMonth').addEventListener('click', () => {
    if (currentMonthIndex > 0) {
        displayMonthlyData(currentMonthIndex - 1);
    }
});

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('unitNumber');
    window.location.href = 'index.html';
});