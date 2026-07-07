import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { registerCompanyRoutes } from "./modules/companies/routes.js";
import { registerUserRoutes } from "./modules/users/routes.js";
import { registerVisitRoutes } from "./modules/visits/routes.js";

console.log('[APP] Creating Express application...');

export function createApp() {
  const app = express();

  console.log('[APP] Setting up CORS middleware...');
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  console.log('[APP] Setting up health check endpoint...');

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  console.log('[APP] ✓ Health check endpoint registered');
  console.log('[APP] Registering API routes...');
  
  registerCompanyRoutes(app);
  console.log('[APP] ✓ Company routes registered');
  
  registerUserRoutes(app);
  console.log('[APP] ✓ User routes registered');
  
  registerVisitRoutes(app);
  console.log('[APP] ✓ Visit routes registered');

  app.use((error, _req, res, _next) => {
    console.error('[APP] Error handler triggered:', error.message);
    const status = error.status || 500;
    res.status(status).json({
      message: status === 500 ? "Internal server error" : error.message
    });
  });

  console.log('[APP] ✓ Express app fully configured');

  return app;
}
