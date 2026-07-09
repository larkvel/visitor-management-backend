import { z } from "zod";
import { badRequest } from "../../http.js";
import { requireAuth } from "../../middleware/auth.js";
import { createVisit, getDashboard, listVisits, updateVisit, updateVisitStatus } from "./repository.js";

const createVisitSchema = z.object({
  companyId: z.string().uuid(),
  actorUserId: z.string().uuid(),
  locationId: z.string().uuid(),
  hostId: z.string().uuid().optional().or(z.literal("")),
  visitorName: z.string().min(2),
  visitorEmail: z.string().email().optional().or(z.literal("")),
  visitorPhone: z.string().optional(),
  purpose: z.string().min(2),
  expectedAt: z.string().datetime()
});

const updateVisitSchema = createVisitSchema.omit({ companyId: true });

export function registerVisitRoutes(app) {
  app.get("/api/visits", requireAuth, async (req, res, next) => {
    try {
      const companyId = req.user.role === "platform_admin" ? req.query.companyId : req.user.companyId;
      if (!companyId) throw badRequest("companyId is required");
      res.json(await listVisits({ 
        companyId, 
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      }));
    } catch (error) { next(error); }
  });

  app.post("/api/visits", requireAuth, async (req, res, next) => {
    try {
      const parsed = createVisitSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest("Visit details are invalid");
      
      const companyId = req.user.role === "platform_admin" ? parsed.data.companyId : req.user.companyId;
      res.status(201).json(await createVisit({ ...parsed.data, companyId }));
    } catch (error) { next(error); }
  });

  app.put("/api/visits/:id", requireAuth, async (req, res, next) => {
    try {
      const parsed = updateVisitSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest("Visit details are invalid");
      res.json(await updateVisit(req.params.id, parsed.data));
    } catch (error) { next(error); }
  });

  app.post("/api/visits/:id/check-in", requireAuth, async (req, res, next) => {
    try {
      const actorUserId = req.body.actorUserId || req.user.userId;
      if (!actorUserId) throw badRequest("actorUserId is required");
      res.json(await updateVisitStatus(req.params.id, "checked_in", actorUserId));
    } catch (error) { next(error); }
  });

  app.post("/api/visits/:id/check-out", requireAuth, async (req, res, next) => {
    try {
      const actorUserId = req.body.actorUserId || req.user.userId;
      if (!actorUserId) throw badRequest("actorUserId is required");
      res.json(await updateVisitStatus(req.params.id, "checked_out", actorUserId));
    } catch (error) { next(error); }
  });

  app.get("/api/dashboard", requireAuth, async (req, res, next) => {
    try {
      const companyId = req.user.role === "platform_admin" ? req.query.companyId : req.user.companyId;
      if (!companyId) throw badRequest("companyId is required");
      res.json(await getDashboard(companyId));
    } catch (error) { next(error); }
  });
}
