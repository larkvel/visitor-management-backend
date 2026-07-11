import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerCompanyRoutes } from "./modules/companies/routes.js";
import { registerUserRoutes } from "./modules/users/routes.js";
import { registerVisitRoutes } from "./modules/visits/routes.js";
import { registerAttendanceRoutes } from "./modules/attendance/routes.js";
import { registerPayrollRoutes } from "./modules/payroll/routes.js";

console.log('[APP] Creating Express application...');

// Strict limiter for login / register — 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again after 15 minutes" }
});

// General API limiter — 200 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please slow down" }
});

export function createApp() {
  const app = express();

  console.log('[APP] Setting up CORS middleware...');
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  console.log('[APP] Setting up rate limiting...');
  app.use("/api/auth", authLimiter);
  app.use("/api", apiLimiter);
  console.log('[APP] ✓ Rate limiters applied');

  console.log('[APP] Setting up health check endpoint...');

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  console.log('[APP] ✓ Health check endpoint registered');
  console.log('[APP] Registering API routes...');
  
  registerAuthRoutes(app);
  console.log('[APP] ✓ Auth routes registered');
  
  registerCompanyRoutes(app);
  console.log('[APP] ✓ Company routes registered');
  
  registerUserRoutes(app);
  console.log('[APP] ✓ User routes registered');
  
  registerVisitRoutes(app);
  console.log('[APP] ✓ Visit routes registered');

  registerAttendanceRoutes(app);
  console.log('[APP] ✓ Attendance routes registered');

  registerPayrollRoutes(app);
  console.log('[APP] ✓ Payroll routes registered');

  app.use((error, _req, res, _next) => {
    console.error('[APP] Error handler triggered:', error.message);
    const status = error.status || 500;
    res.status(status).json({
      message: status === 500 ? "Internal server error" : error.message
    });
  });

  console.log('[APP] ✓ Error handler registered');
  console.log('[APP] Ready to accept requests!');

  return app;
}
