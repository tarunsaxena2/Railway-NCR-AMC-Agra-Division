const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Upload Folder Configuration
const uploadPath = path.join(__dirname, "../uploads/attendance");

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 100000) +
            path.extname(file.originalname);

        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

// Test Route
router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Attendance Route Working Successfully"
    });
});

// Mark Attendance API
router.post("/mark", upload.single("photo"), async (req, res) => {
    try {
        const { technician_id } = req.body;

        const photo = req.file
            ? "/uploads/attendance/" + req.file.filename
            : null;

        if (!technician_id) {
            return res.status(400).json({
                success: false,
                message: "Technician ID is required"
            });
        }

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const startMinutes = 9 * 60 + 30; // 9:30 AM
        const endMinutes = 18 * 60;       // 6:00 PM

        if (currentMinutes < startMinutes) {
            return res.status(400).json({
                success: false,
                message: "Attendance starts at 9:30 AM."
            });
        }

        if (currentMinutes > endMinutes) {
            return res.status(400).json({
                success: false,
                message: "Attendance time is over (6:00 PM)."
            });
        }

        const today = new Date().toISOString().split("T")[0];

        const check = await pool.query(
            `SELECT * FROM technician_attendance
             WHERE technician_id = $1
             AND attendance_date = $2`,
            [technician_id, today]
        );

        if (check.rows.length > 0) {
            return res.json({
                success: false,
                message: "Attendance already marked."
            });
        }

        await pool.query(
            `INSERT INTO technician_attendance
            (
                technician_id,
                attendance_date,
                check_in,
                status,
                photo
            )
            VALUES ($1, $2, NOW(), 'Present', $3)`,
            [technician_id, today, photo]
        );

        res.json({
            success: true,
            message: "Attendance marked successfully."
        });

    } catch (err) {
        console.error("Attendance Error:", err.message);
        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
});

// Check Today's Attendance Status
router.get("/status/:id", async (req, res) => {
    try {
        const technician_id = req.params.id;
        const today = new Date().toISOString().split("T")[0];

        const result = await pool.query(
            `SELECT * FROM technician_attendance
             WHERE technician_id = $1
             AND attendance_date = $2`,
            [technician_id, today]
        );

        res.json({
            marked: result.rows.length > 0
        });

    } catch (err) {
        console.error("Attendance Status Error:", err.message);
        res.status(500).json({
            marked: false
        });
    }
});

module.exports = router;