/**
 * script.js
 * Village Complaint Redressal System - API Integration Script
 * Handles authentication, data submission, fetching, and display.
 */

// script.js
// Final correct URL:
const API_BASE_URL = 'https://vcrs-api.onrender.com/api';
// --- UTILITY & AUTH FUNCTIONS ---

/**
 * Saves the user token, role, and ID to local storage upon successful auth.
 */
function saveAuthData(token, role, userId) {
    localStorage.setItem('vcrs_token', token);
    localStorage.setItem('vcrs_role', role);
    localStorage.setItem('vcrs_user_id', userId);
}

/**
 * Retrieves the JWT token for authenticated requests.
 */
function getToken() {
    return localStorage.getItem('vcrs_token');
}

/**
 * Gets the current user's ID.
 */
function getUserId() {
    return localStorage.getItem('vcrs_user_id');
}

/**
 * Clears local storage and redirects (Logout).
 */
function logout() {
    localStorage.removeItem('vcrs_token');
    localStorage.removeItem('vcrs_role');
    localStorage.removeItem('vcrs_user_id');
    alert('Logged out successfully.');
    window.location.href = '/index.html'; // Use root-relative path
}

/**
 * Toggles visibility between two form cards (Login/Register).
 */
function toggleForm(targetFormId) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (targetFormId === 'registerForm') {
        if(loginForm) loginForm.classList.add('hidden');
        if(registerForm) registerForm.classList.remove('hidden');
    } else {
        if(registerForm) registerForm.classList.add('hidden');
        if(loginForm) loginForm.classList.remove('hidden');
    }
}


// --- API HANDLERS: AUTHENTICATION ---

async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        name: form.regName.value,
        email: form.regEmail.value,
        password: form.regPassword.value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
            alert('Registration successful! Please log in.');
            toggleForm('loginForm'); // Switch back to login
        } else {
            alert(`Registration Failed: ${result.msg}`);
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('An error occurred during registration.');
    }
}

async function handleLogin(e, isAdmin = false) {
    e.preventDefault();
    const form = e.target;
    const data = {
        email: isAdmin ? form.adminEmail.value : form.loginEmail.value,
        password: isAdmin ? form.adminPassword.value : form.loginPassword.value,
    };

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
            saveAuthData(result.token, result.role, result.userId);
            
            // FIX: Use leading slash for root-relative path redirection
            if (result.role === 'admin') {
                window.location.href = 'admin_dashboard.html';
            } else {
                window.location.href = 'citizen_submit_complaint.html';
            }
        } else {
            alert(`Login Failed: ${result.msg}`);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('An error occurred during login.');
    }
}


// --- API HANDLERS: COMPLAINT MANAGEMENT ---

async function handleSubmitComplaint(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    try {
        const response = await fetch(`${API_BASE_URL}/complaints`, {
            method: 'POST',
            headers: { 'x-auth-token': getToken() }, 
            body: formData, 
        });

        const result = await response.json();

        if (response.ok) {
            alert(`Complaint submitted successfully!`);
            window.location.href = 'citizen_status.html';
        } else {
            alert(`Submission Failed: ${result.msg || 'Check console.'}`);
            if (response.status === 401 || response.status === 403) logout();
        }
    } catch (error) {
        console.error('Submission error:', error);
        alert('An error occurred during submission.');
    }
}

/**
 * Populates the citizen's complaint list table.
 */
async function fetchCitizenComplaints(userId) {
    if (!userId || !getToken()) return logout();

    try {
        const response = await fetch(`${API_BASE_URL}/complaints/user/${userId}`, {
            method: 'GET',
            headers: { 'x-auth-token': getToken() },
        });

        const complaints = await response.json();
        if (!response.ok) throw new Error(complaints.msg || 'Failed to fetch complaints.');

        const tableBody = document.getElementById('citizenComplaintList');
        if (!tableBody) return;
        tableBody.innerHTML = ''; 
        
        // --- FIXED: Matching 5 table columns (ID, Title, Category, Date, Status) ---
        complaints.forEach(c => {
            const row = tableBody.insertRow();
            
            row.innerHTML = `
                <td>${c._id.slice(-4)}</td> 
                <td>${c.title}</td>
                <td>${c.category}</td>
                <td>${new Date(c.createdAt).toLocaleDateString()}</td>
                <td><span class="status-tag status-${c.status.toLowerCase()}">${c.status}</span></td>
            `;
        });
        // --- END FIX ---
        
    } catch (error) {
        console.error('Error fetching citizen complaints:', error);
        alert(`Error: ${error.message}. Please try logging in again.`);
        if (error.message.includes('Unauthorized')) logout();
    }
}

