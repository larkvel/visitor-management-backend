import { query } from "./pool.js";

async function run() {
  console.log("Enabling Attendance and Payroll modules...");
  try {
    const result = await query(
      `UPDATE companies SET attendance_enabled = true, payroll_enabled = true RETURNING id, name, attendance_enabled, payroll_enabled`
    );
    console.log("Updated Companies:", result.rows);
    process.exit(0);
  } catch (err) {
    console.error("Failed to enable modules:", err);
    process.exit(1);
  }
}

run();
