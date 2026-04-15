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

## Time Log Module — Fixed Bugs (Apr 2026)

Three critical bugs resolved so entries now appear correctly in the weekly grid:

1. **entryDate stripped on POST** — `POST /api/timesheets` used an orval-generated Zod schema missing 8 fields (`entryDate`, `projectName`, `resourceName`, `taskId`, `categoryId`, `isBillable`, `activityType`). Replaced with a full inline `CreateTimesheetInput` Zod schema in `artifacts/api-server/src/routes/timesheets.ts`.
2. **WeeklyGrid never reloaded after Log Time modal saved** — Parent's `refetch()` only refreshed the list view, not the grid. Added `refreshKey` prop to WeeklyGrid; parent increments it post-save to trigger grid's `load()`.
3. **All 68 existing DB rows had `entry_date = NULL`** — Backfilled with `UPDATE timesheets SET entry_date = week_start WHERE entry_date IS NULL`. Grid only populates cells when `e.entryDate` is truthy, so rows were invisible.

Also added `"zod": "catalog:"` to `artifacts/api-server/package.json` (needed for inline schema import).

## Key PRD Gaps Still To Build

1. PTO Tracking + Regional Holiday Calendars (capacity blocking)
2. Customer Contacts sub-table with Functional Roles (Billing/AP Contact)
3. Time Explorer CSV export
4. RAID Log — Risk and Issue objects (Change Requests exist)
5. Timesheet compliance scheduler (Friday/Monday notifications)
6. Project lifecycle gate validation (billing email check before activation)
7. Availability Search by role + hours
8. Hire/Term date blocking on timesheet entry

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
