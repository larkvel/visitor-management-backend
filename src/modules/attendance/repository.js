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

// ── Leave Requests ────────────────────────────────────────

export async function createLeaveRequest(companyId, userId, input) {
  const from = new Date(input.fromDate);
  const to   = new Date(input.toDate);
  if (isNaN(from) || isNaN(to) || to < from) {
    throw { statusCode: 400, message: "Invalid date range" };
  }
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysCount = Number(((to - from) / msPerDay + 1).toFixed(2));

  const result = await query(
    `INSERT INTO leave_requests
       (company_id, user_id, leave_type, from_date, to_date, days_count, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [companyId, userId, input.leaveType || "casual", input.fromDate, input.toDate, daysCount, input.reason || null]
  );
  return result.rows[0];
}

export async function listLeaveRequests(companyId, userId) {
  const params = [companyId];
  let userFilter = "";
  if (userId) {
    params.push(userId);
    userFilter = `AND lr.user_id = $${params.length}`;
  }

  const result = await query(
    `SELECT lr.*, 
            u.full_name AS employee_name, u.email AS employee_email,
            r.full_name AS reviewer_name
     FROM leave_requests lr
     JOIN app_users u ON u.id = lr.user_id
     LEFT JOIN app_users r ON r.id = lr.reviewed_by
     WHERE lr.company_id = $1 ${userFilter}
     ORDER BY lr.created_at DESC`,
    params
  );
  return result.rows;
}

export async function updateLeaveRequestStatus(requestId, status, reviewedBy) {
  const result = await query(
    `UPDATE leave_requests
     SET status = $2, reviewed_by = $3, reviewed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [requestId, status, reviewedBy]
  );
  if (result.rowCount === 0) throw { statusCode: 404, message: "Leave request not found" };
  return result.rows[0];
}

// Employee personal monthly attendance summary
export async function getEmployeeAttendanceSummary(userId, companyId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0]; // last day of month

  // Daily punch summary for the month
  const punchResult = await query(
    `SELECT 
       al.punched_at::date AS punch_date,
       MIN(al.punched_at) FILTER (WHERE al.punch_type = 'IN') AS first_in,
       MAX(al.punched_at) FILTER (WHERE al.punch_type = 'OUT') AS last_out
     FROM attendance_logs al
     WHERE al.user_id = $1 AND al.company_id = $2
       AND al.punched_at::date BETWEEN $3 AND $4
     GROUP BY al.punched_at::date
     ORDER BY punch_date DESC`,
    [userId, companyId, startDate, endDate]
  );

  const dailyLogs = punchResult.rows.map(row => {
    let hoursWorked = 0;
    if (row.first_in && row.last_out) {
      const diff = new Date(row.last_out) - new Date(row.first_in);
      if (diff > 0) hoursWorked = Number((diff / (1000 * 60 * 60)).toFixed(2));
    }
    return { ...row, hoursWorked };
  });

  const presentDays = dailyLogs.length;
  // Working days in month (Mon-Fri)
  let workingDays = 0;
  const d = new Date(startDate);
  const endD = new Date(endDate);
  while (d <= endD) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) workingDays++;
    d.setDate(d.getDate() + 1);
  }
  const absentDays = Math.max(0, workingDays - presentDays);
  const totalHours = dailyLogs.reduce((sum, r) => sum + r.hoursWorked, 0);

  // Leave balance from user record
  const userResult = await query(
    `SELECT paid_leaves_limit FROM app_users WHERE id = $1`,
    [userId]
  );
  const monthlyLeaveQuota = Number(userResult.rows[0]?.paid_leaves_limit || 1.5);

  // Approved leaves this month
  const approvedLeaves = await query(
    `SELECT COALESCE(SUM(days_count), 0)::numeric AS total_approved,
            COALESCE(SUM(days_count) FILTER (WHERE leave_type = 'casual'), 0)::numeric AS casual_used,
            COALESCE(SUM(days_count) FILTER (WHERE leave_type = 'sick'), 0)::numeric AS sick_used,
            COALESCE(SUM(days_count) FILTER (WHERE leave_type = 'unpaid'), 0)::numeric AS unpaid_used
     FROM leave_requests
     WHERE user_id = $1 AND status = 'approved'
       AND from_date BETWEEN $2 AND $3`,
    [userId, startDate, endDate]
  );
  const leaveStats = approvedLeaves.rows[0];

  // Pending leaves
  const pendingResult = await query(
    `SELECT COUNT(*)::int AS pending FROM leave_requests WHERE user_id = $1 AND status = 'pending'`,
    [userId]
  );

  return {
    month: `${year}-${String(month).padStart(2, "0")}`,
    presentDays,
    absentDays,
    workingDays,
    totalHours: Number(totalHours.toFixed(2)),
    dailyLogs,
    leaveBalance: {
      monthlyQuota: monthlyLeaveQuota,
      casualUsed: Number(leaveStats.casual_used),
      sickUsed: Number(leaveStats.sick_used),
      unpaidUsed: Number(leaveStats.unpaid_used),
      remaining: Number((monthlyLeaveQuota - Number(leaveStats.total_approved)).toFixed(2))
    },
    pendingLeaves: pendingResult.rows[0]?.pending || 0
  };
}

