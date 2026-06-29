const cron = require("node-cron");
const { pool } = require("../config/db");

console.log("Attendance Cron Started");

// Run every day at 6:00 PM
cron.schedule("0 18 * * *", async () => {

    console.log("Running Attendance Cron...");

    try {

        const today = new Date().toISOString().split("T")[0];

        // Get all technicians
        const technicians = await pool.query(
            "SELECT id FROM technicians"
        );

        for (const tech of technicians.rows) {

            // Check today's attendance
            const attendance = await pool.query(
                `SELECT id
                 FROM technician_attendance
                 WHERE technician_id = $1
                 AND attendance_date = $2`,
                [tech.id, today]
            );

            // If attendance not found, mark Absent
            if (attendance.rows.length === 0) {

                await pool.query(
                    `INSERT INTO technician_attendance
                    (
                        technician_id,
                        attendance_date,
                        status
                    )
                    VALUES ($1,$2,'Absent')`,
                    [tech.id, today]
                );

                console.log(`Technician ${tech.id} marked Absent`);
            }
        }

        console.log("Automatic Absent Process Completed");

    } catch (err) {

        console.error(err);

    }

});