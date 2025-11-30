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
let unitData = {};

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

// RAZORPAY PAYMENT INTEGRATION

// Initiate payment for current month
async function initiatePayment(paymentId, monthYear) {
    try {
        // Check if Razorpay is loaded
        if (typeof Razorpay === 'undefined') {
            showError('Payment gateway not loaded. Please refresh the page.');
            return;
        }
        
        // Create order on server
        const response = await fetch('http://localhost:3000/api/payment/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                payment_id: paymentId,
                unit_number: unitNumber,
                month_year: monthYear
            })
        });
        
        const orderData = await response.json();
        
        if (!orderData.success) {
            showError(orderData.error || 'Failed to create payment order');
            return;
        }
        
        // Get tenant name for prefill
        const tenantName = unitData.tenant_names ? unitData.tenant_names.split(',')[0].trim() : '';
        
        // Razorpay options
        const options = {
            key: orderData.key_id,
            amount: orderData.amount,
            currency: orderData.currency,
            name: 'Sakura Elite',
            description: `Payment for ${formatMonthYear(monthYear)} - Unit ${unitNumber}`,
            order_id: orderData.order_id,
            prefill: {
                name: tenantName,
                contact: '',
                email: ''
            },
            theme: {
                color: '#667eea'
            },
            handler: async function(response) {
                // Payment successful, verify on server
                await verifyPayment(response, paymentId);
            },
            modal: {
                ondismiss: function() {
                    showError('Payment cancelled');
                }
            }
        };
        
        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response) {
            showError('Payment failed: ' + response.error.description);
        });
        rzp.open();
        
    } catch (error) {
        console.error('Payment error:', error);
        showError('Failed to initiate payment. Please try again.');
    }
}

// Verify payment with server
async function verifyPayment(razorpayResponse, paymentId) {
    try {
        showSuccess('Verifying payment...');
        
        const response = await fetch('http://localhost:3000/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                razorpay_order_id: razorpayResponse.razorpay_order_id,
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_signature: razorpayResponse.razorpay_signature,
                payment_id: paymentId,
                unit_number: unitNumber
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('🎉 Payment successful! Your payment has been recorded.');
            // Reload payment history to show updated status
            setTimeout(() => {
                loadPaymentHistory();
            }, 1500);
        } else {
            showError(result.error || 'Payment verification failed. Please contact admin.');
        }
        
    } catch (error) {
        console.error('Verification error:', error);
        showError('Failed to verify payment. Please contact admin with your transaction ID.');
    }
}

// Make initiatePayment globally accessible
window.initiatePayment = initiatePayment;

