import { query } from "../../db/pool.js";
import { badRequest, notFound } from "../../http.js";

// Save custom company payslip templates & digital signature image (base64)
export async function savePayrollSettings(companyId, input) {
  const result = await query(
    `INSERT INTO payroll_settings (company_id, company_display_name, company_address, footer_text, digital_signature_base64)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (company_id) DO UPDATE SET 
       company_display_name = EXCLUDED.company_display_name,
       company_address = EXCLUDED.company_address,
       footer_text = EXCLUDED.footer_text,
       digital_signature_base64 = EXCLUDED.digital_signature_base64,
       created_at = NOW()
     RETURNING *`,
    [companyId, input.companyDisplayName, input.companyAddress, input.footerText, input.digitalSignatureBase64]
  );
  return result.rows[0];
}

// Fetch company payroll configurations
export async function getPayrollSettings(companyId) {
  const result = await query(
    `SELECT company_id, company_display_name, company_address, footer_text, digital_signature_base64 
     FROM payroll_settings WHERE company_id = $1`,
    [companyId]
  );
  return result.rows[0] || {
    company_id: companyId,
    company_display_name: "",
    company_address: "",
    footer_text: "",
    digital_signature_base64: ""
  };
}

// Calculate payroll based on attendance log inputs
export async function calculatePayroll(companyId, year, month) {
  // 1. Get total working days in selected calendar month (excluding Sundays)
  const workingDays = getWorkingDaysInMonth(year, month);

  // 2. Fetch list of company team members
  const usersResult = await query(
    `SELECT id, full_name, email, role, salary_type, salary_rate, paid_leaves_limit 
     FROM app_users 
     WHERE company_id = $1 AND role != 'platform_admin' AND is_active = true`,
    [companyId]
  );
  const users = usersResult.rows;

  // 3. Fetch count of days present per employee in this month
  const presenceResult = await query(
    `SELECT 
       user_id,
       COUNT(DISTINCT punched_at::date)::int AS present_days
     FROM attendance_logs
     WHERE company_id = $1 
       AND EXTRACT(YEAR FROM punched_at) = $2
       AND EXTRACT(MONTH FROM punched_at) = $3
     GROUP BY user_id`,
    [companyId, year, month]
  );

  const presenceMap = {};
  presenceResult.rows.forEach(r => {
    presenceMap[r.user_id] = r.present_days;
  });

  // 4. Run calculation modes for each user
  const calculations = users.map(user => {
    const presentDays = presenceMap[user.id] || 0;
    const absentDays = Math.max(0, workingDays - presentDays);
    const leavesLimit = Number(user.paid_leaves_limit || 0);
    const rate = Number(user.salary_rate || 0);

    let grossSalary = 0;
    let paidLeavesUsed = 0;
    let unpaidLeavesUsed = 0;

    if (user.salary_type === "daily") {
      // Mode A: Daily Salary Rate
      // Paid leaves can cover absences up to limit
      paidLeavesUsed = Math.min(absentDays, leavesLimit);
      const paidDays = presentDays + paidLeavesUsed;
      grossSalary = Number((paidDays * rate).toFixed(2));
      unpaidLeavesUsed = absentDays - paidLeavesUsed;
    } else {
      // Mode B: Monthly Salary Rate
      const dailyRate = rate / workingDays;
      // Excess leaves are unpaid and deducted from monthly salary
      unpaidLeavesUsed = Math.max(0, absentDays - leavesLimit);
      paidLeavesUsed = Math.min(absentDays, leavesLimit);
      grossSalary = Number((rate - (unpaidLeavesUsed * dailyRate)).toFixed(2));
    }

    return {
      userId: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      salaryType: user.salary_type,
      salaryRate: rate,
      paidLeavesLimit: leavesLimit,
      workingDays,
      presentDays,
      absentDays,
      paidLeavesUsed,
      unpaidLeavesUsed,
      grossSalary,
      deductions: 0.00,
      netSalary: grossSalary
    };
  });

  return calculations;
}

// Lock calculated payslips
export async function savePayslip(companyId, input) {
  const result = await query(
    `INSERT INTO monthly_payroll (company_id, user_id, year, month, present_days, absent_days, paid_leaves_used, unpaid_leaves_used, gross_salary, deductions, net_salary, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (user_id, year, month) DO UPDATE SET 
       present_days = EXCLUDED.present_days,
       absent_days = EXCLUDED.absent_days,
       paid_leaves_used = EXCLUDED.paid_leaves_used,
       unpaid_leaves_used = EXCLUDED.unpaid_leaves_used,
       gross_salary = EXCLUDED.gross_salary,
       deductions = EXCLUDED.deductions,
       net_salary = EXCLUDED.net_salary,
       status = EXCLUDED.status,
       created_at = NOW()
     RETURNING *`,
    [
      companyId,
      input.userId,
      input.year,
      input.month,
      input.presentDays,
      input.absentDays,
      input.paidLeavesUsed,
      input.unpaidLeavesUsed,
      input.grossSalary,
      input.deductions || 0.00,
      input.netSalary,
      input.status || "approved"
    ]
  );
  return result.rows[0];
}

// Fetch historical locked salary slips
export async function listSavedPayslips(companyId, year, month, userId) {
  const params = [companyId];
  let filter = "";

  if (year) {
    params.push(year);
    filter += ` AND mp.year = $${params.length}`;
  }
  if (month) {
    params.push(month);
    filter += ` AND mp.month = $${params.length}`;
  }
  if (userId) {
    params.push(userId);
    filter += ` AND mp.user_id = $${params.length}`;
  }

  const result = await query(
    `SELECT 
       mp.id, mp.user_id, mp.year, mp.month, mp.present_days, mp.absent_days, 
       mp.paid_leaves_used, mp.unpaid_leaves_used, mp.gross_salary, mp.deductions, 
       mp.net_salary, mp.status, mp.created_at,
       u.full_name, u.email, u.role, u.salary_type, u.salary_rate
     FROM monthly_payroll mp
     JOIN app_users u ON u.id = mp.user_id
     WHERE mp.company_id = $1 ${filter}
     ORDER BY mp.year DESC, mp.month DESC, u.full_name ASC`,
    params
  );
  return result.rows;
}

// Helper: Calculate total working days in a month (excluding Sundays)
function getWorkingDaysInMonth(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    if (date.getDay() !== 0) { // 0 = Sunday
      count++;
    }
  }
  return count;
}
