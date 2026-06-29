// frontend/js/technicianDashboard.js

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');

    if (!user || !token) {
        alert("Session expired or unauthorized access. Redirecting to login page...");
        window.location.href = 'login.html';
        return;
    }

    if (user && document.getElementById('techName')) {
        document.getElementById('techName').innerText = `Welcome ${user.name}`;
    }

    document.getElementById('logoutBtn').addEventListener('click', logout);

    // --- Profile Modal Toggling Subsystem ---
    const profileModal = document.getElementById('customProfileModal');
    const editProfileBtn = document.getElementById('editProfileBtn');
    const profileCancelBtn = document.getElementById('profileCancelBtn');

    // Pre-fill fields with user session context data safely inside scoping definitions
    if (user) {
        if (document.getElementById('profName')) document.getElementById('profName').value = user.name || '';
        if (document.getElementById('profPhone')) document.getElementById('profPhone').value = user.phone || '';
        if (document.getElementById('profEmail')) document.getElementById('profEmail').value = user.email || '';
    }

    // Phone field: digits only, max 10
    const profPhoneEl = document.getElementById('profPhone');
    if (profPhoneEl) {
        profPhoneEl.addEventListener('input', () => {
            profPhoneEl.value = profPhoneEl.value.replace(/[^0-9]/g, '').slice(0, 10);
        });
        profPhoneEl.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key)) e.preventDefault();
        });
    }

    // Open profile modal
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            profileModal.style.display = 'flex';
        });
    }

    // Close profile modal
    if (profileCancelBtn) {
        profileCancelBtn.addEventListener('click', () => {
            profileModal.style.display = 'none';
            const msgEl = document.getElementById('profileModalMsg');
            if (msgEl) { msgEl.style.display = 'none'; msgEl.textContent = ''; }
        });
    }

    // Attach Form Submit Actions
    const profileForm = document.getElementById('profileUpdateForm');
    if (profileForm) {
        profileForm.addEventListener('submit', updateUserProfile);
    }

    loadDashboard();
    loadComplaints();
    checkAttendanceStatus();
    checkAttendanceTime();
    checkSystemAnnouncements();

    // ============================
    // Attendance Capture Event Action Subsystem
    // ============================
    const captureBtn = document.getElementById("captureBtn");
    if (captureBtn) {
        captureBtn.addEventListener("click", async () => {
            const video = document.getElementById("camera");
            const canvas = document.getElementById("canvas");

            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(async function(blob) {
                const user = JSON.parse(localStorage.getItem("user"));
                const formData = new FormData();

                formData.append("technician_id", user.id);
                formData.append("photo", blob, "attendance.png");

                try {
                    const response = await fetch(`${BASE_URL}/api/attendance/mark`, {
                        method: "POST",
                        body: formData
                    });

                    const data = await response.json();
                    alert(data.message || "Attendance captured successfully!");

                    const attendanceBtn = document.getElementById("markAttendanceBtn");
                    if (attendanceBtn) {
                        attendanceBtn.innerHTML = "✅ Attendance Marked";
                        attendanceBtn.disabled = true;
                        attendanceBtn.style.background = "#16a34a";
                        attendanceBtn.style.cursor = "not-allowed";
                    }

                    if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                        stream = null;
                    }

                    document.getElementById("attendanceModal").style.display = "none";

                    const status = document.getElementById("attendanceStatus");
                    if (status) {
                        status.style.display = "block";
                        status.innerHTML = "✅ Attendance Marked Successfully <br> Time : " + new Date().toLocaleTimeString();
                    }
                } catch (err) {
                    console.error(err);
                    alert("Attendance Failed");
                }
            }, "image/png");
        });
    }

    // ============================
    // Close Attendance Camera Window Event
    // ============================
    const closeCameraBtn = document.getElementById("closeCamera");
    if (closeCameraBtn) {
        closeCameraBtn.addEventListener("click", () => {
            document.getElementById("attendanceModal").style.display = "none";
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
        });
    }

    // ============================
    // Attendance Button Event Initiation
    // ============================
    const attendanceBtn = document.getElementById("markAttendanceBtn");
    if (attendanceBtn) {
        attendanceBtn.addEventListener("click", markAttendance);
    }
});

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

const BASE_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:5000';

async function loadDashboard() {
    try {
        const response = await fetch(`${BASE_URL}/api/technician/dashboard`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!response.ok) return;
        const data = await response.json();

        document.getElementById('totalAssigned').innerText = data.totalAssigned ?? 0;
        document.getElementById('resolvedCount').innerText  = data.resolved ?? 0;
        document.getElementById('pendingCount').innerText   = data.pending ?? 0;
        document.getElementById('closedCount').innerText    = data.closed ?? 0;
    } catch (error) {
        console.error(error);
    }
}

