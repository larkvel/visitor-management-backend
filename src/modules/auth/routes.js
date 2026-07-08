import { z } from "zod";
import { badRequest } from "../../http.js";
import { loginUser, registerCompany } from "./repository.js";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  subdomain: z.string().optional().nullable()
});

const registerSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  adminName: z.string().min(2, "Your name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  industry: z.string().optional()
});

export function registerAuthRoutes(app) {
  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest("Username and password are required");
      res.json(await loginUser(parsed.data.username, parsed.data.password, parsed.data.subdomain));
    } catch (error) { next(error); }
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.errors.map(e => e.message).join(", "));
      res.status(201).json(await registerCompany(parsed.data));
    } catch (error) { next(error); }
  });
}
