import { z } from "zod";
import { badRequest } from "../../http.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { createUser, listUsers, updateUserStatus, deleteUser, getUser } from "./repository.js";

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
    try {
      const companyId = req.user.role === "platform_admin" ? req.query.companyId : req.user.companyId;
      if (!companyId) throw badRequest("companyId is required");
      res.json(await listUsers(companyId));
    }
    catch (error) { next(error); }
  });

  app.post("/api/users", requireAuth, requireRole("company_admin", "platform_admin"), async (req, res, next) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest("User details are invalid: " + parsed.error.errors.map(e => e.message).join(", "));
      
      const companyId = req.user.role === "platform_admin" ? parsed.data.companyId : req.user.companyId;
      res.status(201).json(await createUser({ ...parsed.data, companyId }));
    } catch (error) { next(error); }
  });

  app.put("/api/users/:id/status", requireAuth, requireRole("company_admin", "platform_admin"), async (req, res, next) => {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") throw badRequest("isActive boolean is required");
      
      const targetUser = await getUser(req.params.id);
      if (req.user.role !== "platform_admin" && targetUser.company_id !== req.user.companyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (targetUser.id === req.user.userId) {
        throw badRequest("You cannot deactivate or toggle status of your own account");
      }

      res.json(await updateUserStatus(req.params.id, isActive));
    } catch (error) { next(error); }
  });

  app.delete("/api/users/:id", requireAuth, requireRole("company_admin", "platform_admin"), async (req, res, next) => {
    try {
      const targetUser = await getUser(req.params.id);
      if (req.user.role !== "platform_admin" && targetUser.company_id !== req.user.companyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (targetUser.id === req.user.userId) {
        throw badRequest("You cannot delete your own account");
      }

      res.json(await deleteUser(req.params.id));
    } catch (error) { next(error); }
  });
}