async function loadComplaints() {
    try {
        const response = await fetch(`${BASE_URL}/api/technician/complaints`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const table = document.getElementById('complaintsTable');
        if (!table) return;
        table.innerHTML = '';

        if (!response.ok) {
            table.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#dc2626;">⚠ Error loading complaints</td></tr>`;
            return;
        }

        const complaints = await response.json();
        if (!complaints || complaints.length === 0) {
            table.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b;">No Complaints Found</td></tr>`;
            return;
        }

        complaints.forEach(c => {
            if (!c) return;
            const complaintDisplay = c.subject || c.product || 'N/A';
            const complaintStatus = c.status || 'pending';
            const ticketDisplay = `TCKT-${c.id.toString().padStart(6, '0')}`;
            const statusKey = complaintStatus.toLowerCase();

            table.innerHTML += `
                <tr>
                    <td>${ticketDisplay}</td>
                    <td>
                        <strong>${complaintDisplay}</strong>
                        ${c.tech_remarks ? `<br><span style="font-size:11px; color:#00b894; display:block; margin-top:4px;"><strong>My Remarks:</strong> ${c.tech_remarks}</span>` : ''}
                        ${c.admin_remarks ? `<br><span style="font-size:11px; color:#64748b; display:block; margin-top:2px;"><strong>Admin Note:</strong> ${c.admin_remarks}</span>` : ''}
                    </td>
                    <td><span class="status-${statusKey}" style="font-weight:bold;">${complaintStatus}</span></td>
                    <td>
                        ${
                            statusKey === 'closed' ? `<span style="color:green; font-weight:bold;">Closed</span>` :
                            statusKey === 'waiting for user verification' ? `<span style="color:#b45309; font-weight:bold;">Awaiting User Verification</span>` :
                            statusKey === 'resolved' ? `<span style="color:blue; font-weight:bold;">Awaiting Close</span>` :
                            statusKey === 'accepted' ? `<button class="resolve-btn" onclick="resolveComplaint(${c.id})">Resolve</button>` :
                            `<button class="accept-btn" onclick="acceptComplaint(${c.id})">Accept</button>`
                        }
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error(error);
    }
}

async function acceptComplaint(id) {
    try {
        const response = await fetch(`${BASE_URL}/api/technician/accept/${id}`, { method: 'PUT', headers: getAuthHeaders() });
        const data = await response.json();
        alert(data.message || "Job accepted successfully.");
        loadComplaints(); loadDashboard();
    } catch (error) { console.error(error); }
}

function resolveComplaint(id) {
    const modal = document.getElementById('customRemarksModal');
    const title = document.getElementById('modalTitle');
    const input = document.getElementById('modalRemarksInput');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const submitBtn = document.getElementById('modalSubmitBtn');

    title.innerText = "Enter Resolution Remarks";
    input.value = ""; 
    modal.style.display = "flex";

    cancelBtn.onclick = () => { modal.style.display = "none"; };

    submitBtn.onclick = async () => {
        const userRemarks = input.value.trim();
        if (userRemarks === "") { alert("Remarks cannot be empty."); return; }
        modal.style.display = "none";

        try {
            const response = await fetch(`${BASE_URL}/api/technician/resolve/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ remarks: userRemarks })
            });
            alert((await response.json()).message || "Marked resolved.");
            loadComplaints(); loadDashboard();
        } catch (error) { console.error(error); }
    };
}

