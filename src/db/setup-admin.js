import "dotenv/config.js";
import bcrypt from "bcryptjs";
import { query } from "./pool.js";

const adminPassword = process.env.ADMIN_PASSWORD || "Admin@1234";
console.log("[SETUP] Configuring platform admin credentials...");
const hash = await bcrypt.hash(adminPassword, 10);

const updateResult = await query(
  `UPDATE app_users SET username = 'platform_admin', password_hash = $1 WHERE role = 'platform_admin' RETURNING id, email`,
  [hash]
);

if (updateResult.rowCount === 0) {
  console.log("[SETUP] No platform_admin found. Creating one...");
  await query(
    `INSERT INTO app_users (full_name, email, role, username, password_hash)
     VALUES ('Platform Admin', 'admin@larkvel.com', 'platform_admin', 'platform_admin', $1)`,
    [hash]
  );
}

console.log("\n✓ Platform admin credentials configured:");
console.log("  Username : platform_admin");
console.log("  Password :", adminPassword);
console.log("\n  ⚠️  Change the password after first login!\n");
process.exit(0);
