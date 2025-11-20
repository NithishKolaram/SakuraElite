// Add this script to your index.html 
// Or save as index.js and link it: <script src="index.js"></script>

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const unit = document.getElementById('unitNumber').value;
    const pin = document.getElementById('pin').value;
    
    // Clear previous errors
    const errorDiv = document.getElementById('error');
    if (errorDiv) errorDiv.textContent = '';
    
    const unitError = document.getElementById('unitError');
    if (unitError) unitError.textContent = '';
    
    const pinError = document.getElementById('pinError');
    if (pinError) pinError.textContent = '';
    
    // Check for admin login
    if (pin === '1470') {
        sessionStorage.setItem('isAdmin', 'true');
        window.location.href = 'admin.html';
        return;
    }
    
    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ unit, pin })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const successMsg = document.getElementById('successMessage');
            if (successMsg) successMsg.textContent = 'Login successful!';
            
            // Save unit number to session storage
            sessionStorage.setItem('unitNumber', data.unit);
            
            // Redirect to home page
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1000);
        } else {
            if (errorDiv) errorDiv.textContent = data.error;
        }
    } catch (error) {
        console.error('Error:', error);
        if (errorDiv) errorDiv.textContent = 'Connection error - make sure server is running';
    }
});