import bcrypt from "bcryptjs";
import { query } from "../../db/pool.js";
import { notFound } from "../../http.js";

export const rolePermissions = {
  platform_admin: ["platform_admin"],
  company_admin: ["manage_company", "manage_users", "create_visit", "edit_any_visit", "check_in_out"],
  reception: ["check_in_out"],
  executive: ["create_visit", "edit_own_visit"],
  viewer: ["view"]
};

export async function listUsers(companyId) {
  const params = [];
  const where = [];
  if (companyId) { params.push(companyId); where.push(`company_id = $${params.length}`); }
  const result = await query(
    `SELECT id, company_id, full_name, email, username, role, is_active, created_at, biometric_id, salary_type, salary_rate, paid_leaves_limit
     FROM app_users
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY role, full_name`,
    params
  );
  return result.rows.map(withPermissions);
}

export async function getUser(id) {
  const result = await query(
    `SELECT id, company_id, full_name, email, username, role, is_active, created_at, biometric_id, salary_type, salary_rate, paid_leaves_limit FROM app_users WHERE id = $1`,
    [id]
  );
  if (result.rowCount === 0) throw notFound("User not found");
  return withPermissions(result.rows[0]);
}

export async function createUser(input) {
  let passwordHash = null;
  if (input.password) passwordHash = await bcrypt.hash(input.password, 10);

  const result = await query(
    `INSERT INTO app_users (company_id, full_name, email, role, username, password_hash, biometric_id, salary_type, salary_rate, paid_leaves_limit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, company_id, full_name, email, username, role, is_active, created_at, biometric_id, salary_type, salary_rate, paid_leaves_limit`,
    [
      input.companyId, 
      input.fullName, 
      input.email, 
      input.role, 
      input.username || null, 
      passwordHash,
      input.biometricId || null,
      input.salaryType || "monthly",
      input.salaryRate || 0,
      input.paidLeavesLimit || 1.5
    ]
  );
  return withPermissions(result.rows[0]);
}

export function hasPermission(user, permission) {
  return Boolean(user?.permissions?.includes(permission));
}

function withPermissions(user) {
  return { ...user, permissions: rolePermissions[user.role] || [] };
}

export async function updateUserStatus(id, isActive) {
  const result = await query(
    `UPDATE app_users 
     SET is_active = $2 
     WHERE id = $1
     RETURNING id, company_id, full_name, email, username, role, is_active, created_at, biometric_id, salary_type, salary_rate, paid_leaves_limit`,
    [id, isActive]
  );
  if (result.rowCount === 0) throw notFound("User not found");
  return withPermissions(result.rows[0]);
}

export async function deleteUser(id) {
  const result = await query(
    `DELETE FROM app_users WHERE id = $1 RETURNING id`,
    [id]
  );
  if (result.rowCount === 0) throw notFound("User not found");
  return { id };
}

export async function updateUserRole(id, role) {
  const result = await query(
    `UPDATE app_users 
     SET role = $2 
     WHERE id = $1
     RETURNING id, company_id, full_name, email, username, role, is_active, created_at, biometric_id, salary_type, salary_rate, paid_leaves_limit`,
    [id, role]
  );
  if (result.rowCount === 0) throw notFound("User not found");
  return withPermissions(result.rows[0]);
}

export async function updateUserDetails(id, input) {
  const result = await query(
    `UPDATE app_users 
     SET full_name = $2, email = $3, biometric_id = $4, salary_type = $5, salary_rate = $6, paid_leaves_limit = $7 
     WHERE id = $1
     RETURNING id, company_id, full_name, email, username, role, is_active, created_at, biometric_id, salary_type, salary_rate, paid_leaves_limit`,
    [
      id,
      input.fullName,
      input.email,
      input.biometricId || null,
      input.salaryType || "monthly",
      input.salaryRate || 0,
      input.paidLeavesLimit || 1.5
    ]
  );
  if (result.rowCount === 0) throw notFound("User not found");
  return withPermissions(result.rows[0]);
}
