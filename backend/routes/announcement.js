const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 1. Create an announcement with custom Admin expiration inputs
router.post('/create', async (req, res) => {
    console.log("=== Announcement API Hit ===");
    console.log(req.body);

    try {
        const {
            message,
            target_role,
            duration_months,
            duration_days,
            duration_minutes
        } = req.body;

        const expiresAt = new Date();

        expiresAt.setMonth(expiresAt.getMonth() + (parseInt(duration_months) || 0));
        expiresAt.setDate(expiresAt.getDate() + (parseInt(duration_days) || 0));
        expiresAt.setMinutes(expiresAt.getMinutes() + (parseInt(duration_minutes) || 0));

        console.log("Expires:", expiresAt);

        const result = await pool.query(
            `INSERT INTO admin_announcements (message,target_role,expires_at)
             VALUES ($1,$2,$3)
             RETURNING *`,
            [message, target_role.toLowerCase(), expiresAt]
        );

        console.log(result.rows);

        res.json({
            success: true,
            message: "Announcement Published"
        });

    } catch (err) {
        console.error("FULL ERROR:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// 2. Read latest active announcement matching target dashboard context permissions
router.get('/active/:role', async (req, res) => {
    try {
        const role = req.params.role.toLowerCase();

        const result = await pool.query(`
            SELECT message FROM admin_announcements
            WHERE (target_role = $1 OR target_role = 'both')
            AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
        `, [role]);

        if (result.rows.length > 0) {
            return res.json({ success: true, announcement: result.rows[0].message });
        }
        
        res.json({ success: true, announcement: null });
    } catch (err) {
        console.error("Announcement Fetch Failure:", err.message);
        res.status(500).json({ success: false, message: "Server Error fetching announcements" });
    }
});

module.exports = router;