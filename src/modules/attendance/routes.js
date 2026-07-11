import { requireAuth, requireRole } from "../../middleware/auth.js";
import { badRequest } from "../../http.js";
import {
  logBiometricPunch,
  listAttendance,
  getAttendanceStats,
  createLeaveRequest,
  listLeaveRequests,
  updateLeaveRequestStatus,
  getEmployeeAttendanceSummary
} from "./repository.js";

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

  // Employee personal monthly attendance summary
  app.get("/api/attendance/my-summary", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const companyId = req.user.companyId;
      if (!companyId) throw badRequest("companyId is required");
      res.json(await getEmployeeAttendanceSummary(userId, companyId));
    } catch (error) { next(error); }
  });

  // Submit a leave request (any employee)
  app.post("/api/leave-requests", requireAuth, async (req, res, next) => {
    try {
      const companyId = req.user.companyId;
      const userId = req.user.userId;
      if (!companyId) throw badRequest("companyId is required");
      const { leaveType, fromDate, toDate, reason } = req.body;
      if (!fromDate || !toDate) throw badRequest("fromDate and toDate are required");
      res.status(201).json(await createLeaveRequest(companyId, userId, { leaveType, fromDate, toDate, reason }));
    } catch (error) { next(error); }
  });

  // List leave requests — employees see own, admins see all
  app.get("/api/leave-requests", requireAuth, async (req, res, next) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) throw badRequest("companyId is required");

      const isAdmin = req.user.role === "company_admin" || req.user.role === "platform_admin";
      // Employees only see their own requests; admins see all (or filter by userId)
      const userId = isAdmin ? (req.query.userId || null) : req.user.userId;

      res.json(await listLeaveRequests(companyId, userId));
    } catch (error) { next(error); }
  });

  // Approve or reject a leave request (admin only)
  app.put("/api/leave-requests/:id/status", requireAuth, requireRole("company_admin", "platform_admin"), async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!["approved", "rejected"].includes(status)) throw badRequest("status must be 'approved' or 'rejected'");
      res.json(await updateLeaveRequestStatus(req.params.id, status, req.user.userId));
    } catch (error) { next(error); }
  });
}