/**
 * Fetches all complaints and populates the Admin Dashboard table and counts.
 */
async function fetchAdminDashboard() {
    if (localStorage.getItem('vcrs_role') !== 'admin' || !getToken()) return logout();

    try {
        const response = await fetch(`${API_BASE_URL}/complaints`, {
            method: 'GET',
            headers: { 'x-auth-token': getToken() },
        });

        const complaints = await response.json();
        if (!response.ok) throw new Error(complaints.msg || 'Failed to fetch complaints.');

        // --- 1. Update Counts ---
        const pending = complaints.filter(c => c.status === 'Pending').length;
        const inProgress = complaints.filter(c => c.status === 'In-Progress').length;
        const resolved = complaints.filter(c => c.status === 'Resolved').length;
        
        document.getElementById('pendingCount').textContent = pending;
        document.getElementById('inProgressCount').textContent = inProgress;
        document.getElementById('resolvedCount').textContent = resolved;
        document.getElementById('totalCount').textContent = complaints.length;


        // --- 2. Populate Table ---
        const tableBody = document.getElementById('adminComplaintList');
        if (!tableBody) return;
        tableBody.innerHTML = ''; 

        complaints.forEach(c => {
            const citizenInfo = c.citizenId ? `${c.citizenId.name} (${c.citizenId.email})` : 'N/A';
            
            const row = tableBody.insertRow();
            const statusSelect = `
                <select onchange="updateComplaintStatus('${c._id}', this.value)" class="status-${c.status.toLowerCase()}">
                    <option value="Pending" ${c.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="In-Progress" ${c.status === 'In-Progress' ? 'selected' : ''}>In-Progress</option>
                    <option value="Resolved" ${c.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                </select>
            `;
            const imageLink = c.imagePath ? `<a href="${API_BASE_URL}/${c.imagePath}" target="_blank">View Image</a>` : 'N/A';
            
            row.innerHTML = `
                <td>${c.title}</td>
                <td>${citizenInfo}</td>
                <td>${c.category}</td>
                <td>${c.location}</td>
                <td>${imageLink}</td>
                <td>${statusSelect}</td>
                <td>${new Date(c.createdAt).toLocaleDateString()}</td>
            `;
        });

    } catch (error) {
        console.error('Error fetching admin dashboard:', error);
        alert(`Error: ${error.message}. Please ensure you are logged in as an Admin.`);
        if (error.message.includes('Unauthorized')) logout();
    }
}

/**
 * Handles Admin status update via the PUT endpoint.
 */
async function updateComplaintStatus(complaintId, newStatus) {
    if (localStorage.getItem('vcrs_role') !== 'admin' || !getToken()) return logout();

    if (!confirm(`Are you sure you want to change status to "${newStatus}"?`)) {
        return fetchAdminDashboard(); 
    }

    try {
        const response = await fetch(`${API_BASE_URL}/complaints/${complaintId}/status`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'x-auth-token': getToken()
            },
            body: JSON.stringify({ status: newStatus }),
        });

        if (response.ok) {
            alert('Status updated successfully!');
            fetchAdminDashboard();
        } else {
            const result = await response.json();
            throw new Error(result.msg || 'Failed to update status.');
        }

    } catch (error) {
        console.error('Status update error:', error);
        alert(`Status Update Failed: ${error.message}`);
        if (error.message.includes('Unauthorized')) logout();
    }
}


// --- DOM INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Bind Auth forms
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const logoutButton = document.getElementById('logout-button');

    if (registerForm) registerForm.onsubmit = handleRegister;
    if (loginForm) loginForm.onsubmit = handleLogin;
    if (adminLoginForm) adminLoginForm.onsubmit = (e) => handleLogin(e, true);
    if (logoutButton) logoutButton.onclick = logout;


    // 2. Bind Complaint Form
    const complaintForm = document.getElementById('complaintForm');
    if (complaintForm) complaintForm.onsubmit = handleSubmitComplaint;

    // 3. Conditional Data Fetching
    const role = localStorage.getItem('vcrs_role');
    const userId = getUserId();
    const currentPath = window.location.pathname;

    if (currentPath.includes('citizen_status.html') && role === 'citizen') {
        fetchCitizenComplaints(userId);
    } else if (currentPath.includes('admin_dashboard.html') && role === 'admin') {
        fetchAdminDashboard();
    }
    
    // 4. Redirect unauthenticated users if they land on a protected page
    if ((currentPath.includes('citizen_') || currentPath.includes('admin_')) && !getToken()) {
        if (!currentPath.includes('login') && !currentPath.includes('register') && !currentPath.includes('index')) {
            window.location.href = 'index.html';
        }
    }
});