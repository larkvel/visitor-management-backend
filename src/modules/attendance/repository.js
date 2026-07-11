import { query } from "../../db/pool.js";
import { badRequest, notFound } from "../../http.js";

// Process biometric punch from physical devices
export async function logBiometricPunch(subdomain, biometricId, punchedAt, punchType, deviceInfo) {
  // 1. Resolve company by subdomain
  const compResult = await query(
    `SELECT id, name, attendance_enabled FROM companies WHERE subdomain = $1`,
    [subdomain.toLowerCase()]
  );
  if (compResult.rowCount === 0) throw notFound(`Company "${subdomain}" not found`);
  const company = compResult.rows[0];

  if (!company.attendance_enabled) {
    throw badRequest(`Attendance module is not enabled for company "${company.name}". Please subscribe to activate.`);
  }

  // 2. Resolve user by biometric_id inside company
  const userResult = await query(
    `SELECT id, full_name, email FROM app_users WHERE company_id = $1 AND biometric_id = $2`,
    [company.id, biometricId]
  );
  if (userResult.rowCount === 0) {
    throw notFound(`Employee with Biometric Code "${biometricId}" not found in company "${company.name}".`);
  }
  const user = userResult.rows[0];

  const punchDate = new Date(punchedAt || Date.now());

  // 3. Determine punch type (IN/OUT) if not explicitly provided
  let determinedType = punchType;
  if (!determinedType || !["IN", "OUT"].includes(determinedType.toUpperCase())) {
    // Check if the user has checked in today (local time)
    const startOfDay = new Date(punchDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(punchDate);
    endOfDay.setHours(23, 59, 59, 999);

    const checkResult = await query(
      `SELECT punch_type FROM attendance_logs 
       WHERE user_id = $1 AND punched_at BETWEEN $2 AND $3 
       ORDER BY punched_at DESC LIMIT 1`,
      [user.id, startOfDay.toISOString(), endOfDay.toISOString()]
    );

    if (checkResult.rowCount === 0) {
      determinedType = "IN";
    } else {
      // Toggle from last punch
      determinedType = checkResult.rows[0].punch_type === "IN" ? "OUT" : "IN";
    }
  }

  // 4. Log punch
  const result = await query(
    `INSERT INTO attendance_logs (company_id, user_id, punched_at, punch_type, device_info)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, punched_at, punch_type`,
    [company.id, user.id, punchDate.toISOString(), determinedType.toUpperCase(), deviceInfo || "Biometric Device"]
  );

  return {
    message: "Punch logged successfully",
    punch: result.rows[0],
    employee: user.full_name
  };
}

// Fetch detailed attendance logs with work hours calculation
export async function listAttendance(companyId, startDate, endDate) {
  const params = [companyId];
  let dateFilter = "";

  if (startDate) {
    params.push(startDate);
    dateFilter += ` AND al.punched_at >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    dateFilter += ` AND al.punched_at <= $${params.length}`;
  }

  // Query daily first IN and last OUT punches per user per calendar day
  const result = await query(
    `SELECT 
       al.user_id,
       u.full_name,
       u.email,
       u.biometric_id,
       al.punched_at::date AS punch_date,
       MIN(al.punched_at) FILTER (WHERE al.punch_type = 'IN') AS first_in,
       MAX(al.punched_at) FILTER (WHERE al.punch_type = 'OUT') AS last_out
     FROM attendance_logs al
     JOIN app_users u ON u.id = al.user_id
     WHERE al.company_id = $1 ${dateFilter}
     GROUP BY al.user_id, u.full_name, u.email, u.biometric_id, al.punched_at::date
     ORDER BY punch_date DESC, u.full_name ASC`,
    params
  );

  return result.rows.map(row => {
    let hoursWorked = 0;
    if (row.first_in && row.last_out) {
      const inTime = new Date(row.first_in).getTime();
      const outTime = new Date(row.last_out).getTime();
      if (outTime > inTime) {
        hoursWorked = Number(((outTime - inTime) / (1000 * 60 * 60)).toFixed(2));
      }
    }
    return {
      ...row,
      hoursWorked
    };
  });
}

// Get Attendance metrics for daily dashboard
export async function getAttendanceStats(companyId) {
  // Present = unique users punched in today
  const today = new Date().toISOString().split("T")[0];
  const presentResult = await query(
    `SELECT COUNT(DISTINCT user_id)::int AS present 
     FROM attendance_logs 
     WHERE company_id = $1 AND punched_at::date = $2`,
    [companyId, today]
  );
  const present = presentResult.rows[0]?.present || 0;

  // Total employees
  const totalResult = await query(
    `SELECT COUNT(*)::int AS total FROM app_users WHERE company_id = $1 AND role != 'platform_admin'`,
    [companyId]
  );
  const total = totalResult.rows[0]?.total || 0;

  // Late employees (IN punch after 09:30 AM local time today)
  const lateResult = await query(
    `SELECT COUNT(DISTINCT user_id)::int AS late 
     FROM attendance_logs 
     WHERE company_id = $1 
       AND punched_at::date = $2 
       AND punch_type = 'IN' 
       AND punched_at::time > '09:30:00'`,
    [companyId, today]
  );
  const late = lateResult.rows[0]?.late || 0;

  const absent = Math.max(0, total - present);

  return {
    total,
    present,
    absent,
    late
  };
}
