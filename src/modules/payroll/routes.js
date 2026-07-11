import { requireAuth } from "../../middleware/auth.js";
import { badRequest } from "../../http.js";
import { calculatePayroll, getPayrollSettings, listSavedPayslips, savePayrollSettings, savePayslip } from "./repository.js";

export function registerPayrollRoutes(app) {
  // Save custom company payslip template configurations
  app.post("/api/payroll/settings", requireAuth, async (req, res, next) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) throw badRequest("companyId is required");

      const result = await savePayrollSettings(companyId, req.body);
      res.json(result);
    } catch (error) { next(error); }
  });

  // Fetch company payslip template configurations
  app.get("/api/payroll/settings", requireAuth, async (req, res, next) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) throw badRequest("companyId is required");

      res.json(await getPayrollSettings(companyId));
    } catch (error) { next(error); }
  });

  // Trigger monthly computations (returns list of all employees calculated salaries)
  app.get("/api/payroll/calculate", requireAuth, async (req, res, next) => {
    try {
      const companyId = req.user.role === "platform_admin" ? req.query.companyId : req.user.companyId;
      if (!companyId) throw badRequest("companyId is required");

      const year = parseInt(req.query.year);
      const month = parseInt(req.query.month);

      if (!year || !month) throw badRequest("year and month query parameters are required");

      res.json(await calculatePayroll(companyId, year, month));
    } catch (error) { next(error); }
  });

  // Lock employee salary slip
  app.post("/api/payroll/slips", requireAuth, async (req, res, next) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) throw badRequest("companyId is required");

      const result = await savePayslip(companyId, req.body);
      res.status(201).json(result);
    } catch (error) { next(error); }
  });

  // List historical locked payslips
  app.get("/api/payroll/slips", requireAuth, async (req, res, next) => {
    try {
      const companyId = req.user.role === "platform_admin" ? req.query.companyId : req.user.companyId;
      if (!companyId) throw badRequest("companyId is required");

      const year = req.query.year ? parseInt(req.query.year) : undefined;
      const month = req.query.month ? parseInt(req.query.month) : undefined;
      
      // Regular employees can only view their own slips!
      const userId = req.user.role === "company_admin" || req.user.role === "platform_admin" 
        ? (req.query.userId || undefined) 
        : req.user.userId;

      res.json(await listSavedPayslips(companyId, year, month, userId));
    } catch (error) { next(error); }
  });
}
