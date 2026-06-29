const express  = require('express');
const { pool } = require('../config/db');
const router   = express.Router();

const authModule  = require('../middleware/authMiddleware');
const verifyToken = typeof authModule === 'function'
    ? authModule
    : (authModule.verifyToken || authModule.protect || authModule.auth);

// Test Route
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Technician Route Working'
    });
});

// 1. Technician Dashboard Counters
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        const technicianId = req.user ? parseInt(req.user.id, 10) : null;

        if (!technicianId) {
            const [total, resolved, pending, closed] = await Promise.all([
                pool.query(`SELECT COUNT(*) FROM complaints`),
                pool.query(`SELECT COUNT(*) FROM complaints WHERE LOWER(status) = 'resolved'`),
                pool.query(`SELECT COUNT(*) FROM complaints WHERE LOWER(status) IN ('assigned','accepted','progress','in progress')`),
                pool.query(`SELECT COUNT(*) FROM complaints WHERE LOWER(status) = 'closed'`)
            ]);

            return res.json({
                totalAssigned: parseInt(total.rows[0].count, 10),
                resolved: parseInt(resolved.rows[0].count, 10),
                pending: parseInt(pending.rows[0].count, 10),
                closed: parseInt(closed.rows[0].count, 10)
            });
        }

        const result = await pool.query(
            `SELECT status FROM complaints WHERE assigned_to = $1`,
            [technicianId]
        );

        const rows = result.rows;
        const resolvedCount = rows.filter(r => r.status && r.status.toLowerCase() === 'resolved').length;
        const closedCount = rows.filter(r => r.status && r.status.toLowerCase() === 'closed').length;

        res.json({
            totalAssigned: rows.length,
            resolved: resolvedCount,
            pending: rows.length - resolvedCount - closedCount,
            closed: closedCount
        });

    } catch (err) {
        console.error('[tech/dashboard] Error:', err.message);
        res.status(500).json({
            success: false,
            message: 'Failed to load dashboard',
            error: err.message
        });
    }
});

// 2. Get Assigned Complaints
router.get('/complaints', verifyToken, async (req, res) => {
    try {
        const technicianId = req.user ? parseInt(req.user.id, 10) : null;

        const result = technicianId
            ? await pool.query(
                `SELECT c.*, u.name AS user_name
                 FROM complaints c
                 LEFT JOIN users u ON c.user_id = u.id
                 WHERE c.assigned_to = $1
                 ORDER BY c.id DESC`,
                [technicianId]
            )
            : await pool.query(
                `SELECT c.*, u.name AS user_name
                 FROM complaints c
                 LEFT JOIN users u ON c.user_id = u.id
                 ORDER BY c.id DESC`
            );

        res.json(result.rows);

    } catch (err) {
        console.error('[tech/complaints] Error:', err.message);
        res.status(500).json({
            success: false,
            message: 'Failed to load complaints',
            error: err.message
        });
    }
});

// 3. Accept Complaint
router.put('/accept/:id', verifyToken, async (req, res) => {
    try {
        const complaintId = parseInt(req.params.id, 10);

        const check = await pool.query(
            `SELECT id FROM complaints WHERE id = $1`,
            [complaintId]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found.'
            });
        }

        await pool.query(
            `UPDATE complaints
             SET status = 'accepted',
                 updated_at = NOW()
             WHERE id = $1`,
            [complaintId]
        );

        try {
            const performedBy = req.user
                ? (req.user.name || `Technician #${req.user.id}`)
                : 'Technician';

            await pool.query(
                `INSERT INTO complaint_history (complaint_id, action, performed_by, remarks)
                 VALUES ($1, 'Accepted', $2, 'Complaint accepted by technician.')`,
                [complaintId, performedBy]
            );
        } catch (h) {
            console.warn('[tech/accept] history non-fatal:', h.message);
        }

        res.json({
            success: true,
            message: 'Complaint accepted successfully.'
        });

    } catch (err) {
        console.error('[tech/accept] Error:', err.message);
        res.status(500).json({
            success: false,
            message: 'Failed to accept complaint',
            error: err.message
        });
    }
});

