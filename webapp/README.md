# HayQC - Bale Logging & Quality Control App

A mobile-first web application for quality control of animal feed shipments (Rhodes Grass, Wheat Straw, Alfalfa) with automatic grade assignment.

## Hierarchy Structure

- **Company** → Purchase Order → Shipment → Container → Bale
- Complete traceability from bale back to company
- Multi-company support with inspector management

## Features

### Company & User Management
- Company account creation
- Inspector management with PIN authentication
- Admin dashboard for company settings

### Inspector Dashboard
- Quick stats (bales logged, acceptance rate)
- Grade distribution visualization
- Recent activity tracking
- Easy navigation to all features

### Purchase Order Management
- Create new POs with customer details
- Track contract quantity vs delivered
- Multiple shipments per PO

### Container Setup
- Item Type selection (Rhodes Grass, Wheat Straw, Alfalfa)
- Bale Press type (Single/Double)
- Bale Size category (Small/Medium/Large)
- Average expected weight logging

### Bale QC Entry
- Fast entry optimized for 30-45 seconds per bale
- Direct moisture % input
- Automatic grade calculation (A/B/C/Reject)
- Color, stems, wetness assessment
- Defect detection (contamination, mold, mixed material)
- Photo evidence (2 required)
- Accept/Reject decision with reasons

### Quality Grading System
- **Grade A**: Green color, moisture 10-14%, dry
- **Grade B**: Brown color OR moisture 14-25% OR damp
- **Grade C**: Moisture >25%
- **Reject**: Mold, contamination, or wet

## Screens

1. **Login** - Company/Inspector selection with PIN
2. **Create Account** - New company registration
3. **Inspector Dashboard** - Stats and quick actions
4. **Company Admin** - Inspector management
5. **PO List** - View and create Purchase Orders
6. **Create PO** - New purchase order form
7. **PO Dashboard** - PO details with shipments
8. **Shipment Setup** - Create new shipment
9. **Shipment Dashboard** - View containers
10. **Container Setup** - Configure container with item/bale types
11. **Range Assignment** - Assign inspector bale ranges
12. **Container Dashboard** - QC progress overview
13. **Bale QC** - Fast entry form with auto-grading
14. **Bale Review** - Search and edit logged bales
15. **Container Summary** - Statistics and export
16. **Shipment Summary** - Evidence pack export

## Design Principles

- Mobile-first for Android devices
- Large touch targets (44px minimum)
- High contrast for outdoor visibility
- Bilingual labels (English/Urdu)
- Minimal typing required
- Real-time grade calculation

## Tech Stack

- React 18 + TypeScript
- React Router v6
- Tailwind CSS + shadcn/ui
- IBM Plex Sans font

## Database & Backend

### Architecture
- **Frontend API Client**: `/webapp/src/lib/api.ts` - Type-safe API methods
- **Backend Server**: Hono.js on Bun (port 3000)
- **Database**: SQLite with Prisma ORM (`backend/prisma/dev.db`)
- **Authentication**: PIN-based (4-digit) with company/inspector hierarchy

### API Endpoints
All endpoints follow `{ data: T }` response envelope pattern:

#### Companies
- `GET /api/companies` - List all companies
- `GET /api/companies/:id` - Get company with inspector count
- `POST /api/companies` - Create company
- `PUT /api/companies/:id` - Update company
- `DELETE /api/companies/:id` - Delete company

#### Inspectors
- `GET /api/inspectors?companyId=xxx` - List inspectors
- `GET /api/inspectors/:id` - Get inspector details
- `POST /api/inspectors` - Create inspector (with PIN)
- `PUT /api/inspectors/:id` - Update inspector
- `DELETE /api/inspectors/:id` - Deactivate inspector

#### Authentication
- `POST /api/auth/login` - Login with company/inspector/PIN

#### Purchase Orders
- `GET /api/purchase-orders?companyId=xxx&status=xxx` - List POs
- `GET /api/purchase-orders/:id` - Get PO with shipments
- `POST /api/purchase-orders` - Create PO
- `PUT /api/purchase-orders/:id` - Update PO
- `DELETE /api/purchase-orders/:id` - Delete PO

#### Shipments
- `GET /api/shipments?poId=xxx` - List shipments
- `GET /api/shipments/:id` - Get shipment
- `POST /api/shipments` - Create shipment (auto-updates PO status)
- `PUT /api/shipments/:id` - Update shipment
- `DELETE /api/shipments/:id` - Delete shipment

#### Containers
- `GET /api/containers?shipmentId=xxx` - List containers
- `GET /api/containers/:id` - Get container with assignments
- `POST /api/containers` - Create container
- `PUT /api/containers/:id` - Update container
- `DELETE /api/containers/:id` - Delete container

#### Inspector Assignments
- `GET /api/assignments?containerId=xxx` - List assignments
- `POST /api/assignments` - Create assignment
- `DELETE /api/assignments/:id` - Delete assignment

#### Bales
- `GET /api/bales?containerId=xxx&shipmentId=xxx&limit=100` - Query bales
- `GET /api/bales/:id` - Get bale details
- `POST /api/bales` - Create bale
- `PUT /api/bales/:id` - Update bale
- `DELETE /api/bales/:id` - Delete bale
- `POST /api/bales/bulk` - Create multiple bales

#### Statistics (Read-only)
- `GET /api/stats/container/:id` - Container QC stats
- `GET /api/stats/shipment/:id` - Shipment stats
- `GET /api/stats/po/:id` - Purchase order stats
- `GET /api/stats/inspector/:id` - Inspector daily stats

### Database Schema
**7 Models:**
- `Company` - Organizations
- `Inspector` - QC inspectors
- `PurchaseOrder` - Purchase orders
- `Shipment` - Shipment records
- `Container` - Containers within shipments
- `InspectorAssignment` - Inspector-to-container assignments
- `Bale` - Individual bale QC records

### Using the API Client
```typescript
import { api } from '@/lib/api';

// List companies
const companies = await api.companies.list();

// Get specific inspector
const inspector = await api.inspectors.get('inspector-id');

// Login
const { inspector, company } = await api.auth.login(
  'company-id',
  'inspector-id',
  '1234'
);

// Create a bale
const bale = await api.bales.create({
  containerId: 'container-id',
  companyId: 'company-id',
  inspectorId: 'inspector-id',
  baleNumber: 'C01-001',
  press: 'LARGE',
  size: 'MEDIUM',
  grade: 'PRIME',
  color: 'GREEN',
  stems: 'FEW',
  wetness: 'DRY',
  decision: 'PASS',
});

// Get stats
const stats = await api.stats.container('container-id');
```

## Status

Database fully implemented with:
- ✅ Prisma schema with all models
- ✅ SQLite database with seeded data
- ✅ Complete CRUD API routes
- ✅ Frontend API client
- ✅ Error handling and validation
- ⏳ Frontend integration (connecting pages to API)
