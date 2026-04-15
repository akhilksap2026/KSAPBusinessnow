# BUSINESSNow — Delivery Command Center

## Project Overview

Internal PSA (Professional Services Automation) platform for an OTM consulting firm. Aligned to the KSAP RPM Feature Specification (April 2026). Replaces Rocketlane, Smartsheet, and manual Google Sheet workflows.

## Active Artifacts

- **`artifacts/businessnow`** — React + Vite frontend (preview path: `/`)
- **`artifacts/api-server`** — Express 5 + Drizzle ORM API (port 8080)

## Scope (PRD-Aligned Modules)

| Module | Status |
|---|---|
| Resource Management (bench view, allocations, capacity) | Built |
| Project Management (CRUD, portfolio, WBS, milestones, tasks) | Built |
| Customer Management (accounts + project linkage) | Built |
| Time Tracking (weekly timesheets, approval workflow) | Built |
| Finance (invoices, contracts, change orders, FX rates) | Built |
| Templates (project blueprints) | Built |

## Removed (Overbuilt vs PRD)

Opportunity Pipeline/CRM, Renewal Signals, Account Health Scoring, Client Portal, Automations Engine, Forms Builder, AI Summaries/Digest, Handover wizard, Staffing Requests workflow, Per-project Rate Cards, Sales Dashboard, Account Manager Dashboard.

## Key PRD Gaps Still To Build

1. PTO Tracking + Regional Holiday Calendars (capacity blocking)
2. Mandatory description + 0.25-hr increment validation on timesheets
3. Customer Contacts sub-table with Functional Roles (Billing/AP Contact)
4. Project Team access control on time entry
5. Time Explorer CSV export
6. RAID Log — Risk and Issue objects (Change Requests exist)
7. Timesheet compliance scheduler (Friday/Monday notifications)
8. Project lifecycle gate validation (billing email check before activation)
9. Availability Search by role + hours
10. Hire/Term date blocking on timesheet entry

## Workspace Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
