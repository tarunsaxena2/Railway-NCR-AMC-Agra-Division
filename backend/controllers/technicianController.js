// backend/controllers/technicianController.js
const asyncHandler = require('express-async-handler');
const { query } = require('../config/db');
const { logHistory } = require('./complaintsController');

// @desc    Get complaints assigned to the logged-in technician
// @route   GET /api/technician/complaints
// @access  Private (Technician)
const getTechnicianComplaints = asyncHandler(async (req, res) => {
    const technicianId = req.user.id;

    const result = await query(
        `SELECT
            c.id, c.ticket_number, c.subject, c.description, c.status,
            c.product, c.department, c.phone,
            c.resolution_notes, c.created_at, c.updated_at,
            u.name AS user_name, u.email AS user_email
        FROM complaints c
        JOIN users u ON c.user_id = u.id
        WHERE c.assigned_to = $1
        ORDER BY c.created_at DESC;`,
        [technicianId]
    );

    res.json(result.rows);
});

// @desc    Technician updates status + resolution notes (marks work done)
// @route   PUT /api/technician/complaints/:id/update
// @access  Private (Technician)
const updateComplaintStatusAndResponse = asyncHandler(async (req, res) => {
    const complaintId = req.params.id;
    const { status, resolutionNotes } = req.body;
    const technicianId = req.user.id;

    if (!status && resolutionNotes === undefined) {
        res.status(400);
        throw new Error('Status or resolution notes are required.');
    }

    const allowedStatuses = ['In Progress', 'Resolved'];
    if (status && !allowedStatuses.includes(status)) {
        res.status(400);
        throw new Error('Invalid status. Technicians can set: In Progress, Resolved.');
    }

    const check = await query('SELECT assigned_to FROM complaints WHERE id = $1', [complaintId]);
    if (check.rows.length === 0) {
        res.status(404);
        throw new Error('Complaint not found.');
    }
    if (check.rows[0].assigned_to !== technicianId) {
        res.status(403);
        throw new Error('You are not authorized to update this complaint.');
    }

    const updates = [];
    const params = [complaintId];
    let i = 2;

    if (status) {
        updates.push(`status = $${i++}`);
        params.push(status);
    }
    if (resolutionNotes !== undefined) {
        updates.push(`resolution_notes = $${i++}`);
        params.push(resolutionNotes);
    }
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const result = await query(
        `UPDATE complaints SET ${updates.join(', ')} WHERE id = $1 RETURNING *;`,
        params
    );

    await logHistory(
        complaintId,
        status || 'Updated',
        req.user.name,
        resolutionNotes || null
    );

    res.json({ message: 'Complaint updated successfully!', complaint: result.rows[0] });
});

module.exports = {
    getTechnicianComplaints,
    updateComplaintStatusAndResponse,
};