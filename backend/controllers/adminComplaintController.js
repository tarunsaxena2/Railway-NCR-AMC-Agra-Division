// backend/controllers/adminComplaintController.js
const asyncHandler = require('express-async-handler');
const { query } = require('../config/db');
const { logHistory } = require('./complaintsController');

// @desc    Get all complaints (for admin dashboard)
// @route   GET /api/admin/complaints
// @access  Private (Admin)
const getAllComplaints = asyncHandler(async (req, res) => {
    const result = await query(`
        SELECT
            c.id, c.ticket_number, c.subject, c.description, c.status,
            c.resolution_notes, c.phone, c.product, c.department,
            c.created_at, c.updated_at,
            u.name AS user_name, u.email AS user_email,
            t.name AS technician_name,
            c.user_id, c.assigned_to
        FROM complaints c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN technicians t ON c.assigned_to = t.id
        ORDER BY c.created_at DESC;
    `);
    res.json(result.rows);
});

// @desc    Get list of technicians (for the assign dropdown)
// @route   GET /api/admin/complaints/technicians
// @access  Private (Admin)
const getTechnicianList = asyncHandler(async (req, res) => {
    const result = await query('SELECT id, name, email FROM technicians ORDER BY name ASC');
    res.json(result.rows);
});

// @desc    Assign a complaint to a technician
// @route   PUT /api/admin/complaints/:id/assign
// @access  Private (Admin)
const assignComplaint = asyncHandler(async (req, res) => {
    const complaintId = req.params.id;
    const { technicianId } = req.body;

    if (!technicianId) {
        res.status(400);
        throw new Error('technicianId is required.');
    }

    const techCheck = await query('SELECT id, name FROM technicians WHERE id = $1', [technicianId]);
    if (techCheck.rows.length === 0) {
        res.status(400);
        throw new Error('Invalid technician ID.');
    }
    const technicianName = techCheck.rows[0].name;

    const result = await query(
        `UPDATE complaints
         SET assigned_to = $1, status = 'Assigned', updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *;`,
        [technicianId, complaintId]
    );

    if (result.rows.length === 0) {
        res.status(404);
        throw new Error('Complaint not found.');
    }

    await logHistory(complaintId, 'Assigned', req.user.name, `Assigned to technician: ${technicianName}`);

    res.json({ message: 'Complaint assigned to technician successfully!', complaint: result.rows[0] });
});

// @desc    Admin adds/updates resolution notes on a complaint
// @route   PUT /api/admin/complaints/:id/comment
// @access  Private (Admin)
const addAdminComment = asyncHandler(async (req, res) => {
    const complaintId = req.params.id;
    const { comment } = req.body;

    const result = await query(
        'UPDATE complaints SET resolution_notes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [comment, complaintId]
    );

    if (result.rows.length === 0) {
        res.status(404);
        throw new Error('Complaint not found.');
    }

    await logHistory(complaintId, 'Comment Added', req.user.name, comment);

    res.json({ message: 'Comment saved.', complaint: result.rows[0] });
});

// @desc    Admin marks a complaint as Closed and notifies the user
// @route   PUT /api/admin/complaints/:id/close
// @access  Private (Admin)
const closeComplaintAndNotifyUser = asyncHandler(async (req, res) => {
    const complaintId = req.params.id;
    const { message } = req.body;

    const complaintResult = await query('SELECT * FROM complaints WHERE id = $1', [complaintId]);
    const complaint = complaintResult.rows[0];

    if (!complaint) {
        res.status(404);
        throw new Error('Complaint not found.');
    }

    const updated = await query(
        `UPDATE complaints SET status = 'Closed', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [complaintId]
    );

    const notifText = message || `Your complaint ${complaint.ticket_number} has been resolved and closed.`;
    await query(
        `INSERT INTO notifications (user_id, complaint_id, message) VALUES ($1, $2, $3)`,
        [complaint.user_id, complaintId, notifText]
    );

    await logHistory(complaintId, 'Closed', req.user.name, notifText);

    res.json({ message: 'Complaint closed and user notified!', complaint: updated.rows[0] });
});

// @desc    Delete a complaint
// @route   DELETE /api/admin/complaints/:id
// @access  Private (Admin)
const deleteComplaint = asyncHandler(async (req, res) => {
    const result = await query('DELETE FROM complaints WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
        res.status(404);
        throw new Error('Complaint not found.');
    }
    res.json({ message: `Complaint ${req.params.id} deleted successfully.` });
});

module.exports = {
    getAllComplaints,
    getTechnicianList,
    assignComplaint,
    addAdminComment,
    closeComplaintAndNotifyUser,
    deleteComplaint,
};