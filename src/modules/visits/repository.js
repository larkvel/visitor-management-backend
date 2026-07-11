import { query } from "../../db/pool.js";
import { badRequest, notFound } from "../../http.js";
import { getUser, hasPermission } from "../users/repository.js";
import { r2 } from "../../r2.js";
import { sendVisitEmails } from "../../services/mailer.js";

const visitSelect = `
  SELECT
    v.id,
    v.company_id,
    c.name AS company_name,
    v.location_id,
    l.name AS location_name,
    v.host_id,
    v.host_user_id,
    COALESCE(v.host_name, h.full_name) AS host_name,
    COALESCE(v.host_email, h.email) AS host_email,
    h.department AS host_department,
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

export async function archiveOldVisits() {
  if (!r2.isEnabled()) {
    console.log("[ARCHIVE] Skipping archiving because R2 is not configured.");
    return;
  }

  try {
    // 1. Fetch visits older than 48 hours
    const oldVisitsResult = await query(
      `SELECT v.id, v.company_id, c.name AS company_name, v.location_id, l.name AS location_name,
              v.host_id, v.host_user_id, COALESCE(v.host_name, h.full_name) AS host_name, COALESCE(v.host_email, h.email) AS host_email, h.department AS host_department, v.visitor_name,
              v.visitor_email, v.visitor_phone, v.purpose, v.status, v.expected_at,
              v.checked_in_at, v.checked_out_at, v.created_by_user_id, creator.full_name AS created_by_name,
              v.created_at
       FROM visits v
       JOIN companies c ON c.id = v.company_id
       JOIN locations l ON l.id = v.location_id
       LEFT JOIN hosts h ON h.id = v.host_id
       LEFT JOIN app_users creator ON creator.id = v.created_by_user_id
       WHERE v.expected_at < NOW() - INTERVAL '48 hours'
       ORDER BY v.expected_at ASC`
    );

    const visits = oldVisitsResult.rows;
    if (visits.length === 0) {
      console.log("[ARCHIVE] No visits older than 48 hours to archive.");
      return;
    }

    console.log(`[ARCHIVE] Found ${visits.length} visits to archive. Grouping by company and date...`);

    // 2. Group by company_id and date(expected_at)
    const groups = {};
    for (const v of visits) {
      const date = new Date(v.expected_at).toISOString().split("T")[0];
      const groupKey = `${v.company_id}:${date}`;
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(v);
    }

    // 3. For each group, write/merge to R2, then delete from database
    for (const [groupKey, groupVisits] of Object.entries(groups)) {
      const [companyId, date] = groupKey.split(":");
      const r2Key = `companies/${companyId}/archive/${date}.json`;

      // Fetch existing archive file for that day from R2 (if any)
      const existing = await r2.getJSON(r2Key) || [];
      
      // Combine and filter out duplicates by ID
      const combined = [...existing];
      for (const newV of groupVisits) {
        if (!combined.some(x => x.id === newV.id)) {
          combined.push(newV);
        }
      }

      // Upload updated archive back to R2
      await r2.putJSON(r2Key, combined);
      
      // Delete visits from database
      const visitIds = groupVisits.map(x => x.id);
      await query(`DELETE FROM visits WHERE id = ANY($1)`, [visitIds]);
      
      console.log(`[ARCHIVE] Successfully archived ${visitIds.length} visits for company ${companyId} on date ${date}.`);
    }
  } catch (err) {
    console.error("[ARCHIVE] Error executing archiving job:", err.message);
  }
}

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

  const startDate = filters.startDate ? new Date(filters.startDate) : null;
  const endDate = filters.endDate ? new Date(filters.endDate) : null;

  // Cutoff is 48 hours ago (keep active database query inside 48 hours)
  const cutoffDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const queryR2 = startDate && startDate < cutoffDate;

  let dbVisits = [];
  // If no start date is specified, or range ends after cutoff, query Postgres
  if (!startDate || (endDate && endDate >= cutoffDate) || (!endDate && Date.now() >= cutoffDate)) {
    const dbWhere = [...where];
    const dbParams = [...params];

    if (startDate) {
      const effectiveStart = startDate > cutoffDate ? startDate : cutoffDate;
      dbParams.push(effectiveStart.toISOString().split("T")[0]);
      dbWhere.push(`v.expected_at::date >= $${dbParams.length}`);
    }
    if (endDate) {
      dbParams.push(endDate.toISOString().split("T")[0]);
      dbWhere.push(`v.expected_at::date <= $${dbParams.length}`);
    }

    const result = await query(
      `
        ${visitSelect}
        ${dbWhere.length ? `WHERE ${dbWhere.join(" AND ")}` : ""}
        ORDER BY
          CASE WHEN v.status = 'checked_in' THEN 0 ELSE 1 END,
          v.expected_at ASC
        LIMIT 100
      `,
      dbParams
    );
    dbVisits = result.rows;
  }

  let r2Visits = [];
  if (queryR2 && r2.isEnabled() && filters.companyId) {
    const r2End = (endDate && endDate < cutoffDate) ? endDate : cutoffDate;
    let current = new Date(startDate);
    const datesToFetch = [];

    while (current <= r2End) {
      datesToFetch.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }

    console.log(`[R2] Fetching archived logs for dates:`, datesToFetch);
    const fetchPromises = datesToFetch.map(d => 
      r2.getJSON(`companies/${filters.companyId}/archive/${d}.json`).catch(() => null)
    );

    const r2Results = await Promise.all(fetchPromises);
    for (const res of r2Results) {
      if (res && Array.isArray(res)) {
        r2Visits.push(...res);
      }
    }

    if (filters.status) {
      r2Visits = r2Visits.filter(v => v.status === filters.status);
    }
  }

  const combined = [...dbVisits, ...r2Visits];
  combined.sort((a, b) => {
    if (a.status === 'checked_in' && b.status !== 'checked_in') return -1;
    if (a.status !== 'checked_in' && b.status === 'checked_in') return 1;
    return new Date(a.expected_at) - new Date(b.expected_at);
  });

  return combined;
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
        host_user_id,
        host_name,
        host_email,
        visitor_name,
        visitor_email,
        visitor_phone,
        purpose,
        expected_at,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `,
    [
      input.companyId,
      input.locationId,
      input.hostId || null,
      input.hostUserId || null,
      input.hostName || null,
      input.hostEmail || null,
      input.visitorName,
      input.visitorEmail || null,
      input.visitorPhone || null,
      input.purpose,
      input.expectedAt,
      actor.id
    ]
  );

  const visit = await getVisit(result.rows[0].id);
  sendVisitEmails(visit).catch((err) => console.error("[EMAIL] Error sending pass email:", err));
  return visit;
}

