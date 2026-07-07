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

Build and run with Docker:
```bash
docker build -t visitor-management-api .
docker run -p 3000:3000 \
  -e DATABASE_URL=$DATABASE_URL \
  -e CORS_ORIGIN=$CORS_ORIGIN \
  visitor-management-api
```

Or with Docker Compose:
```bash
DATABASE_URL=postgresql://... CORS_ORIGIN=... docker-compose up
```

## API Endpoints

### Companies
- `GET /api/companies` - List all companies
- `POST /api/companies` - Create company
- `PUT /api/companies/:companyId` - Update company
- `GET /api/companies/:companyId/locations` - List company locations
- `GET /api/companies/:companyId/hosts` - List company hosts
- `GET /api/companies/by-subdomain/:subdomain` - Get company by subdomain

### Users
- `GET /api/users?companyId=...` - List users
- `POST /api/users` - Create user

### Visits
- `GET /api/visits?companyId=...` - List visits
- `POST /api/visits` - Create visit
- `PUT /api/visits/:id` - Update visit
- `POST /api/visits/:id/check-in` - Check in visitor
- `POST /api/visits/:id/check-out` - Check out visitor
- `GET /api/dashboard?companyId=...` - Get company dashboard

### Health
- `GET /health` - Health check

## Database Migrations

Migrations are automatically applied on startup. Migration files are located in `migrations/`.

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (required)
- `NODE_ENV` - `development` or `production`
- `PORT` - Server port (default: 3000)
- `CORS_ORIGIN` - Allowed CORS origin (default: *)
