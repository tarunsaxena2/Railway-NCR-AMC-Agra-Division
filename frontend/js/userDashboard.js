// frontend/js/userDashboard.js
const BASE_URL =
    typeof API_BASE_URL !== "undefined"
        ? API_BASE_URL
        : "http://localhost:5000";


document.addEventListener('DOMContentLoaded', () => {

    // ===== AUTH CHECK =====
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    if (!token || !user) {
        localStorage.clear();
        window.location.href = 'login.html';
        return;
    }

    // Requirement 6 — Role-based route protection.
    // If a non-user (e.g. admin/technician) tries to open userDashboard directly,
    // show the unauthorized banner then redirect them to their own dashboard.
    if (user.role !== 'user') {
        const banner = document.getElementById('unauthorizedBanner');
        if (banner) banner.classList.add('show');
        setTimeout(() => {
            if (user.role === 'admin')       window.location.href = 'admindashboard.html';
            else if (user.role === 'technician') window.location.href = 'technicianDashboard.html';
            else { localStorage.clear(); window.location.href = 'login.html'; }
        }, 3000);
        return;
    }

    // ===== POPULATE USER INFO =====
    document.getElementById('sidebarUserName').textContent = user.name;
    document.getElementById('welcomeText').textContent = `Welcome back, ${user.name}!`;
    document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
    document.getElementById('fullName').value = user.name;

    // Topbar date
    document.getElementById('topbarDate').textContent = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // ===== IN-MEMORY STATE =====
    let complaints = [];
    let activeFilter = '';  // current status filter value

    // ===== SECTION NAVIGATION =====
    const pageTitles = {
        overview: 'Dashboard',
        register: 'Register Complaint',
    };

    window.navigateTo = (section) => {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

        const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
        const sectionEl = document.getElementById(`section-${section}`);
        if (navItem) navItem.classList.add('active');
        if (sectionEl) sectionEl.classList.add('active');

        const titleEl = document.getElementById('pageTitle');
        if (titleEl) titleEl.textContent = pageTitles[section] || '';

        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('open');
    };

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.section));
    });

    // Mobile sidebar toggle
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebarOverlay').classList.toggle('open');
    });

    document.getElementById('sidebarOverlay').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('open');
    });

    // ===== LOGOUT =====
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    // ===== API HELPER =====
    const api = async (url, options = {}) => {
        const res = await fetch(`${API_BASE_URL}${url}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...(options.headers || {}),
            },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Request failed. Please try again.');
        return data;
    };

    // ===== STATUS BADGE =====
    const statusBadge = (status) => {
        const map = {
            'open':                              ['badge-open',       'Open'],
            'pending':                           ['badge-pending',    'Pending'],
            'assigned':                          ['badge-assigned',   'Assigned'],
            'in progress':                       ['badge-inprogress', 'In Progress'],
            'waiting for user verification':     ['badge-pending',    'Waiting for Your Verification'],
            'resolved by technician':            ['badge-resolved',   'Resolved By Technician'],
            'resolved':                          ['badge-resolved',   'Resolved'],
            'closed':                            ['badge-closed',     'Closed'],
            'reopened':                          ['badge-reopened',   'Reopened'],
        };
        const key = (status || '').toLowerCase().trim();
        const [cls, label] = map[key] || ['badge-pending', status || 'Unknown'];
        return `<span class="badge ${cls}">${label}</span>`;
    };

    // ===== ALERT HELPER =====
    const showAlert = (id, msg, type) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = msg;
        el.className = `alert show alert-${type}`;
        if (type === 'success') setTimeout(() => el.classList.remove('show'), 5000);
    };

    // ===== STATUS GROUPS FOR STAT CARDS =====
    const OPEN_STATUSES       = ['open', 'pending'];
    const INPROGRESS_STATUSES = ['assigned', 'in progress', 'reopened'];
    const RESOLVED_STATUSES   = ['resolved by technician', 'closed'];

    // ===== UPDATE STAT CARDS =====
    const updateStats = () => {
        document.getElementById('statTotal').textContent      = complaints.length;
        document.getElementById('statOpen').textContent       = complaints.filter(c =>
            OPEN_STATUSES.includes((c.status || '').toLowerCase().trim())).length;
        document.getElementById('statInProgress').textContent = complaints.filter(c =>
            INPROGRESS_STATUSES.includes((c.status || '').toLowerCase().trim())).length;
        document.getElementById('statResolved').textContent   = complaints.filter(c =>
            RESOLVED_STATUSES.includes((c.status || '').toLowerCase().trim())).length;
    };

    // ===== STAT CARD CLICK FILTER =====
    window.filterByStatus = (group) => {
        const filterSelect = document.getElementById('statusFilter');

        // Reset dropdown and activeFilter, then apply group-based filter
        filterSelect.value = '';
        activeFilter = '';

        if (group === 'open') {
            activeFilter = '__open__';
        } else if (group === 'inprogress') {
            activeFilter = '__inprogress__';
        } else if (group === 'resolved') {
            activeFilter = '__resolved__';
        }
        // 'all' clears the filter

        renderComplaints();

        // Scroll to complaints panel
        document.querySelector('.panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // ===== DROPDOWN FILTER =====
    window.applyFilter = () => {
        const val = document.getElementById('statusFilter').value;
        activeFilter = val;
        renderComplaints();
    };

    // ===== FORMAT TICKET NUMBER =====
    const ticketDisplay = (c) =>
        c.ticket_number || `NCR-${new Date(c.created_at).getFullYear()}-${String(c.id).padStart(4, '0')}`;

    // ===== LOAD COMPLAINTS =====
    const loadComplaints = async () => {
        try {
            complaints = await api('/api/complaints/my-complaints');
            updateStats();
            renderComplaints();
        } catch (err) {
            document.getElementById('complaintsBody').innerHTML =
                `<tr><td colspan="7" style="text-align:center;color:var(--red);padding:24px">
                    <i class="fa-solid fa-triangle-exclamation"></i> ${err.message}
                </td></tr>`;
        }
    };

    // ===== RENDER COMPLAINTS TABLE (with active filter) =====
    const renderComplaints = () => {
        const tbody = document.getElementById('complaintsBody');

        // Determine which complaints to show based on activeFilter
        let filtered = complaints;

        if (activeFilter === '__open__') {
            filtered = complaints.filter(c => OPEN_STATUSES.includes((c.status || '').toLowerCase().trim()));
        } else if (activeFilter === '__inprogress__') {
            filtered = complaints.filter(c => INPROGRESS_STATUSES.includes((c.status || '').toLowerCase().trim()));
        } else if (activeFilter === '__resolved__') {
            filtered = complaints.filter(c => RESOLVED_STATUSES.includes((c.status || '').toLowerCase().trim()));
        } else if (activeFilter) {
            // Exact match from dropdown
            filtered = complaints.filter(c =>
                (c.status || '').toLowerCase().trim() === activeFilter.toLowerCase().trim()
            );
        }

        if (!filtered.length) {
            const msg = activeFilter
                ? 'No complaints match the selected filter.'
                : 'No complaints yet. Click "Register New Complaint" to raise your first complaint.';
            tbody.innerHTML = `<tr><td colspan="7">
                <div class="empty-state">
                    <i class="fa-solid fa-inbox"></i>
                    <h4>No complaints found</h4>
                    <p>${msg}</p>
                </div></td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(c => {
            const isWaitingForVerification =
                (c.status || '').toLowerCase().trim() === 'waiting for user verification';

            return `
            <tr>
                <td data-label="Ticket"><strong>${ticketDisplay(c)}</strong></td>
                <td data-label="Product">${c.product || '—'}</td>
                <td data-label="Department">${c.department || '—'}</td>
                <td data-label="Subject">${c.subject}</td>
                <td data-label="Status">${statusBadge(c.status)}</td>
                <td data-label="Date">${new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                <td data-label="Action">
                    <button class="btn btn-outline" onclick="viewComplaint(${c.id})">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                    ${isWaitingForVerification ? `
                    <button class="btn btn-primary" onclick="openVerification(${c.id})" style="margin-top:6px;">
                        <i class="fa-solid fa-circle-check"></i> Verify Resolution
                    </button>` : ''}
                </td>
            </tr>
        `;
        }).join('');
    };

    // ===== COMPLAINT DETAILS MODAL =====
    window.viewComplaint = (id) => {
        const c = complaints.find(x => x.id === id);
        if (!c) return;

        document.getElementById('dTicket').textContent    = ticketDisplay(c);
        document.getElementById('dStatus').innerHTML      = statusBadge(c.status);
        document.getElementById('dProduct').textContent   = c.product || '—';
        document.getElementById('dDept').textContent      = c.department || '—';
        document.getElementById('dSubject').textContent   = c.subject;
        document.getElementById('dDesc').textContent      = c.description;
        document.getElementById('dDate').textContent      = new Date(c.created_at).toLocaleString('en-IN');
        document.getElementById('dUpdated').textContent   = new Date(c.updated_at).toLocaleString('en-IN');

        // Show resolution notes if available
        const resSection = document.getElementById('resolutionSection');
        const resText    = document.getElementById('dResolution');
        const resNote    = c.technician_resolution || c.resolution_notes || c.tech_remarks;
        if (resNote) {
            resSection.style.display = 'flex';
            resText.textContent = resNote;
        } else {
            resSection.style.display = 'none';
        }

        // Show assigned technician info
        const techSection = document.getElementById('technicianSection');
        if (techSection) {
            if (c.assigned_to && c.technician_name) {
                techSection.style.display = 'flex';
                const nameEl  = document.getElementById('dTechName');
                const phoneEl = document.getElementById('dTechPhone');
                if (nameEl)  nameEl.textContent  = c.technician_name;
                if (phoneEl) phoneEl.textContent  = c.technician_phone || 'Not provided';
            } else {
                techSection.style.display = 'none';
            }
        }

        openModal('complaintModal');
    };

    // ===== USER VERIFICATION MODAL ("Has your issue been resolved?") =====
    let activeVerificationComplaintId = null;

    window.openVerification = (id) => {
        const c = complaints.find(x => x.id === id);
        if (!c) return;

        activeVerificationComplaintId = id;

        document.getElementById('vTicket').textContent   = ticketDisplay(c);
        document.getElementById('vSubject').textContent  = c.subject;
        document.getElementById('vTechName').textContent = c.technician_name || '—';
        document.getElementById('vRemarks').textContent  = c.technician_resolution || c.tech_remarks || c.resolution_notes || '—';
        document.getElementById('vStatus').innerHTML     = statusBadge(c.status);

        // Reset form state each time it opens
        document.getElementById('vRadioYes').checked = false;
        document.getElementById('vRadioNo').checked  = false;
        document.getElementById('vRemarksInput').value = '';
        const alertEl = document.getElementById('verifyAlert');
        alertEl.classList.remove('show');

        openModal('verifyResolutionModal');
    };

    window.submitVerification = async () => {
        const id = activeVerificationComplaintId;
        if (!id) return;

        const yesChecked = document.getElementById('vRadioYes').checked;
        const noChecked  = document.getElementById('vRadioNo').checked;

        if (!yesChecked && !noChecked) {
            showAlert('verifyAlert', 'Please select Yes or No before submitting.', 'error');
            return;
        }

        const confirmed = yesChecked;
        const remarks   = document.getElementById('vRemarksInput').value.trim();

        const btn = document.getElementById('submitVerificationBtn');
        btn.disabled = true;
        const originalLabel = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span> Submitting...';

        try {
            const data = await api(`/api/complaints/${id}/verify`, {
                method: 'PUT',
                body: JSON.stringify({ confirmed, remarks }),
            });

            showAlert('verifyAlert', data.message || 'Response submitted successfully.', 'success');
            await loadComplaints();

            setTimeout(() => {
                closeModal('verifyResolutionModal');
            }, 1400);
        } catch (err) {
            showAlert('verifyAlert', err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalLabel;
        }
    };

    // ===== COMPLAINT FORM SUBMIT =====
    document.getElementById('complaintForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submitComplaintBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Submitting...';

        const body = {
            phone:       document.getElementById('phone').value.trim(),
            product:     document.getElementById('product').value,
            department:  document.getElementById('department').value,
            subject:     document.getElementById('subject').value.trim(),
            description: document.getElementById('description').value.trim(),
        };

        try {
            const data = await api('/api/complaints', { method: 'POST', body: JSON.stringify(body) });
            showAlert('complaintAlert',
                `✓ Complaint submitted successfully! Your Ticket Number: ${data.complaint.ticket_number}`,
                'success'
            );
            document.getElementById('complaintForm').reset();
            document.getElementById('fullName').value = user.name;
            await loadComplaints();
            // Return to dashboard after successful submission
            setTimeout(() => navigateTo('overview'), 1800);
        } catch (err) {
            showAlert('complaintAlert', `✗ ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Complaint';
        }
    });

    window.resetComplaintForm = () => {
        document.getElementById('complaintForm').reset();
        document.getElementById('fullName').value = user.name;
        const alert = document.getElementById('complaintAlert');
        if (alert) alert.classList.remove('show');
    };

    // ===== MODAL HELPERS =====
    const openModal = (id) => document.getElementById(id).classList.add('open');

    window.closeModal = (id) => {
        document.getElementById(id).classList.remove('open');
    };

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('open');
        });
    });

    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
        }
    });

    // ===== INITIAL DATA LOAD =====
    loadComplaints();
    loadAnnouncement();
});

async function loadAnnouncement() {
    try {
        const response = await fetch(`${BASE_URL}/api/announcements/active/user`);
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