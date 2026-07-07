# Visitor Management - Three Repository Architecture

This is the backend API repository for the Visitor Management SaaS platform.

## Repository Structure

The Visitor Management system is split into three independent repositories:

1. **visitor-management-backend** (this repo) - Node.js/Express API
   - Company, user, and visit management
   - Role-based access control
   - Database migrations
   - Shared business logic

2. **visitor-management-admin-fe** - React admin dashboard
   - Platform administration
   - Company management
   - Platform metrics
   - Deployed to `admin.larkvel.com`

3. **visitor-management-customer-fe** - React customer dashboard
   - Company-specific visitor management
   - User check-in/check-out
   - Subdomain-based routing (`*.larkvel.com`)
   - Deployed to `<company>.larkvel.com`

## Why Separate Repositories?

- **Independent Deployment**: Each component can be deployed independently
- **Different Cadences**: Admin and customer frontends can have different release schedules
- **Clarity**: Clear separation of concerns
- **Scalability**: Backend can be scaled independently
- **Team Organization**: Teams can work independently on their components

## Deployment

Each repository has its own `docker-compose.yml` for local development:

```bash
# Backend
cd visitor-management-backend
docker-compose up

# Admin Frontend
cd visitor-management-admin-fe
VITE_API_BASE_URL=http://localhost:3000 docker-compose up

# Customer Frontend
cd visitor-management-customer-fe
VITE_API_BASE_URL=http://localhost:3000 docker-compose up
```

## API Integration

Both frontends communicate with this backend API at the configured `VITE_API_BASE_URL`.

See [backend README](README.md) for API documentation.

## Development

When developing, start the backend first, then the frontends:

1. Backend: `npm install && npm run migrate && npm start`
2. Admin FE: `npm install && npm run dev`
3. Customer FE: `npm install && npm run dev`

## No Functionality Changes

This separation maintains 100% of the original functionality - only the file organization has changed.
