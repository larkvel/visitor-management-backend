import { z } from "zod";
import { badRequest } from "../../http.js";
import { registerCompany } from "./repository.js";

const registerCompanySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  industry: z.string().optional()
});

export function registerAuthRoutes(app) {
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const parsed = registerCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        const errors = parsed.error.errors.map(e => e.message).join(", ");
        throw badRequest(errors);
      }

      const result = await registerCompany(parsed.data);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/register/verify-subdomain", async (req, res, next) => {
    try {
      const { subdomain } = req.body;
      if (!subdomain || subdomain.length < 2) {
        throw badRequest("Subdomain must be at least 2 characters");
      }

      // Check if subdomain is already taken
      const { checkSubdomainExists } = await import("./repository.js");
      const exists = await checkSubdomainExists(subdomain);
      
      res.json({ available: !exists });
    } catch (error) {
      next(error);
    }
  });
}