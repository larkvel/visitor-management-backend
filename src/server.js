import { createApp } from "./app.js";
import { config } from "./config.js";

console.log('[SERVER] Initializing Visitor Management API...');

try {
  const app = createApp();
  console.log('[SERVER] ✓ Express app created');

  app.listen(config.port, () => {
    console.log('[SERVER] ═══════════════════════════════════════');
    console.log(`[SERVER] ✓ API listening on port ${config.port}`);
    console.log(`[SERVER] ✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[SERVER] ✓ CORS enabled for: ${config.corsOrigin}`);
    console.log('[SERVER] ═══════════════════════════════════════');
    console.log('[SERVER] Ready to accept requests!');
  });
} catch (error) {
  console.error('[SERVER] ✗ Failed to start server:', error.message);
  console.error('[SERVER] Stack:', error.stack);
  process.exit(1);
}
