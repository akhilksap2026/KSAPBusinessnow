# BUSINESSNow — Deployment Guide

## Required Environment Variables

| Variable | Purpose | Example | Required |
|----------|---------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string for the primary database | `postgres://user:pass@host:5432/businessnow` | **Required** |
| `PORT` | TCP port the API server listens on | `8080` | **Required** |
| `NODE_ENV` | Runtime environment; controls logging format and dev features | `production` | **Required** |
| `SESSION_SECRET` | Secret key for signing session cookies (≥ 32 chars, random) | `a8f5f167f44f4964e6c998dee827110c` | **Required** |
| `LOG_LEVEL` | Pino log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`) | `info` | Optional (default: `info`) |
| `SENTRY_DSN` | Sentry Data Source Name for error tracking | `https://abc123@o123.ingest.sentry.io/456` | Optional |
| `ENABLE_CRM_MODULES` | Enable CRM pipeline routes (prospects, opportunities) | `true` | Optional (default: `false`) |
| `ENABLE_AUTOMATIONS` | Enable automation rule engine | `true` | Optional (default: `false`) |
| `ENABLE_FORMS` | Enable custom form builder module | `true` | Optional (default: `false`) |
| `VITE_ENABLE_STANDALONE_PORTAL` | Enable standalone client portal at /portal | `true` | Optional (default: `false`) |

> **QuickBooks integration** (deferred): When QB integration is enabled in a future release, the following additional variables will be required:
> `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REALM_ID`, `QBO_REDIRECT_URI`.

---

## First-Deploy Setup

### 1. Provision PostgreSQL

Ensure a PostgreSQL 14+ database is accessible from the server. Set `DATABASE_URL`.

### 2. Run Schema Migration

```bash
# From the lib/db directory:
pnpm run push
```

This runs `drizzle-kit push` and creates all tables. Safe to re-run on subsequent deploys — only additive changes are applied.

### 3. Seed Demo Data (optional)

The server auto-seeds on first boot when the database is empty. To force a re-seed:

```bash
# Drop all tables, then restart the server — auto-seed runs automatically.
# WARNING: This destroys all data. Only use in staging/development.
```

### 4. Build and Start

```bash
# Build API server
cd artifacts/api-server && pnpm run build

# Start API server
PORT=8080 NODE_ENV=production pnpm run start

# Build frontend
cd artifacts/businessnow && pnpm run build

# Serve frontend (via static hosting or Replit deployment)
```

---

## Architecture Notes

- **API Server**: Express 5, Node.js, port configured via `PORT` env var.
- **Frontend**: React 19 + Vite SPA, served as static assets.
- **Database**: Drizzle ORM + PostgreSQL (Replit built-in or external).
- **Auth Model**: Role-based via `X-User-Role` header; production deployments should integrate SSO/JWT (see auth middleware at `artifacts/api-server/src/middleware/auth.ts`).
- **Rate Limiting**: 500 GET req/15min · 200 write req/15min per IP. Override in `artifacts/api-server/src/app.ts`.

---

## Health Check

```
GET /api/health
```

Returns `200 OK` with `{ status: "ok", timestamp: "..." }` when the server is running and the database is reachable.

---

## Post-Deploy Validation Checklist

- [ ] `GET /api/health` returns 200
- [ ] Login page loads and role selection works
- [ ] Dashboard loads for admin role
- [ ] Timesheets page loads, entries visible
- [ ] Invoices page loads
- [ ] Rate cards page loads, global templates visible
- [ ] `SENTRY_DSN` configured and test error sent
