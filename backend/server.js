// backend/server.js
const attendanceRoutes = require("./routes/attendance");
const adminRoutes = require('./routes/admin');
const technicianRoutes = require('./routes/technician');
const express = require('express');
const cors = require('cors');
const path = require('path');


const { connectDB } = require('./config/db');
const pool = require('./config/db'); 
const errorHandler = require('./middleware/errorHandler');

require("./cron/attendanceCron");

const app = express();

// --- Basic setup: allow JSON data and cross-site requests ---
app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- Connect to PostgreSQL and create tables if needed ---
connectDB();

// --- Automatic Technician Attendance Table Schema Injection ---
const createAttendanceTableQuery = `
CREATE TABLE IF NOT EXISTS technician_attendance (
    id SERIAL PRIMARY KEY,
    technician_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    check_in TIMESTAMP NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'Present',
    photo VARCHAR(255)
);`;

pool.query(createAttendanceTableQuery)
    .then(() => console.log("Technician attendance table checked/created successfully."))
    .catch((err) => console.error("Error creating attendance table:", err.message));

// --- NEW FUNCTIONALITY: Automatic Announcements Table Schema Injection ---
const createAnnouncementsTableQuery = `
CREATE TABLE IF NOT EXISTS admin_announcements (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    target_role VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);`;

pool.query(createAnnouncementsTableQuery)
    .then(() => console.log("Admin announcements table checked/created successfully."))
    .catch((err) => console.error("Error creating announcements table:", err.message));


// --- Routes ---
const authRoutes = require('./routes/auth');
const announcementRoutes = require('./routes/announcement'); // Imported routing element

app.use('/api/auth', authRoutes);
app.use('/api/technician', technicianRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/announcements', announcementRoutes); // Bound announcement middleware endpoint route

// (Other routes below will only work once their files/controllers are ready)
try {
    const complaintsRoutes = require('./routes/complaints');
    app.use('/api/complaints', complaintsRoutes);
} catch (e) {
    console.warn('Skipping complaints routes:', e.message);
}

try {
    const adminComplaintsRoutes = require('./routes/adminComplaintsRoutes');
    app.use('/api/admin/complaints', adminComplaintsRoutes);
} catch (e) {
    console.warn('Skipping admin complaints routes:', e.message);
}

try {
    const technicianRoutes = require('./routes/technicianRoutes');
    app.use('/api/technician', technicianRoutes);
} catch (e) {
    console.warn('Skipping technician routes:', e.message);
}

try {
    const notificationRoutes = require('./routes/notificationRoutes');
    app.use('/api/notifications', notificationRoutes);
} catch (e) {
    console.warn('Skipping notification routes:', e.message);
}

// --- Simple test route, to check server is alive ---
app.get('/', (req, res) => {
    res.send('Backend server is running!');
});

// --- Error handler (must be last) ---
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});