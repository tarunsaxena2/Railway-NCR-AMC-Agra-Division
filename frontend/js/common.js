// frontend/js/common.js
// Define the base URL for your API. Match your backend's PORT.
const API_BASE_URL = 'http://localhost:5000';

// Function to display messages consistently
function showMessage(elementId, text, type) {
    const messageDiv = document.getElementById(elementId);
    if (messageDiv) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`; // 'success' or 'error'
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000); // Hide after 5 seconds
    }
}

// Global logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user'); // Remove the full user object
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    alert('You have been logged out.');
    window.location.href = '/login.html';
}

// Attach logout listener to button (if present on the page)
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});

// Store authentication data (token, user info) in localStorage
function storeAuthData(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    // Also store individual items as your existing code does
    localStorage.setItem('userName', user.name);
    localStorage.setItem('userRole', user.role);
}

// Clear authentication data from localStorage
function clearAuthData() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
}

// Get JWT token from localStorage
function getToken() {
    return localStorage.getItem('token');
}

// Get user info from localStorage
function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

// Helper for authenticated API fetch requests
async function authenticatedFetch(url, options = {}, messageElementId = 'message') {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers, // Allows overriding or adding other headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`; // Add the token to Authorization header
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    // Handle unauthorized/forbidden responses globally
    if (!response.ok && (response.status === 401 || response.status === 403)) {
        showMessage(messageElementId, 'Session expired or unauthorized. Please log in again.', 'error');
        clearAuthData(); // Clear invalid data
        setTimeout(() => {
            window.location.href = 'login.html'; // Redirect to login
        }, 1500);
        throw new Error('Unauthorized or Forbidden'); // Propagate error
    }

    return response;
}