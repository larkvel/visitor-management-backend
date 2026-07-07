import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../../db/pool.js";
import { badRequest } from "../../http.js";
import { config } from "../../config.js";

function generateSubdomain(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").substring(0, 50);
}

export async function loginUser(username, password) {
  const result = await query(
    `SELECT u.id, u.username, u.full_name, u.email, u.role, u.password_hash,
            u.company_id, u.is_active,
            c.name AS company_name, c.account_status AS company_status, c.subdomain
     FROM app_users u
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.username = $1`,
    [username]
  );

  const user = result.rows[0];
  if (!user) throw badRequest("Invalid username or password");
  if (!user.is_active) throw badRequest("Your account has been deactivated");
  if (!user.password_hash) throw badRequest("Account setup incomplete. Contact your administrator.");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw badRequest("Invalid username or password");

  if (user.company_id && user.company_status !== "active") {
    throw badRequest("Your company account is not active yet. Please wait for admin approval.");
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role, companyId: user.company_id, companyName: user.company_name },
    config.jwtSecret,
    { expiresIn: "8h" }
  );

  return {
    token,
    user: {
      id: user.id, username: user.username, fullName: user.full_name,
      email: user.email, role: user.role,
      companyId: user.company_id, companyName: user.company_name, subdomain: user.subdomain
    }
  };
}

export async function registerCompany(input) {
  const subdomain = generateSubdomain(input.companyName);

  const existing = await query(`SELECT id FROM companies WHERE subdomain = $1`, [subdomain]);
  if (existing.rows.length > 0) {
    throw badRequest(`The name "${input.companyName}" is already taken. Please choose a different company name.`);
  }

  await query(
    `INSERT INTO companies (name, subdomain, industry, billing_email, contact_name, contact_phone, subscription_plan, account_status)
     VALUES ($1, $2, $3, $4, $5, $6, 'starter', 'pending')`,
    [input.companyName, subdomain, input.industry || null, input.email, input.adminName, input.phone || null]
  );

  return { message: "Registration submitted! Your company account is pending admin approval. You will receive login credentials once approved." };
}
