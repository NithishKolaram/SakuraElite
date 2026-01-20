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

// Get current month/year in MM/YYYY format
function getCurrentMonthYear() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${month}/${year}`;
}

// Parse month/year string to Date object for sorting
function parseMonthYear(monthYear) {
    const [month, year] = monthYear.split('/');
    return new Date(parseInt(year), parseInt(month) - 1, 1);
}

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
        const response = await fetch('/api/payment/create-order', {
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
        
        const response = await fetch('/api/payment/verify', {
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
        const response = await fetch(`/api/unit/${unitNumber}`);
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
        const response = await fetch(`/api/unit/${unitNumber}/update`, {
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
        const response = await fetch(`/api/unit/${unitNumber}/update`, {
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
        const response = await fetch(`/api/unit/${unitNumber}/update`, {
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
        const response = await fetch(`/api/unit/${unitNumber}/history`);
        const result = await response.json();

        if (result.success) {
            // Sort the data by date (newest first) on the client side
            historyData = result.data.sort((a, b) => {
                const dateA = parseMonthYear(a.month_year);
                const dateB = parseMonthYear(b.month_year);
                return dateB - dateA; // Descending order (newest first)
            });
            
            // Find the index of the current month or most recent month
            const currentMonthYear = getCurrentMonthYear();
            const currentMonthIndex = historyData.findIndex(record => record.month_year === currentMonthYear);
            
            // If current month exists, show it; otherwise show the most recent (index 0)
            const indexToShow = currentMonthIndex >= 0 ? currentMonthIndex : 0;
            
            displayMonthlyData(indexToShow);
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
                <span class="value">${monthData.payment_method || '-'}</span>
            </div>
            ` : ''}
        </div>
        ${payButton}
    `;
}

// Filter state
let currentFilterMonth = '';
let currentFilterYear = '';

// Populate filter dropdowns with unique values - FIXED DUPLICATE ISSUE
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

    // Clear existing options (except the first placeholder)
    while (monthSelect.options.length > 1) {
        monthSelect.remove(1);
    }
    while (yearSelect.options.length > 1) {
        yearSelect.remove(1);
    }

    // Add month options (sorted descending - newest first)
    Array.from(months)
        .sort((a, b) => b - a)
        .forEach(month => {
            const option = document.createElement('option');
            option.value = String(month).padStart(2, '0');
            option.textContent = monthNames[month - 1];
            monthSelect.appendChild(option);
        });

    // Add year options (sorted descending - newest first, no duplicates)
    Array.from(years)
        .sort((a, b) => b - a)
        .forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
}

// Populate complete history table with enhanced styling
function populateHistoryTable(dataToDisplay = null) {
    const tbody = document.getElementById('historyTableBody');
    const footer = document.getElementById('historyTableFooter');
    const filteredCountEl = document.getElementById('filteredCount');
    const totalCountEl = document.getElementById('totalCount');
    
    const data = dataToDisplay || historyData;
    const totalRecords = historyData.length;
    const filteredRecords = data.length;
    
    // Update counts
    if (filteredCountEl) filteredCountEl.textContent = filteredRecords;
    if (totalCountEl) totalCountEl.textContent = totalRecords;
    
    // Show/hide footer
    if (footer) {
        footer.style.display = totalRecords > 0 ? 'table-row-group' : 'none';
    }
    
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px;">
                    <div class="no-data-state">
                        <div style="font-size: 48px; margin-bottom: 16px; color: #e0e0e0;">📊</div>
                        <h3 style="color: #666; margin-bottom: 8px;">No payment records found</h3>
                        <p style="color: #999;">
                            ${filteredRecords === 0 && totalRecords > 0 
                                ? 'Try changing your filters' 
                                : 'Your payment history will appear here'}
                        </p>
                    </div>
                </td>
            </tr>
        `;
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
        
        // Format payment method badge
        const paymentMethodBadge = paymentMethod !== '-' 
            ? `<span class="payment-method">${paymentMethod}</span>`
            : '-';

        // Pay Now button for pending payments
        const payButton = record.status === 'pending'
            ? `<button onclick="initiatePayment(${record.id}, '${record.month_year}')" 
                class="pay-now-btn">
                💳 Pay Now
              </button>`
            : `<div class="status-paid">✓ Paid</div>`;

        return `
            <tr>
                <td>
                    <div style="font-weight: 600; color: #1a1a1a;">${formatMonthYear(record.month_year)}</div>
                    <div style="font-size: 11px; color: #999; margin-top: 2px;">${record.month_year}</div>
                </td>
                <td class="amount-cell">${formatRupees(rent)}</td>
                <td class="amount-cell">${formatRupees(waterBill)}</td>
                <td class="amount-cell">${formatRupees(maintenance)}</td>
                <td class="amount-cell">${formatRupees(corpus)}</td>
                <td class="total-amount">${formatRupees(total)}</td>
                <td>
                    ${record.status === 'paid' 
                        ? '<span class="status-paid">Paid</span>' 
                        : '<span class="status-pending">Pending</span>'
                    }
                </td>
                <td>${paidDate}</td>
                <td>${paymentMethodBadge}</td>
                <td>
                    ${record.status === 'pending' ? payButton : '-'}
                </td>
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

// Export history to CSV
document.getElementById('exportHistoryBtn')?.addEventListener('click', function() {
    exportHistoryToCSV();
});

function exportHistoryToCSV() {
    if (historyData.length === 0) {
        showError('No data to export');
        return;
    }
    
    let csvContent = "Month/Year,Rent,Water Bill,Maintenance,Corpus,Total,Status,Paid Date,Payment Method\n";
    
    historyData.forEach(record => {
        const rent = parseFloat(record.rent) || 0;
        const waterBill = parseFloat(record.water_bill) || 0;
        const maintenance = parseFloat(record.maintenance) || 0;
        const corpus = parseFloat(record.corpus) || 0;
        const total = rent + waterBill + maintenance + corpus;
        const paidDate = record.paid_date || '-';
        const paymentMethod = record.payment_method || '-';
        
        const row = [
            `"${formatMonthYear(record.month_year)}"`,
            rent,
            waterBill,
            maintenance,
            corpus,
            total,
            `"${record.status}"`,
            `"${paidDate}"`,
            `"${paymentMethod}"`
        ].join(',');
        
        csvContent += row + "\n";
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `payment-history-${unitNumber}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccess('CSV export started');
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

// Auto-refresh for resident view
let homeAutoRefreshInterval;

function startHomeAutoRefresh() {
    // Load data immediately
    loadPaymentHistory();
    
    // Set interval for auto-refresh (every 60 seconds)
    homeAutoRefreshInterval = setInterval(() => {
        loadPaymentHistory();
    }, 60000);
}

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

// Start auto-refresh on page load
window.addEventListener('load', () => {
    startHomeAutoRefresh();
});