// Load unit details
async function loadUnitDetails() {
    try {
        const response = await fetch(`http://localhost:3000/api/unit/${unitNumber}`);
        const result = await response.json();

        if (result.success) {
            unitData = result.data;

            document.getElementById('loading').style.display = 'none';
            document.getElementById('unitInfo').style.display = 'block';

            // Populate unit information
            document.getElementById('unitNumber').textContent = unitData.unit_number;
            document.getElementById('numTenants').textContent = unitData.num_tenants || 0;
            document.getElementById('numCars').textContent = unitData.num_cars || 0;
            document.getElementById('numTwoWheelers').textContent = unitData.num_two_wheelers || 0;

            // Populate tenant names
            displayTenantNames();

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

// Display tenant names
function displayTenantNames() {
    const tenantsList = document.getElementById('tenantsList');
    const tenants = unitData.tenant_names ? unitData.tenant_names.split(',').filter(n => n.trim()) : [];
    
    if (tenants.length === 0) {
        tenantsList.innerHTML = '<div class="no-tenants">No tenant names added yet. Click "Edit Tenant Names" to add them.</div>';
    } else {
        tenantsList.innerHTML = tenants.map((name, index) => `
            <div class="tenant-item-modern">
                <div class="tenant-icon">${name.trim().charAt(0).toUpperCase()}</div>
                <span>${name.trim()}</span>
            </div>
        `).join('');
    }
}

// Open tenant edit modal
document.getElementById('editTenantsBtn').addEventListener('click', () => {
    const tenants = unitData.tenant_names ? unitData.tenant_names.split(',') : [];
    document.getElementById('tenantEditTextarea').value = tenants.join('\n');
    document.getElementById('tenantEditModal').style.display = 'block';
});

// Close tenant edit modal
window.closeTenantEditModal = function() {
    document.getElementById('tenantEditModal').style.display = 'none';
}

// Save tenant names from modal
window.saveTenantNamesFromModal = async function() {
    const textarea = document.getElementById('tenantEditTextarea');
    const names = textarea.value.split('\n').filter(name => name.trim()).join(',');
    const tenantCount = names ? names.split(',').length : 0;
    
    try {
        const response = await fetch(`http://localhost:3000/api/unit/${unitNumber}/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                tenant_names: names,
                num_tenants: tenantCount
            })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Tenant names saved and count updated successfully!');
            unitData.tenant_names = names;
            unitData.num_tenants = tenantCount;
            document.getElementById('numTenants').textContent = tenantCount;
            displayTenantNames();
            closeTenantEditModal();
        } else {
            showError(result.error || 'Failed to save tenant names');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to save tenant names');
    }
}

// Open cars edit modal
document.getElementById('editCarsBtn').addEventListener('click', () => {
    document.getElementById('carsEditInput').value = unitData.num_cars || 0;
    document.getElementById('carsEditModal').style.display = 'block';
});

// Close cars edit modal
window.closeCarsEditModal = function() {
    document.getElementById('carsEditModal').style.display = 'none';
}

// Save cars from modal
window.saveCarsFromModal = async function() {
    const carsInput = document.getElementById('carsEditInput');
    const numCars = parseInt(carsInput.value) || 0;
    
    try {
        const response = await fetch(`http://localhost:3000/api/unit/${unitNumber}/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ num_cars: numCars })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Number of cars updated successfully!');
            unitData.num_cars = numCars;
            document.getElementById('numCars').textContent = numCars;
            closeCarsEditModal();
        } else {
            showError(result.error || 'Failed to update cars');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to update cars');
    }
}

// Open two-wheelers edit modal
document.getElementById('editTwoWheelersBtn').addEventListener('click', () => {
    document.getElementById('twoWheelersEditInput').value = unitData.num_two_wheelers || 0;
    document.getElementById('twoWheelersEditModal').style.display = 'block';
});

// Close two-wheelers edit modal
window.closeTwoWheelersEditModal = function() {
    document.getElementById('twoWheelersEditModal').style.display = 'none';
}

// Save two-wheelers from modal
window.saveTwoWheelersFromModal = async function() {
    const twoWheelersInput = document.getElementById('twoWheelersEditInput');
    const numTwoWheelers = parseInt(twoWheelersInput.value) || 0;
    
    try {
        const response = await fetch(`http://localhost:3000/api/unit/${unitNumber}/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ num_two_wheelers: numTwoWheelers })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Number of two-wheelers updated successfully!');
            unitData.num_two_wheelers = numTwoWheelers;
            document.getElementById('numTwoWheelers').textContent = numTwoWheelers;
            closeTwoWheelersEditModal();
        } else {
            showError(result.error || 'Failed to update two-wheelers');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to update two-wheelers');
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
            populateFilterDropdowns();
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Display data for a specific month with Pay Now button
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
    const maintenance = parseFloat(monthData.maintenance) || 0;
    const corpus = parseFloat(monthData.corpus) || 0;
    const total = rent + waterBill + maintenance + corpus;

    // Add Pay Now button for pending payments
    const payButton = monthData.status === 'pending' 
        ? `<button onclick="initiatePayment(${monthData.id}, '${monthData.month_year}')" 
            class="primary-btn" style="margin-top: 16px; width: 100%; font-size: 16px; padding: 14px;">
            Pay Now - ${formatRupees(total)}
          </button>`
        : '';

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
                <span class="label">Maintenance:</span>
                <span class="value amount">${formatRupees(maintenance)}</span>
            </div>
            <div class="info-item">
                <span class="label">Corpus Fund:</span>
                <span class="value amount">${formatRupees(corpus)}</span>
            </div>
            <div class="info-item">
                <span class="label">Total Due:</span>
                <span class="value amount total">${formatRupees(total)}</span>
            </div>
            <div class="info-item">
                <span class="label">Status:</span>
                <span class="value status-${monthData.status}">
                    ${monthData.status === 'paid' ? '✓ Paid' : 'Pending'}
                </span>
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
        ${payButton}
    `;
}

// Filter state
let currentFilterMonth = '';
let currentFilterYear = '';

// Populate complete history table with Pay Now buttons
function populateHistoryTable(dataToDisplay = null) {
    const tbody = document.getElementById('historyTableBody');
    const data = dataToDisplay || historyData;
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center;">No payment history available</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(record => {
        const rent = parseFloat(record.rent) || 0;
        const waterBill = parseFloat(record.water_bill) || 0;
        const maintenance = parseFloat(record.maintenance) || 0;
        const corpus = parseFloat(record.corpus) || 0;
        const total = rent + waterBill + maintenance + corpus;
        const paidDate = record.paid_date ? new Date(record.paid_date).toLocaleDateString('en-IN') : '-';
        const paymentMethod = record.payment_method || '-';

        const payButton = record.status === 'pending'
            ? `<button onclick="initiatePayment(${record.id}, '${record.month_year}')" 
                class="primary-btn" style="padding: 8px 16px; font-size: 13px;">
                Pay Now
              </button>`
            : '<span style="color: #28a745; font-weight: 600;">✓ Paid</span>';

        return `
            <tr>
                <td><strong>${formatMonthYear(record.month_year)}</strong></td>
                <td>${formatRupees(rent)}</td>
                <td>${formatRupees(waterBill)}</td>
                <td>${formatRupees(maintenance)}</td>
                <td>${formatRupees(corpus)}</td>
                <td><strong>${formatRupees(total)}</strong></td>
                <td><span class="status-${record.status}">${record.status.charAt(0).toUpperCase() + record.status.slice(1)}</span></td>
                <td>${paidDate}</td>
                <td>${paymentMethod}</td>
                <td>${payButton}</td>
            </tr>
        `;
    }).join('');
}

// Apply filters to history table
function applyHistoryFilters() {
    let filtered = historyData;

    if (currentFilterMonth || currentFilterYear) {
        filtered = historyData.filter(record => {
            const [month, year] = record.month_year.split('/');
            let matchMonth = true;
            let matchYear = true;

            if (currentFilterMonth) {
                matchMonth = month === currentFilterMonth;
            }

            if (currentFilterYear) {
                matchYear = year === currentFilterYear;
            }

            return matchMonth && matchYear;
        });
    }

    populateHistoryTable(filtered);
}

// Populate filter dropdowns
function populateFilterDropdowns() {
    const months = new Set();
    const years = new Set();

    historyData.forEach(record => {
        const [month, year] = record.month_year.split('/');
        months.add(parseInt(month));
        years.add(parseInt(year));
    });

    const monthSelect = document.getElementById('searchMonth');
    const yearSelect = document.getElementById('searchYear');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Add month options
    Array.from(months).sort((a, b) => b - a).forEach(month => {
        const option = document.createElement('option');
        option.value = String(month).padStart(2, '0');
        option.textContent = monthNames[month - 1];
        monthSelect.appendChild(option);
    });

    // Add year options
    Array.from(years).sort((a, b) => b - a).forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });
}

// Show messages
function showSuccess(message) {
    const el = document.createElement('div');
    el.className = 'success-message';
    el.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #d4edda; color: #155724; padding: 16px 20px; border-radius: 8px; border: 1px solid #c3e6cb; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.1);';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function showError(message) {
    const el = document.createElement('div');
    el.className = 'error-message';
    el.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #fff3cd; color: #856404; padding: 16px 20px; border-radius: 8px; border: 1px solid #ffeaa7; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.1);';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
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

// Filter event listeners
document.getElementById('searchMonth').addEventListener('change', (e) => {
    currentFilterMonth = e.target.value;
    applyHistoryFilters();
});

document.getElementById('searchYear').addEventListener('change', (e) => {
    currentFilterYear = e.target.value;
    applyHistoryFilters();
});

document.getElementById('clearSearch').addEventListener('click', () => {
    currentFilterMonth = '';
    currentFilterYear = '';
    document.getElementById('searchMonth').value = '';
    document.getElementById('searchYear').value = '';
    populateHistoryTable();
});

// Close modals when clicking outside
window.onclick = function(event) {
    const tenantModal = document.getElementById('tenantEditModal');
    const carsModal = document.getElementById('carsEditModal');
    const twoWheelersModal = document.getElementById('twoWheelersEditModal');
    
    if (event.target === tenantModal) {
        closeTenantEditModal();
    }
    if (event.target === carsModal) {
        closeCarsEditModal();
    }
    if (event.target === twoWheelersModal) {
        closeTwoWheelersEditModal();
    }
}
