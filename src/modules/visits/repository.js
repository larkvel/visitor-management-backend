import { query } from "../../db/pool.js";
import { badRequest, notFound } from "../../http.js";
import { getUser, hasPermission } from "../users/repository.js";

const visitSelect = `
  SELECT
    v.id,
    v.company_id,
    c.name AS company_name,
    v.location_id,
    l.name AS location_name,
    v.host_id,
    h.full_name AS host_name,
    v.visitor_name,
    v.visitor_email,
    v.visitor_phone,
    v.purpose,
    v.status,
    v.expected_at,
    v.checked_in_at,
    v.checked_out_at,
    v.created_by_user_id,
    creator.full_name AS created_by_name,
    v.created_at
  FROM visits v
  JOIN companies c ON c.id = v.company_id
  JOIN locations l ON l.id = v.location_id
  LEFT JOIN hosts h ON h.id = v.host_id
  LEFT JOIN app_users creator ON creator.id = v.created_by_user_id
`;

export async function listVisits(filters) {
  const params = [];
  const where = [];

  if (filters.companyId) {
    params.push(filters.companyId);
    where.push(`v.company_id = $${params.length}`);
  }

  if (filters.status) {
    params.push(filters.status);
    where.push(`v.status = $${params.length}`);
  }

  const result = await query(
    `
      ${visitSelect}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY
        CASE WHEN v.status = 'checked_in' THEN 0 ELSE 1 END,
        v.expected_at ASC
      LIMIT 100
    `,
    params
  );

  return result.rows;
}

export async function getVisit(id) {
  const result = await query(`${visitSelect} WHERE v.id = $1`, [id]);
  if (result.rowCount === 0) {
    throw notFound("Visit not found");
  }

  return result.rows[0];
}

export async function createVisit(input) {
  const actor = await getUser(input.actorUserId);
  if (!hasPermission(actor, "create_visit")) {
    throw badRequest("This user cannot create visits");
  }
  if (actor.company_id !== input.companyId) {
    throw badRequest("This user cannot create visits for this company");
  }

  const result = await query(
    `
      INSERT INTO visits (
        company_id,
        location_id,
        host_id,
        visitor_name,
        visitor_email,
        visitor_phone,
        purpose,
        expected_at,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `,
    [
      input.companyId,
      input.locationId,
      input.hostId || null,
      input.visitorName,
      input.visitorEmail || null,
