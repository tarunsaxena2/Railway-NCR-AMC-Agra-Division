const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');

// PDF upload storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../uploads/announcements'));
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
        cb(null, uniqueName);
    }
});

// Only PDF allowed
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter
});

// 1. Create an announcement with optional PDF
router.post('/create', upload.single('pdf'), async (req, res) => {
    console.log("=== Announcement API Hit ===");
    console.log(req.body);
    console.log(req.file);

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

        let pdfUrl = null;
        let pdfName = null;

        if (req.file) {
            pdfUrl = `/uploads/announcements/${req.file.filename}`;
            pdfName = req.file.originalname;
        }

        const result = await pool.query(
            `INSERT INTO admin_announcements 
            (message, target_role, expires_at, pdf_url, pdf_name)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                message,
                target_role.toLowerCase(),
                expiresAt,
                pdfUrl,
                pdfName
            ]
        );

        res.json({
            success: true,
            message: "Announcement Published",
            data: result.rows[0]
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
            SELECT message, pdf_url, pdf_name FROM admin_announcements
            WHERE (target_role = $1 OR target_role = 'both')
            AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
        `, [role]);

        if (result.rows.length > 0) {
            return res.json({
                success: true,
                announcement: result.rows[0].message,
                pdf_url: result.rows[0].pdf_url,
                pdf_name: result.rows[0].pdf_name
            });
        }

        res.json({
            success: true,
            announcement: null,
            pdf_url: null,
            pdf_name: null
        });

    } catch (err) {
        console.error("Announcement Fetch Failure:", err.message);
        res.status(500).json({
            success: false,
            message: "Server Error fetching announcements"
        });
    }
});

module.exports = router;