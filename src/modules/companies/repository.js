import bcrypt from "bcryptjs";
import { query } from "../../db/pool.js";
import { badRequest, notFound } from "../../http.js";

function generatePassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

export async function listCompanies() {
  const result = await query(
    `SELECT c.id, c.name, c.subdomain, c.industry, c.billing_email, c.contact_name, c.contact_phone,
            c.subscription_plan, c.account_status, c.attendance_enabled, c.payroll_enabled, c.created_at,
            COUNT(DISTINCT u.id)::int AS user_count,
            COUNT(DISTINCT v.id)::int AS visit_count,
            COALESCE(json_agg(json_build_object('id',l.id,'name',l.name,'address',l.address)) FILTER (WHERE l.id IS NOT NULL),'[]') AS locations
     FROM companies c
     LEFT JOIN locations l ON l.company_id = c.id
     LEFT JOIN app_users u ON u.company_id = c.id
     LEFT JOIN visits v ON v.company_id = c.id
     GROUP BY c.id
     ORDER BY c.created_at DESC`
  );
  return result.rows;
}

export async function listPendingCompanies() {
  const result = await query(
    `SELECT id, name, subdomain, industry, billing_email, contact_name, contact_phone,
            subscription_plan, account_status, created_at
     FROM companies
     WHERE account_status = 'pending'
     ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function approveCompany(companyId) {
  const compResult = await query(
    `UPDATE companies SET account_status = 'active' WHERE id = $1 RETURNING *`,
    [companyId]
  );
  if (!compResult.rows[0]) throw notFound("Company not found");
  const company = compResult.rows[0];

  const username = company.subdomain + "_admin";
  const password = generatePassword();
  const hash = await bcrypt.hash(password, 10);

  await query(
    `INSERT INTO app_users (company_id, full_name, email, role, username, password_hash)
     VALUES ($1, $2, $3, 'company_admin', $4, $5)
     ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username, password_hash = EXCLUDED.password_hash`,
    [company.id, company.contact_name || company.name, company.billing_email, username, hash]
  );

  return {
    company,
    adminCredentials: { username, password, loginUrl: `https://${company.subdomain}.larkvel.com` }
  };
}

export async function createCompany(input) {
  const result = await query(
    `INSERT INTO companies (name, industry, billing_email, contact_name, contact_phone, subscription_plan, account_status, attendance_enabled, payroll_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [input.name, input.industry || null, input.billingEmail || null, input.contactName || null,
     input.contactPhone || null, input.subscriptionPlan || "starter", input.accountStatus || "trial",
     input.attendanceEnabled || false, input.payrollEnabled || false]
  );
  return result.rows[0];
}

export async function updateCompany(id, input) {
  const result = await query(
    `UPDATE companies SET name=$2, industry=$3, billing_email=$4, contact_name=$5,
     contact_phone=$6, subscription_plan=$7, account_status=$8, attendance_enabled=$9, payroll_enabled=$10 WHERE id=$1 RETURNING *`,
    [id, input.name, input.industry || null, input.billingEmail || null, input.contactName || null,
     input.contactPhone || null, input.subscriptionPlan, input.accountStatus, input.attendanceEnabled || false, input.payrollEnabled || false]
  );
  return result.rows[0];
}

export async function getPlatformDashboard() {
  const result = await query(
    `SELECT COUNT(*)::int AS companies,
       COUNT(*) FILTER (WHERE account_status = 'active')::int AS active_companies,
       (SELECT COUNT(*)::int FROM app_users WHERE company_id IS NOT NULL) AS company_users,
       (SELECT COUNT(*)::int FROM visits) AS visits
     FROM companies`
  );
  return result.rows[0];
}

export async function listHosts(companyId) {
  const result = await query(
    `SELECT id, full_name, email, department FROM hosts WHERE company_id = $1 ORDER BY full_name`,
    [companyId]
  );
  return result.rows;
}

export async function createHost(companyId, input) {
  const result = await query(
    `INSERT INTO hosts (company_id, full_name, email, department) VALUES ($1, $2, $3, $4)
     ON CONFLICT (company_id, email) DO UPDATE SET full_name = EXCLUDED.full_name, department = EXCLUDED.department
     RETURNING id, full_name, email, department`,
    [companyId, input.fullName.trim(), input.email.trim(), input.department?.trim() || null]
  );
  return result.rows[0];
}

export async function listLocations(companyId) {
  const result = await query(
    `SELECT id, name, address FROM locations WHERE company_id = $1 ORDER BY name`,
    [companyId]
  );
  return result.rows;
}

export async function createLocation(companyId, input) {
  const result = await query(
    `INSERT INTO locations (company_id, name, address) VALUES ($1, $2, $3) RETURNING id, name, address`,
    [companyId, input.name.trim(), input.address?.trim() || null]
  );
  return result.rows[0];
}

export async function getCompanyBySubdomain(subdomain) {
  const result = await query(
    `SELECT id, name, subdomain FROM companies WHERE subdomain = $1`,
    [subdomain.toLowerCase()]
  );
  if (result.rowCount === 0) throw notFound("Company not found");
  return result.rows[0];
}

export async function getHostById(id) {
  const result = await query(
    `SELECT id, company_id, full_name, email, department FROM hosts WHERE id = $1`,
    [id]
  );
  if (result.rowCount === 0) return null;
  return result.rows[0];
}
