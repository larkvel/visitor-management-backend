import { z } from "zod";
import { badRequest } from "../../http.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { approveCompany, createCompany, createLocation, createHost, getPlatformDashboard, getCompanyBySubdomain, listCompanies, listHosts, listLocations, listPendingCompanies, updateCompany } from "./repository.js";

const createCompanySchema = z.object({
  name: z.string().min(2),
  industry: z.string().optional(),
  billingEmail: z.string().email().optional().or(z.literal("")),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  subscriptionPlan: z.enum(["starter", "business", "enterprise"]).optional(),
  accountStatus: z.enum(["pending", "trial", "active", "suspended", "cancelled"]).optional(),
  attendanceEnabled: z.boolean().optional(),
  payrollEnabled: z.boolean().optional()
});

export function registerCompanyRoutes(app) {
  app.get("/api/companies", requireAuth, async (_req, res, next) => {
    try { res.json(await listCompanies()); } catch (e) { next(e); }
  });

  app.get("/api/platform/dashboard", requireAuth, requireRole("platform_admin"), async (_req, res, next) => {
    try { res.json(await getPlatformDashboard()); } catch (e) { next(e); }
  });

  app.get("/api/admin/companies/pending", requireAuth, requireRole("platform_admin"), async (_req, res, next) => {
    try { res.json(await listPendingCompanies()); } catch (e) { next(e); }
  });

  app.post("/api/admin/companies/:companyId/approve", requireAuth, requireRole("platform_admin"), async (req, res, next) => {
    try {
      const { attendanceEnabled, payrollEnabled } = req.body;
      res.json(await approveCompany(req.params.companyId, attendanceEnabled, payrollEnabled));
    } catch (e) { next(e); }
  });

  app.get("/api/companies/by-subdomain/:subdomain", async (req, res, next) => {
    try { res.json(await getCompanyBySubdomain(req.params.subdomain)); } catch (e) { next(e); }
  });

  app.post("/api/companies", requireAuth, requireRole("platform_admin"), async (req, res, next) => {
    try {
      const parsed = createCompanySchema.safeParse(req.body);
      if (!parsed.success) throw badRequest("Company name is required");
      res.status(201).json(await createCompany(parsed.data));
    } catch (e) { next(e); }
  });

  app.put("/api/companies/:companyId", requireAuth, requireRole("platform_admin"), async (req, res, next) => {
    try {
      const parsed = createCompanySchema.safeParse(req.body);
      if (!parsed.success) throw badRequest("Company details are invalid");
      res.json(await updateCompany(req.params.companyId, parsed.data));
    } catch (e) { next(e); }
  });

  app.get("/api/companies/:companyId/locations", requireAuth, async (req, res, next) => {
    try {
      if (req.user.role !== "platform_admin" && req.params.companyId !== req.user.companyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(await listLocations(req.params.companyId));
    } catch (e) { next(e); }
  });
 
  app.post("/api/companies/:companyId/locations", requireAuth, requireRole("company_admin", "platform_admin"), async (req, res, next) => {
    try {
      if (req.user.role !== "platform_admin" && req.params.companyId !== req.user.companyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { name, address } = req.body;
      if (!name?.trim()) throw badRequest("Location name is required");
      res.status(201).json(await createLocation(req.params.companyId, { name, address }));
    } catch (e) { next(e); }
  });
 
  app.get("/api/companies/:companyId/hosts", requireAuth, async (req, res, next) => {
    try {
      if (req.user.role !== "platform_admin" && req.params.companyId !== req.user.companyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(await listHosts(req.params.companyId));
    } catch (e) { next(e); }
  });
 
  app.post("/api/companies/:companyId/hosts", requireAuth, requireRole("company_admin", "platform_admin"), async (req, res, next) => {
    try {
      if (req.user.role !== "platform_admin" && req.params.companyId !== req.user.companyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { fullName, email, department } = req.body;
      if (!fullName?.trim() || !email?.trim()) throw badRequest("Host name and email are required");
      res.status(201).json(await createHost(req.params.companyId, { fullName, email, department }));
    } catch (e) { next(e); }
  });
}
