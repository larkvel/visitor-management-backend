import 'dotenv/config.js';

const allowedOrigins = [
  'https://larkvel.com',
  'https://admin.larkvel.com',
  'https://api-visit.larkvel.com',
  'http://localhost:3000',
  'http://localhost:5173'
];

console.log('[CONFIG] Loading configuration...');
console.log('[CONFIG] NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('[CONFIG] PORT:', process.env.PORT || 'default (3000)');
console.log('[CONFIG] DATABASE_URL:', process.env.DATABASE_URL ? 'configured' : 'NOT SET');

export const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'larkvel-jwt-secret-change-in-production',
  corsOrigin: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (/^https:\/\/[a-z0-9-]+\.larkvel\.com$/.test(origin)) return callback(null, true);
      callback(new Error(`CORS not allowed for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
};

if (!config.databaseUrl) throw new Error('DATABASE_URL is required');

if (config.jwtSecret === 'larkvel-jwt-secret-change-in-production') {
  console.warn('[CONFIG] ⚠️  Using default JWT_SECRET. Set JWT_SECRET env var in production!');
}

console.log('[CONFIG] ✓ Configuration loaded successfully');
