import { z } from "zod";
import { badRequest } from "../../http.js";
import { createCompany, getPlatformDashboard, listCompanies, listHosts, listLocations, updateCompany, getCompanyBySubdomain } from "./repository.js";

const createCompanySchema = z.object({
  name: z.string().min(2),
  industry: z.string().optional(),
  billingEmail: z.string().email().optional().or(z.literal("")),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  subscriptionPlan: z.enum(["starter", "business", "enterprise"]).optional(),
  accountStatus: z.enum(["trial", "active", "suspended", "cancelled"]).optional()
});

export function registerCompanyRoutes(app) {
  app.get("/api/companies", async (_req, res, next) => {
    try {
      res.json(await listCompanies());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/platform/dashboard", async (_req, res, next) => {
    try {
      res.json(await getPlatformDashboard());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/companies/by-subdomain/:subdomain", async (req, res, next) => {
    try {
      res.json(await getCompanyBySubdomain(req.params.subdomain));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/companies", async (req, res, next) => {
    try {
      const parsed = createCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Company name is required");
      }

      res.status(201).json(await createCompany(parsed.data));
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/companies/:companyId", async (req, res, next) => {
    try {
      const parsed = createCompanySchema.required({
        subscriptionPlan: true,
        accountStatus: true
      }).safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Company details are invalid");
      }

      res.json(await updateCompany(req.params.companyId, parsed.data));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/companies/:companyId/hosts", async (req, res, next) => {
    try {
      res.json(await listHosts(req.params.companyId));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/companies/:companyId/locations", async (req, res, next) => {
    try {
      res.json(await listLocations(req.params.companyId));
    } catch (error) {
      next(error);
    }
  });
}
