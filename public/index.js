// Enhanced Login Script with Debugging

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const unit = document.getElementById('unitNumber').value;
    const pin = document.getElementById('pin').value;
    
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Unit selected:', unit);
    console.log('PIN entered:', pin);
    console.log('PIN length:', pin.length);
    console.log('PIN type:', typeof pin);
    
    // Clear previous errors
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.classList.remove('show');
    }
    
    const unitError = document.getElementById('unitError');
    if (unitError) unitError.textContent = '';
    
    const pinError = document.getElementById('pinError');
    if (pinError) pinError.textContent = '';
    
    // Check for admin login
    if (pin === '1470') {
        console.log('Admin PIN detected - redirecting to admin panel');
        sessionStorage.setItem('isAdmin', 'true');
        window.location.href = 'admin.html';
        return;
    }
    
    // Validate inputs
    if (!unit) {
        console.log('ERROR: No unit selected');
        if (errorDiv) {
            errorDiv.textContent = 'Please select a unit';
            errorDiv.classList.add('show');
        }
        return;
    }
    
    if (!pin) {
        console.log('ERROR: No PIN entered');
        if (pinError) pinError.textContent = 'Please enter your PIN';
        return;
    }
    
    try {
        const payload = { unit, pin };
        console.log('Sending payload:', payload);
        console.log('Payload JSON:', JSON.stringify(payload));
        
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        console.log('Response status:', response.status);
        console.log('Response status text:', response.statusText);
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success) {
            console.log('✓ Login successful!');
            const successMsg = document.getElementById('successMessage');
            if (successMsg) {
                successMsg.textContent = 'Login successful!';
                successMsg.classList.add('show');
            }
            
            // Save unit number to session storage
            sessionStorage.setItem('unitNumber', data.unit);
            console.log('Saved unit to session:', data.unit);
            
            // Redirect to home page
            setTimeout(() => {
                console.log('Redirecting to home.html...');
                window.location.href = 'home.html';
            }, 1000);
        } else {
            console.log('❌ Login failed:', data.error);
            if (errorDiv) {
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.classList.add('show');
            }
        }
    } catch (error) {
        console.error('❌ Connection error:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        
        if (errorDiv) {
            errorDiv.textContent = 'Connection error - make sure server is running on port 3000';
            errorDiv.classList.add('show');
        }
    }
});

// Add console log on page load
console.log('Login page loaded');
console.log('Testing server connection...');

// Test if server is reachable
fetch('/api/admin/units')
    .then(response => {
        console.log('✓ Server is reachable on port 3000');
        console.log('Server response status:', response.status);
    })
    .catch(error => {
        console.error('❌ Cannot reach server on port 3000');
        console.error('Make sure you run: npm start');
    });