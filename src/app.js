import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { registerCompanyRoutes } from "./modules/companies/routes.js";
import { registerUserRoutes } from "./modules/users/routes.js";
import { registerVisitRoutes } from "./modules/visits/routes.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  registerCompanyRoutes(app);
  registerUserRoutes(app);
  registerVisitRoutes(app);

  app.use((error, _req, res, _next) => {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({
      message: status === 500 ? "Internal server error" : error.message
    });
  });

  return app;
}
