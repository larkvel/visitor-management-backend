import { createApp } from "./app.js";
import { config } from "./config.js";
import { archiveOldVisits } from "./modules/visits/repository.js";

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

    // Start R2 background archiver - run every hour
    console.log('[SERVER] Starting R2 background archiver (1 hour interval)...');
    setInterval(async () => {
      console.log('[SERVER] Running background R2 archiving job...');
      try {
        await archiveOldVisits();
      } catch (err) {
        console.error('[SERVER] ✗ Error running background archiving job:', err.message);
      }
    }, 60 * 60 * 1000);

    // Initial check on startup (after 5 seconds)
    setTimeout(async () => {
      console.log('[SERVER] Running startup check for R2 archiving...');
      try {
        await archiveOldVisits();
      } catch (err) {
        console.error('[SERVER] ✗ Error running startup archiving check:', err.message);
      }
    }, 5000);
  });
} catch (error) {
  console.error('[SERVER] ✗ Failed to start server:', error.message);
  console.error('[SERVER] Stack:', error.stack);
  process.exit(1);
}