// 4. Resolve Complaint
router.put('/resolve/:id', verifyToken, async (req, res) => {
    try {
        const complaintId = parseInt(req.params.id, 10);
        const remarks = (req.body.remarks || '').trim();

        if (!remarks) {
            return res.status(400).json({
                success: false,
                message: 'Resolution remarks are required.'
            });
        }

        const comp = await pool.query(
            `SELECT * FROM complaints WHERE id = $1`,
            [complaintId]
        );

        if (comp.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found.'
            });
        }

        await pool.query(`
            UPDATE complaints
            SET status = 'Waiting for User Verification',
                tech_remarks = $1,
                technician_resolution = $1,
                resolution_notes = $1,
                resolved_at = NOW(),
                updated_at = NOW(),
                user_verification_response = NULL,
                user_verification_remarks = NULL,
                user_verified_at = NULL
            WHERE id = $2
        `, [remarks, complaintId]);

        const performedBy = req.user
            ? (req.user.name || `Technician #${req.user.id}`)
            : 'Technician';

        try {
            await pool.query(
                `INSERT INTO complaint_history (complaint_id, action, performed_by, remarks)
                 VALUES ($1, 'Technician Submitted Resolution', $2, $3)`,
                [complaintId, performedBy, remarks]
            );
        } catch (h) {
            console.warn('[tech/resolve] history non-fatal:', h.message);
        }

        try {
            const { user_id, ticket_number } = comp.rows[0];

            if (user_id) {
                await pool.query(
                    `INSERT INTO notifications (user_id, complaint_id, message)
                     VALUES ($1, $2, $3)`,
                    [
                        user_id,
                        complaintId,
                        `Technician has resolved your complaint (${ticket_number}). Remarks: ${remarks}. Please verify the resolution in your dashboard.`
                    ]
                );
            }
        } catch (n) {
            console.warn('[tech/resolve] notification non-fatal:', n.message);
        }

        res.json({
            success: true,
            message: 'Complaint marked resolved. Waiting for user verification.'
        });

    } catch (err) {
        console.error('[tech/resolve] Error:', err.message);
        res.status(500).json({
            success: false,
            message: 'Failed to resolve complaint',
            error: err.message
        });
    }
});

// 5. Update Technician Profile
router.put('/profile/update', verifyToken, async (req, res) => {
    try {
        const technicianId = req.user ? parseInt(req.user.id, 10) : null;

        if (!technicianId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const { name, email, phone, password } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Full name is required.'
            });
        }

        let query;
        let values;

        if (phone && phone.trim()) {
            if (!/^[6-9]\d{9}$/.test(phone.trim())) {
                return res.status(400).json({
                    success: false,
                    message: 'Enter a valid 10-digit Indian mobile number.'
                });
            }

            query = `
                UPDATE technicians
                SET name = $1,
                    phone = $2
                WHERE id = $3
                RETURNING id, name, email, phone
            `;
            values = [name.trim(), phone.trim(), technicianId];

        } else if (email && email.trim()) {
            if (password && password.trim()) {
                query = `
                    UPDATE technicians
                    SET name = $1,
                        email = $2,
                        password = $3
                    WHERE id = $4
                    RETURNING id, name, email, phone
                `;
                values = [name.trim(), email.trim(), password.trim(), technicianId];
            } else {
                query = `
                    UPDATE technicians
                    SET name = $1,
                        email = $2
                    WHERE id = $3
                    RETURNING id, name, email, phone
                `;
                values = [name.trim(), email.trim(), technicianId];
            }

        } else {
            return res.status(400).json({
                success: false,
                message: 'Phone or Email is required.'
            });
        }

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Technician not found.'
            });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully!',
            user: result.rows[0]
        });

    } catch (err) {
        console.error('[tech/profile] Error:', err.message);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: err.message
        });
    }
});

module.exports = router;
