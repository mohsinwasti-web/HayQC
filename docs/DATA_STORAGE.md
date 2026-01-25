# Data Storage Architecture

This document explains how HayQC stores and manages data.

## Database

HayQC uses **PostgreSQL** as the only supported database for both development and production.

### Configuration

Database connection is configured via `DATABASE_URL` in `.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/hayqc"
```

For local development with Docker Compose:
```bash
docker-compose up -d postgres
```

### Prisma ORM

All database operations use **Prisma** as the ORM layer. Key commands:

```bash
# Push schema changes (development)
bunx prisma db push

# Generate Prisma Client
bunx prisma generate

# Run migrations (production)
bunx prisma migrate deploy

# Reset and seed database
bunx prisma migrate reset

# Seed only
bunx prisma db seed
```

### Automatic Setup

The backend start script automatically:
1. Runs `prisma generate` if schema exists
2. Runs `prisma db push` to ensure schema is applied
3. Starts the Hono server

## Data Model Overview

### Core Entities

| Table | Description |
|-------|-------------|
| `Company` | Multi-tenant organization |
| `User` | Users with roles (SUPERVISOR, INSPECTOR, CUSTOMER, SUPPLIER) |
| `PurchaseOrder` | Customer orders for hay/agricultural products |
| `Shipment` | Shipments within a PO |
| `Container` | Containers within a shipment |
| `Bale` | Individual bales inspected within containers |

### Supporting Entities

| Table | Description |
|-------|-------------|
| `InspectorAssignment` | Assigns inspectors to container bale ranges |
| `POUserAssignment` | Assigns CUSTOMER/SUPPLIER users to specific POs |
| `PONote` | Notes/comments on purchase orders |

### Relationships

```
Company
  └── User (many)
  └── PurchaseOrder (many)
        └── POUserAssignment (many) → User
        └── PONote (many) → User
        └── Shipment (many)
              └── Container (many)
                    └── InspectorAssignment (many) → User (inspector)
                    └── Bale (many) → User (inspector)
```

### Company Isolation

All data is scoped by `companyId`. The backend enforces this at the API level:

- Session cookie contains `companyId`
- All queries filter by authenticated user's company
- No cross-company data access is possible

## Frontend Data Storage

The frontend does **not** permanently store business data. It uses:

### Authentication
- **HttpOnly Cookie**: `qc_auth` session token (server-managed)
- Session restored via `GET /api/auth/me` on page load

### React Query Cache
- In-memory cache for API responses
- Automatically invalidated on mutations
- Configurable stale time (default: 30 seconds)

### No Offline Storage
- All data fetched fresh from API
- No IndexedDB or localStorage for business data
- Logout clears all cached data

## Demo Accounts

After seeding (`bunx prisma db seed`):

### Demo Hay Co.
| Role | Email | PIN |
|------|-------|-----|
| Supervisor | supervisor@demo.com | 0000 |
| Inspector | inspector@demo.com | 1234 |
| Customer | customer@demo.com | 2222 |
| Supplier | supplier@demo.com | 3333 |

### Gulf Agri Solutions (Isolation Testing)
| Role | Email | PIN |
|------|-------|-----|
| Supervisor | bilal@gulfagri.ae | 5678 |
| Inspector | ahmed@gulfagri.ae | 4321 |

## Security Notes

1. **PIN Hashing**: PINs are hashed with bcrypt.
2. **Auth Secret**: Uses `AUTH_SECRET` env var. Must be strong in production.
3. **Cookie Settings**: HttpOnly, SameSite=Lax, Secure in production.
4. **RBAC**: Backend validates all permissions server-side, never trusts client.
