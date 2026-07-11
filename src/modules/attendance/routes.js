import { requireAuth } from "../../middleware/auth.js";
import { badRequest } from "../../http.js";
import { logBiometricPunch, listAttendance, getAttendanceStats } from "./repository.js";

export function registerAttendanceRoutes(app) {
  // Public Biometric Punch Webhook
  app.post("/api/attendance/biometric-punch/:subdomain", async (req, res, next) => {
    try {
      const { subdomain } = req.params;
      const { biometricId, punchedAt, punchType, deviceInfo } = req.body;
      if (!biometricId) throw badRequest("biometricId is required");

      const result = await logBiometricPunch(subdomain, biometricId, punchedAt, punchType, deviceInfo);
      res.status(201).json(result);
    } catch (error) { next(error); }
  });

  // Get daily attendance logs (Authenticated)
  app.get("/api/attendance", requireAuth, async (req, res, next) => {
    try {
      const companyId = req.user.role === "platform_admin" ? req.query.companyId : req.user.companyId;
      if (!companyId) throw badRequest("companyId is required");

      const { startDate, endDate } = req.query;
      res.json(await listAttendance(companyId, startDate, endDate));
    } catch (error) { next(error); }
  });

  // Get attendance stats (Authenticated)
  app.get("/api/attendance/stats", requireAuth, async (req, res, next) => {
    try {
      const companyId = req.user.role === "platform_admin" ? req.query.companyId : req.user.companyId;
      if (!companyId) throw badRequest("companyId is required");

      res.json(await getAttendanceStats(companyId));
    } catch (error) { next(error); }
  });
}
