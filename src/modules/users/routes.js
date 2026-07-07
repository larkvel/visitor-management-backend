import { z } from "zod";
import { badRequest } from "../../http.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { createUser, listUsers } from "./repository.js";

const createUserSchema = z.object({
  companyId: z.string().uuid(),
  fullName: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["company_admin", "reception", "executive", "viewer"]),
  username: z.string().min(3).max(50).optional().or(z.literal("").transform(() => undefined)),
  password: z.string().min(8).optional().or(z.literal("").transform(() => undefined))
});

export function registerUserRoutes(app) {
  app.get("/api/users", requireAuth, async (req, res, next) => {
    try { res.json(await listUsers(req.query.companyId)); }
    catch (error) { next(error); }
  });

  app.post("/api/users", requireAuth, requireRole("company_admin", "platform_admin"), async (req, res, next) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest("User details are invalid: " + parsed.error.errors.map(e => e.message).join(", "));
      res.status(201).json(await createUser(parsed.data));
    } catch (error) { next(error); }
  });
}
