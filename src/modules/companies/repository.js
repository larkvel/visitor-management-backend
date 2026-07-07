import { query } from "../../db/pool.js";
import { notFound } from "../../http.js";

export async function listCompanies() {
  const result = await query(
    `
      SELECT
        c.id,
        c.name,
        c.industry,
        c.billing_email,
        c.contact_name,
        c.contact_phone,
        c.subscription_plan,
        c.account_status,
        c.created_at,
        COUNT(DISTINCT u.id)::int AS user_count,
        COUNT(DISTINCT v.id)::int AS visit_count,
        COALESCE(
          json_agg(
            json_build_object(
              'id', l.id,
              'name', l.name,
              'address', l.address
            )
          ) FILTER (WHERE l.id IS NOT NULL),
          '[]'
        ) AS locations
      FROM companies c
      LEFT JOIN locations l ON l.company_id = c.id
      LEFT JOIN app_users u ON u.company_id = c.id
      LEFT JOIN visits v ON v.company_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `
  );

  return result.rows;
}

export async function createCompany(input) {
  const client = await query(
    `
      INSERT INTO companies (
        name,
        industry,
        billing_email,
        contact_name,
        contact_phone,
        subscription_plan,
        account_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      input.name,
      input.industry || null,
      input.billingEmail || null,
      input.contactName || null,
      input.contactPhone || null,
      input.subscriptionPlan || "starter",
      input.accountStatus || "trial"
    ]
  );

  return client.rows[0];
}

export async function updateCompany(id, input) {
  const result = await query(
    `
      UPDATE companies
      SET
        name = $2,
        industry = $3,
        billing_email = $4,
        contact_name = $5,
        contact_phone = $6,
        subscription_plan = $7,
        account_status = $8
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      input.name,
      input.industry || null,
      input.billingEmail || null,
      input.contactName || null,
      input.contactPhone || null,
      input.subscriptionPlan,
      input.accountStatus
    ]
  );

  return result.rows[0];
}

export async function getPlatformDashboard() {
  const result = await query(
    `
      SELECT
        COUNT(*)::int AS companies,
        COUNT(*) FILTER (WHERE account_status = 'active')::int AS active_companies,
        (SELECT COUNT(*)::int FROM app_users WHERE company_id IS NOT NULL) AS company_users,
        (SELECT COUNT(*)::int FROM visits) AS visits
      FROM companies
    `
  );

  return result.rows[0];
}

export async function listHosts(companyId) {
  const result = await query(
    `
      SELECT id, full_name, email, department
      FROM hosts
      WHERE company_id = $1
      ORDER BY full_name
    `,
    [companyId]
  );

  return result.rows;
}

export async function listLocations(companyId) {
  const result = await query(
    `
      SELECT id, name, address
      FROM locations
      WHERE company_id = $1
      ORDER BY name
    `,
    [companyId]
  );

  return result.rows;
}

export async function getCompanyBySubdomain(subdomain) {
  const result = await query(
    `
      SELECT id, name
      FROM companies
      WHERE LOWER(SPLIT_PART(name, ' ', 1)) = LOWER($1)
      LIMIT 1
    `,
    [subdomain]
  );

  if (result.rowCount === 0) {
    throw notFound("Company not found");
  }

  return result.rows[0];
}
