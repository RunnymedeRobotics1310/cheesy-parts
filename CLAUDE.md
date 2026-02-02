# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cheesy Parts is a web-based parts management system for tracking parts through design and manufacturing cycles. It assigns part numbers, stores CAD version control info, and tracks manufacturing status. Originally created by FRC Team 254, modernized by FRC Team 1310.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query
- **Backend:** Hono on Cloudflare Workers
- **Database:** PostgreSQL via Supabase
- **Deployment:** Cloudflare Workers (API) + Cloudflare Pages (frontend)

## Common Commands

```bash
# Install all dependencies
npm install && npm run install:all

# Development (runs both API and frontend)
npm run dev

# Run only API or frontend
npm run dev:api
npm run dev:frontend

# Build frontend for production
npm run build

# Deploy to Cloudflare
npm run deploy

# Database migrations
npm run migrate           # Run migrations
npm run migrate:status    # Check status
npm run migrate:create    # Create new migration
```

## Project Structure

```
cheesy-parts/
├── backend/              # Hono API (Cloudflare Workers)
│   ├── src/index.ts      # All API routes and handlers
│   ├── wrangler.toml     # Workers configuration
│   └── .dev.vars         # Local env vars (copy from .dev.vars.example)
├── frontend/             # React + Vite application
│   ├── src/
│   │   ├── App.tsx       # Main app with routing
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page components
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # API client and utilities
│   └── vite.config.ts
├── database/             # Supabase PostgreSQL
│   ├── migrations/       # SQL migration files
│   └── migrate.js        # Migration runner script
└── .github/              # GitHub Actions for Cloudflare deployment
```

## Architecture

### Backend API (`backend/src/index.ts`)

Single-file Hono application with all routes:

- **Auth:** `/auth/login`, `/auth/register`, `/auth/me`, `/auth/change-password`
- **Users:** `/users` (admin only)
- **Projects:** `/projects`, `/projects/:id`
- **Parts:** `/projects/:projectId/parts`, `/parts/:id`, `/parts/:id/status`
- **Dashboard:** `/projects/:projectId/dashboard`
- **Orders:** `/projects/:projectId/orders`, `/orders/:id`
- **Order Items:** `/projects/:projectId/order-items`, `/order-items/:id`
- **Settings:** `/settings`
- **Vendors:** `/vendors` (for autocomplete)

Authentication uses HMAC-signed tokens (14-day validity). Three permission levels: `readonly`, `editor`, `admin`.

### Frontend

React SPA with:
- TanStack Query for data fetching/caching
- React Router for navigation
- Tailwind CSS for styling
- Custom components in `frontend/src/components/`

### Database

PostgreSQL via Supabase with tables:
- `users` - Authentication and permissions
- `projects` - Part number prefixes and settings
- `parts` - Core parts with status tracking
- `orders` - Vendor order tracking
- `order_items` - Individual items in orders
- `settings` - Global app settings

## Data Models

### Part
- Types: "part" or "assembly"
- 20+ manufacturing statuses (designing → done)
- Hierarchical parent/child relationships
- Auto-generated part numbers

### Part Statuses
```
designing → material → ordered → drawing → ready →
[cnc|laser|lathe|mill|printer|router] → manufacturing →
outsourced → welding → scotchbrite → anodize → powder →
coating → assembly → done
```

### User Permissions
- `readonly` - View only
- `editor` - Can create/edit parts, orders
- `admin` - Full access including user management

## Part Numbering

Parts auto-generate numbers based on project prefix:
- **Assemblies:** `PREFIX-A-####` (increments by 100)
- **Parts:** `PREFIX-P-####` (increments by 1)

## Security

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### Rate Limiting
Login endpoint is rate-limited to 5 attempts per 60 seconds per IP using Cloudflare's Rate Limiting binding.

### CORS
CORS is configured via the `FRONTEND_URL` environment variable. In development, `http://localhost:5173` is always allowed.

### Security Headers
All responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Password Hashing
PBKDF2 with SHA-256, 100,000 iterations (Cloudflare Workers maximum).

## Environment Variables

Backend requires (in `backend/.dev.vars` for local, Cloudflare dashboard for production):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
AUTH_SECRET=random-string-for-token-signing
FRONTEND_URL=https://parts.team1310.ca  # For CORS (defaults to localhost:5173)
RESEND_API_KEY=optional-for-emails
ADMIN_EMAIL=optional-notification-recipient
```

For migrations, also need `DATABASE_URL` (Supabase connection string).
