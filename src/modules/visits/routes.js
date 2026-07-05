import { z } from "zod";
import { badRequest } from "../../http.js";
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
  app.get("/api/visits", async (req, res, next) => {
    try {
      res.json(await listVisits({
        companyId: req.query.companyId,
        status: req.query.status
      }));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/visits", async (req, res, next) => {
    try {
      const parsed = createVisitSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Visit details are invalid");
      }

      res.status(201).json(await createVisit(parsed.data));
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/visits/:id", async (req, res, next) => {
    try {
      const parsed = updateVisitSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Visit details are invalid");
      }

      res.json(await updateVisit(req.params.id, parsed.data));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/visits/:id/check-in", async (req, res, next) => {
    try {
      if (!req.body.actorUserId) {
        throw badRequest("actorUserId is required");
      }

      res.json(await updateVisitStatus(req.params.id, "checked_in", req.body.actorUserId));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/visits/:id/check-out", async (req, res, next) => {
    try {
      if (!req.body.actorUserId) {
        throw badRequest("actorUserId is required");
      }

      res.json(await updateVisitStatus(req.params.id, "checked_out", req.body.actorUserId));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/dashboard", async (req, res, next) => {
    try {
      if (!req.query.companyId) {
        throw badRequest("companyId is required");
      }

      res.json(await getDashboard(req.query.companyId));
    } catch (error) {
      next(error);
    }
  });
}
