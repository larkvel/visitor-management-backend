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
console.log('[CONFIG] Allowed CORS Origins:', allowedOrigins);
console.log('[CONFIG] DATABASE_URL:', process.env.DATABASE_URL ? 'configured' : 'NOT SET');

export const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS not allowed for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
};

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

console.log('[CONFIG] ✓ Configuration loaded successfully');