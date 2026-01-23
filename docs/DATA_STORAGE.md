# Data Storage Architecture

This document explains how HayQC stores and manages data.

## Development Environment

### SQLite Database

HayQC uses **SQLite** for development and demo purposes. The database file is located at:

```
backend/prisma/dev.db
```

Configured via `DATABASE_URL` in `.env`:
```
DATABASE_URL="file:./dev.db"
```

### Prisma ORM

All database operations use **Prisma** as the ORM layer. Key commands:

```bash
# Push schema changes (development)
bunx prisma db push

# Generate Prisma Client
bunx prisma generate

# Reset and seed database
bunx prisma migrate reset

# Seed only
bunx prisma db seed
```

## Vibecode Deployment

### Filesystem Considerations

On Vibecode, the SQLite file lives on the **container filesystem**. Important notes:

- Data persists across server restarts within the same session
- Container rebuilds may reset the database
- For persistent demo data, the seed script recreates all test accounts

### Automatic Setup

The backend start script automatically:
1. Runs `prisma generate` if schema exists
2. Runs `prisma db push` to ensure schema is applied
3. Starts the Hono server

## Production Recommendation

For production deployments, **PostgreSQL** is strongly recommended:

### Why Postgres?

1. **Concurrent Access**: SQLite has write locking limitations
2. **Scalability**: Postgres handles high traffic better
3. **Durability**: Managed database services provide backups
4. **Features**: Full-text search, JSON operations, more data types

### Migration Path

1. Update `DATABASE_URL` to Postgres connection string
2. Update `prisma/schema.prisma` provider from `sqlite` to `postgresql`
3. Run `bunx prisma migrate deploy`
4. Re-seed if needed

Example Postgres URL:
```
DATABASE_URL="postgresql://user:password@host:5432/hayqc?schema=public"
```

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

- JWT token contains `companyId`
- All queries filter by authenticated user's company
- No cross-company data access is possible

## Frontend Data Storage

The frontend does **not** permanently store business data. It uses:

### Authentication
- **HttpOnly Cookie**: `qc_auth` JWT token (primary)
- **localStorage**: `hayqc_auth` backup for session state

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

1. **PIN Hashing**: PINs are base64 encoded (demo only). Production should use bcrypt.
2. **JWT Secret**: Uses `AUTH_SECRET` env var. Must be strong in production.
3. **Cookie Settings**: HttpOnly, SameSite=Lax, Secure in production.
4. **RBAC**: Backend validates all permissions server-side, never trusts client.