async function updateUserProfile(event) {
    event.preventDefault();

    const name = document.getElementById('profName').value.trim();
    const phone = document.getElementById('profPhone') ? document.getElementById('profPhone').value.trim() : '';
    const modal = document.getElementById('customProfileModal');
    const msgEl = document.getElementById('profileModalMsg');

    // Frontend validation
    if (!name) {
        if (msgEl) { msgEl.style.display = 'block'; msgEl.style.background = '#fee2e2'; msgEl.style.color = '#dc2626'; msgEl.textContent = 'Full name is required.'; }
        return;
    }
    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
        if (msgEl) { msgEl.style.display = 'block'; msgEl.style.background = '#fee2e2'; msgEl.style.color = '#dc2626'; msgEl.textContent = 'Please enter a valid 10-digit Indian mobile number (starting with 6-9).'; }
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/technician/profile/update`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name, phone })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            if (msgEl) { msgEl.style.display = 'block'; msgEl.style.background = '#d1fae5'; msgEl.style.color = '#065f46'; msgEl.textContent = data.message || 'Profile updated successfully!'; }

            // Update localStorage
            const updatedUser = JSON.parse(localStorage.getItem('user')) || {};
            updatedUser.name = name;
            updatedUser.phone = phone;
            localStorage.setItem('user', JSON.stringify(updatedUser));

            if (document.getElementById('techName')) {
                document.getElementById('techName').innerText = `Welcome ${name}`;
            }

            setTimeout(() => {
                modal.style.display = 'none';
                if (msgEl) { msgEl.style.display = 'none'; msgEl.textContent = ''; }
            }, 1800);
        } else {
            if (msgEl) { msgEl.style.display = 'block'; msgEl.style.background = '#fee2e2'; msgEl.style.color = '#dc2626'; msgEl.textContent = data.message || 'Profile update failed.'; }
        }
    } catch (error) {
        console.error(error);
        if (msgEl) { msgEl.style.display = 'block'; msgEl.style.background = '#fee2e2'; msgEl.style.color = '#dc2626'; msgEl.textContent = 'Network error. Could not update profile.'; }
    }
}

function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

// ===========================
// Camera Variables
// ===========================
let stream = null;

async function openAttendanceCamera() {
    try {
        const modal = document.getElementById("attendanceModal");
        modal.style.display = "flex";

        stream = await navigator.mediaDevices.getUserMedia({
            video: true
        });

        document.getElementById("camera").srcObject = stream;
    } catch (err) {
        alert("Camera Permission Denied");
        console.error(err);
    }
}

// ===========================
// Mark Attendance Function
// ===========================
async function markAttendance() {
    const user = JSON.parse(localStorage.getItem("user"));

    try {
        const response = await fetch(`${BASE_URL}/api/attendance/status/${user.id}`);
        const data = await response.json();

        if (data.marked) {
            const status = document.getElementById("attendanceStatus");
            if (status) {
                status.style.display = "block";
                status.innerHTML = "✅ Attendance Already Marked Today";
            }

            const attendanceBtn = document.getElementById("markAttendanceBtn");
            if (attendanceBtn) {
                attendanceBtn.innerHTML = "✅ Attendance Marked";
                attendanceBtn.disabled = true;
                attendanceBtn.style.background = "#16a34a";
                attendanceBtn.style.cursor = "not-allowed";
            }
            return;
        }

        openAttendanceCamera();
    } catch (err) {
        console.error(err);
        alert("Unable to check attendance status.");
    }
}

async function captureAttendance() {
    alert("Capture Button Working");
}

async function checkAttendanceStatus() {
    const user = JSON.parse(localStorage.getItem("user"));

    try {
        const response = await fetch(`${BASE_URL}/api/attendance/status/${user.id}`);
        const data = await response.json();

        if (data.marked) {
            const attendanceBtn = document.getElementById("markAttendanceBtn");
            if (attendanceBtn) {
                attendanceBtn.innerHTML = "✅ Attendance Marked";
                attendanceBtn.disabled = true;
                attendanceBtn.style.background = "#16a34a";
                attendanceBtn.style.cursor = "not-allowed";
            }

            const status = document.getElementById("attendanceStatus");
            if (status) {
                status.style.display = "block";
                status.innerHTML = "✅ Attendance Already Marked Today";
            }
        }
    } catch (err) {
        console.log(err);
    }
}

async function checkAttendanceTime() {
    const btn = document.getElementById("markAttendanceBtn");
    if (!btn) return;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const startMinutes = 9 * 60 + 30; // 9:30 AM
    const endMinutes = 18 * 60;        // 6:00 PM

    if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
        btn.disabled = true;
        btn.innerHTML = "⛔ Attendance Closed";
        btn.style.background = "#9ca3af";
        btn.style.cursor = "not-allowed";
        btn.style.opacity = "0.6";
    } else {
        btn.disabled = false;
        btn.innerHTML = "Mark Attendance";
        btn.style.background = "#10b981";
        btn.style.cursor = "pointer";
        btn.style.opacity = "1";
    }
}

// Check attendance time every minute
setInterval(checkAttendanceTime, 60000);

// ================================
// Load System Announcements
// ================================
async function checkSystemAnnouncements() {
    try {
        const response = await fetch(`${BASE_URL}/api/announcements/active/technician`);
        const data = await response.json();

        const container = document.getElementById("announcementContainer");
        const wagonsWrapper = document.getElementById("trainWagonsWrapper");

        if (!container || !wagonsWrapper) return;

        if (data.success && data.announcement) {
            const coaches = data.announcement
                .split(",")
                .map(item => item.trim())
                .filter(item => item !== "");

            wagonsWrapper.innerHTML =
                coaches.map(text => `
                    <div class="train-wagon">
                        ⚠️ ${text}
                    </div>
                `).join("") +

                (data.pdf_url
                    ? `
                    <div class="train-wagon" style="background:#2563eb;">
                        📄 <a href="${BASE_URL}${data.pdf_url}"
                              target="_blank"
                              style="color:white;font-weight:bold;text-decoration:none;">
                            ${data.pdf_name || "Open PDF"}
                        </a>
                    </div>
                    `
                    : "");

            container.style.display = "block";
        } else {
            container.style.display = "none";
        }
    } catch (err) {
        console.error("Announcement Error:", err);
    }
}