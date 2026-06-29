// frontend/js/complaints.js
document.addEventListener('DOMContentLoaded', async () => {
    const complaintForm = document.getElementById('complaintForm');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const fullNameInput = document.getElementById('fullName');
    const myComplaintsListBody = document.querySelector('#myComplaintsList tbody');
    const noComplaintsMessage = document.getElementById('noComplaintsMessage');

    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user')); // Parse the stored user object

    // --- Authentication Check & Redirection ---
    if (!token || !user || !user.name) {
        alert('You are not logged in or your session has expired. Please log in.');
        window.location.href = '/login.html';
        return;
    }

    // Populate full name field and welcome message
    if (fullNameInput && user.name) {
        fullNameInput.value = user.name;
        fullNameInput.readOnly = true; // Make it non-editable
    }
    if (welcomeMessage && user.name) {
        welcomeMessage.textContent = `Welcome, ${user.name}!`;
    }

    // --- Complaint Form Submission Logic ---
    if (complaintForm) {
        complaintForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const subject = document.getElementById('subject').value.trim();
            const description = document.getElementById('description').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const product = document.getElementById('product').value;
            const department = document.getElementById('department').value;

            if (!subject || !description || !phone || !product || !department) {
                showMessage('complaintMessage', 'Please fill in all complaint details.', 'error');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/complaints`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` // Include JWT token
                    },
                    body: JSON.stringify({ subject, description, phone, product, department })
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage('complaintMessage', data.message + ` Your Complaint Number is: REQ${data.complaintId.toString().padStart(6, '0')}`, 'success');
                    complaintForm.reset(); // Clear the form
                    fullNameInput.value = user.name; // Re-populate name after reset
                    fetchUserComplaints(); // Refresh the list of user's complaints
                } else {
                    showMessage('complaintMessage', data.message || 'Failed to submit complaint.', 'error');
                }
            } catch (error) {
                console.error('Error submitting complaint:', error);
                showMessage('complaintMessage', 'Network error. Please try again.', 'error');
            }
        });
    }

    // --- Fetch User Complaints Logic ---
    async function fetchUserComplaints() {
        if (!myComplaintsListBody || !noComplaintsMessage) {
            console.warn('Complaint list elements not found. Cannot display user complaints.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/complaints/my-complaints`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}` // Include JWT token
                }
            });

            const complaints = await response.json();

            if (response.ok) {
                displayUserComplaints(complaints);
            } else {
                console.error('Failed to fetch user complaints:', complaints.message);
                myComplaintsListBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red;">Error loading complaints: ${complaints.message || 'Unknown error'}</td></tr>`;
                noComplaintsMessage.style.display = 'block';
                noComplaintsMessage.textContent = `Error loading complaints: ${complaints.message || 'Unknown error'}`;
            }

        } catch (error) {
            console.error('Error fetching user complaints:', error);
            myComplaintsListBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red;">Network error loading complaints.</td></tr>`;
            noComplaintsMessage.style.display = 'block';
            noComplaintsMessage.textContent = `Network error loading complaints. Please ensure the server is running.`;
        }
    }

   // In frontend/js/complaints.js, update the `displayUserComplaints` function:

function displayUserComplaints(complaints) {
    myComplaintsListBody.innerHTML = ''; // Clear previous entries
    if (complaints.length === 0) {
        noComplaintsMessage.style.display = 'block';
        noComplaintsMessage.textContent = "You haven't submitted any complaints yet.";
    } else {
        noComplaintsMessage.style.display = 'none';
        // Update table headers in ComplaintsPage.html as well if you want to show these columns
        // e.g., <th>Assigned To</th><th>Tech Response</th><th>Review Status</th>
        complaints.forEach(complaint => {
            const row = myComplaintsListBody.insertRow();
            row.insertCell(0).textContent = `REQ${complaint.id.toString().padStart(6, '0')}`;
            row.insertCell(1).textContent = complaint.subject;
            row.insertCell(2).textContent = complaint.description;
            row.insertCell(3).textContent = complaint.status;
            row.insertCell(4).textContent = complaint.technician_name || 'Unassigned'; // NEW
            row.insertCell(5).textContent = complaint.technician_response || 'N/A'; // NEW
            row.insertCell(6).textContent = complaint.supervisor_review_status || 'N/A'; // NEW
            row.insertCell(7).textContent = complaint.admin_comment || 'N/A';
            row.insertCell(8).textContent = complaint.product || 'N/A';
            row.insertCell(9).textContent = complaint.department || 'N/A';
            row.insertCell(10).textContent = new Date(complaint.created_at).toLocaleString();
        });
    }
}
    // Initial fetch of complaints when the page loads
    fetchUserComplaints();
});