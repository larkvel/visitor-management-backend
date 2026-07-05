# Visitor Management Backend

Node.js + Express.js backend API for the Visitor Management SaaS platform.

## Features

- Company management (CRUD operations)
- User management with role-based permissions
- Visitor registration and check-in/check-out
- Dashboard metrics and reporting
- PostgreSQL database with migrations

## Tech Stack

- **Runtime**: Node.js 22
- **Framework**: Express.js 4.19.2
- **Database**: PostgreSQL (via Neon)
- **Validation**: Zod 3.23.8
- **CORS**: CORS 2.8.5

## Setup

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```
DATABASE_URL=postgresql://...
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:8080
```

3. Run migrations:
```bash
npm run migrate
```

4. Start server:
```bash
npm start
```

Server will be available at `http://localhost:3000`

### Docker
