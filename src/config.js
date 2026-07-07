import 'dotenv/config.js';

console.log('[CONFIG] Loading configuration...');
console.log('[CONFIG] NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('[CONFIG] PORT:', process.env.PORT || 'default (3000)');
console.log('[CONFIG] CORS_ORIGIN:', process.env.CORS_ORIGIN || 'default (*)');
console.log('[CONFIG] DATABASE_URL:', process.env.DATABASE_URL ? 'configured' : 'NOT SET');

export const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: process.env.CORS_ORIGIN || "*"
};

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

console.log('[CONFIG] ✓ Configuration loaded successfully');
