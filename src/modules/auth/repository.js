import { query } from "../../db/pool.js";
import { badRequest } from "../../http.js";

// Convert company name to subdomain format
function generateSubdomain(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

export async function checkSubdomainExists(subdomain) {
  const result = await query(
    `SELECT COUNT(*) as count FROM companies WHERE subdomain = $1`,
    [subdomain]
  );
  return result.rows[0].count > 0;
}

export async function registerCompany(input) {
  const subdomain = generateSubdomain(input.name);
  
  // Check if subdomain already exists
  const exists = await checkSubdomainExists(subdomain);
  if (exists) {
    throw badRequest(`Subdomain '${subdomain}' is already taken. Please try a different company name.`);
  }

  // Create company with trial status
  const result = await query(
    `
      INSERT INTO companies (
        name,
        subdomain,
        industry,
        billing_email,
        contact_name,
        contact_phone,
        subscription_plan,
        account_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, subdomain, subscription_plan, account_status, created_at
    `,
    [
      input.name,
      subdomain,
      input.industry || null,
      input.email,
      input.name,
      input.phone || null,
      "starter",
      "trial"
    ]
  );

  if (!result.rows[0]) {
    throw badRequest("Failed to register company");
  }

  return {
    ...result.rows[0],
    message: `Company registered successfully! Access your dashboard at ${subdomain}.larkvel.com`,
    nextSteps: [
      "Create your first location",
      "Add team members",
      "Set up visitor check-in",
      "Await admin approval to go live"
    ]
  };
}