export async function updateVisit(id, input) {
  const actor = await getUser(input.actorUserId);
  const existing = await getVisit(id);
  if (actor.company_id !== existing.company_id) {
    throw badRequest("This user cannot edit visits for this company");
  }

  const canEdit = hasPermission(actor, "edit_any_visit")
    || (hasPermission(actor, "edit_own_visit") && existing.created_by_user_id === actor.id);

  if (!canEdit) {
    throw badRequest("This user cannot edit this visit");
  }

  const result = await query(
    `
      UPDATE visits
      SET
        location_id = $2,
        host_id = $3,
        host_user_id = $4,
        host_name = $5,
        host_email = $6,
        visitor_name = $7,
        visitor_email = $8,
        visitor_phone = $9,
        purpose = $10,
        expected_at = $11,
        updated_by_user_id = $12,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [
      id,
      input.locationId,
      input.hostId || null,
      input.hostUserId || null,
      input.hostName || null,
      input.hostEmail || null,
      input.visitorName,
      input.visitorEmail || null,
      input.visitorPhone || null,
      input.purpose,
      input.expectedAt,
      actor.id
    ]
  );

  if (result.rowCount === 0) {
    throw notFound("Visit not found");
  }

  return getVisit(id);
}

export async function updateVisitStatus(id, status, actorUserId) {
  const actor = await getUser(actorUserId);
  if (!hasPermission(actor, "check_in_out")) {
    throw badRequest("This user cannot check visitors in or out");
  }
  const existing = await getVisit(id);
  if (actor.company_id !== existing.company_id) {
    throw badRequest("This user cannot check visitors for this company");
  }

  const timestampColumn = status === "checked_in" ? "checked_in_at" : "checked_out_at";
  const result = await query(
    `
      UPDATE visits
      SET status = $2, ${timestampColumn} = NOW(), updated_by_user_id = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [id, status, actor.id]
  );

  if (result.rowCount === 0) {
    throw notFound("Visit not found");
  }

  return getVisit(id);
}

export async function getDashboard(companyId) {
  const statsResult = await query(
    `
      SELECT
        COUNT(*) FILTER (WHERE status = 'expected')::int AS expected,
        COUNT(*) FILTER (WHERE status = 'checked_in')::int AS onsite,
        COUNT(*) FILTER (WHERE status = 'checked_out')::int AS completed,
        COUNT(*) FILTER (WHERE expected_at::date = CURRENT_DATE)::int AS today
      FROM visits
      WHERE company_id = $1
    `,
    [companyId]
  );

  const compResult = await query(
    `SELECT id, name, subdomain, attendance_enabled, payroll_enabled FROM companies WHERE id = $1`,
    [companyId]
  );
  
  const company = compResult.rows[0];

  return {
    ...statsResult.rows[0],
    company: company ? {
      id: company.id,
      name: company.name,
      subdomain: company.subdomain,
      attendanceEnabled: company.attendance_enabled,
      payrollEnabled: company.payroll_enabled
    } : null
  };
}

export async function processScanCheck(id) {
  let visit = null;
  try {
    const result = await query(
      `SELECT v.id, v.company_id, c.subdomain, v.visitor_name, v.status, v.checked_in_at, v.checked_out_at
       FROM visits v
       JOIN companies c ON c.id = v.company_id
       WHERE v.id = $1`,
      [id]
    );
    if (result.rowCount === 0) throw notFound("Visit not found");
    visit = result.rows[0];

    let newStatus = "";
    if (visit.status === "expected") {
      newStatus = "checked_in";
      await query(
        `UPDATE visits 
         SET status = 'checked_in', checked_in_at = NOW() 
         WHERE id = $1`,
        [id]
      );
    } else if (visit.status === "checked_in") {
      const checkedInAt = new Date(visit.checked_in_at).getTime();
      const now = Date.now();
      const elapsedSeconds = (now - checkedInAt) / 1000;
      if (elapsedSeconds < 30) {
        const waitTime = Math.ceil(30 - elapsedSeconds);
        throw badRequest(`Accidental scan detected. Please wait another ${waitTime} second(s) before checking out.`);
      }
      newStatus = "checked_out";
      await query(
        `UPDATE visits 
         SET status = 'checked_out', checked_out_at = NOW() 
         WHERE id = $1`,
        [id]
      );
    } else if (visit.status === "checked_out") {
      throw badRequest("Visitor has already checked out.");
    } else {
      throw badRequest(`Scan not supported for status: ${visit.status}`);
    }

    return {
      subdomain: visit.subdomain,
      visitorName: visit.visitor_name,
      newStatus
    };
  } catch (error) {
    if (visit) {
      error.subdomain = visit.subdomain;
    }
    throw error;
  }
}
