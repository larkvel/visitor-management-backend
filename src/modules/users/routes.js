import { z } from "zod";
import { badRequest } from "../../http.js";
import { createUser, listUsers } from "./repository.js";

const createUserSchema = z.object({
  companyId: z.string().uuid(),
  fullName: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["company_admin", "reception", "executive", "viewer"])
});

export function registerUserRoutes(app) {
  app.get("/api/users", async (req, res, next) => {
    try {
      res.json(await listUsers(req.query.companyId));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/users", async (req, res, next) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("User details are invalid");
      }

      res.status(201).json(await createUser(parsed.data));
    } catch (error) {
      next(error);
    }
  });
}
