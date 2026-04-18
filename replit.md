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
| Finance (invoices, contracts, change orders, FX rates, T&M line item generation) | Built |
| Templates (project blueprints) | Built |

## Executive Committee Sprint Status

| Sprint | Focus | Status |
|--------|-------|--------|
| Sprint 1 | Schema migrations (53 new columns, 3 new tables, 12 indexes) | ✅ Complete |
| Sprint 2 | Terminology rename (Account→Customer) + nav (Prospects, Rate Cards nav items) | ✅ Complete |
| Sprint 3 | Resource module enhancements (heatmap tree, soft/hard visual, skills matrix) | ✅ Complete |
| Sprint 4 | Project/Task module (7-level hierarchy, ETC, comments, dependencies) | ✅ Complete |
| Sprint 5 | CRM: Prospects module + milestone types + payment alerts + opportunity prospect link + customer kanban | ✅ Complete |
| Sprint 6 | Timesheets + Rate Cards + Billing (admin project, collaboration, PM approval) | ✅ Complete |
| Sprint 7 | RBAC Dual-Mode Identity (role switcher, multi-role users, self-approval prevention, delegation, user management) | ✅ Complete |
| Sprint 8 | Portfolio unification, Prospects→Opportunities merge, Timesheet compliance actions | ✅ Complete |

## Sprint 8 Changes (April 2026)

### T001 — Portfolio & Operations Unification
- **Router**: Admin role now lands on `/portfolio` (was `/dashboard/admin`)
- **Portfolio page** (`portfolio/index.tsx`): Renamed to "Portfolio Command Center"; added role-scoped **Operations tab** (admin/delivery_director only) showing ARR, cash flow breakdown, project status distribution, resource capacity pulse, margin watch table, and data health alerts
- **API** (`account_health.ts`): `/api/portfolio` now returns an `operations` block for admin/delivery_director roles — includes totalARR, invoiceCashFlow, statusDistribution, resourceCapacity, marginWatch, dataHealthAlerts

### T002 — Prospects → Opportunities Merge
- **Schema**: Added `pre_qualification` as first stage in `OPPORTUNITY_STAGES` (lib/db/src/schema/opportunities.ts)
- **Opportunities UI**: All stage maps (STAGES, STAGE_LABELS, STAGE_COLORS, STAGE_HEADER, STAGE_PROB) updated with pre_qualification at prob=5%
- **Sidebar**: Prospects nav link removed; only Opportunities shown under Pipeline
- **Router**: `/prospects` and `/prospects/:id` now redirect to `/opportunities`

### T003 — Timesheet Compliance Actions
- **New DB tables**: `timesheet_compliance_events`, `timesheet_week_locks` (lib/db/src/schema/timesheet_compliance.ts)
- **API** (`timesheets.ts`): Three new POST endpoints:
  - `POST /api/timesheets/compliance/remind` — sends in-app notification, anti-spam (1/day limit)
  - `POST /api/timesheets/compliance/lock-week` — locks a resource's week (eligible from following Wednesday)
  - `POST /api/timesheets/compliance/escalate` — logs RM escalation event + notification
- **API** (`/timesheets/missing`): Extended response includes `reminderSentAt`, `isLocked`, `isEscalated`, `missedPrevWeek`, `lockEligible`
- **PM Dashboard** (`pm.tsx`): Missing timesheets banner replaced with per-resource compliance action card showing Remind / Lock / Escalate buttons with inline state (inflight spinner, disabled state, status badges)

## Sprint 1 Schema Changes (April 2026)

Migration file: `artifacts/api-server/migrations/sprint1_schema.sql`

**New columns added (53 total across 10 tables):**
- `resources`: default_role, skills_with_years (jsonb), vacation_allocation_days, hire_date
- `accounts`: type, payment_terms, contract_header, converted_from_prospect_id
- `projects`: is_internal, is_external, is_administrative, health_status, health_budget, health_hours, health_timeline, health_risks, is_fixed_fee, billing_rate, delivery_lead_id, template_id
- `tasks`: hierarchy_level, is_leaf, comment_count, is_milestone_gate
- `milestones`: milestone_type ('payment'|'project'|'external'), invoice_alert_sent, signoff_required, signoff_status, deliverables, invoice_amount
- `timesheets`: billed_role, sell_rate, cost_rate, daily_comment, is_collaboration, submitted_at
- `opportunities`: prospect_id, staffing_request_triggered (account_id made nullable for prospect-linked opps)
- `rate_cards`: is_template, sell_rate, currency
- `invoices`: line_items (jsonb), subtotal, total, currency, invoice_type
- `staffing_requests`: practice_area

**New tables created:**
- `prospects` — pre-customer CRM entity with confidential contact fields (sentiment, touchPoints, primaryContact)
- `task_comments` — task-level comments with @mention support (mentionedUserIds int[])
- `saved_filters` — shareable filter presets per context (tasks/projects/resources)

**Seed data added:**
- 3 Prospects (TransWest Global, NovaCargo Solutions, Clearpath Freight)
- 2 Saved filters (Open Tasks shared, My High Priority personal)
- 3 Task comments with @mention references
- Backfilled: 32 resources with default_role, 16 milestones with milestone_type, 9 projects with 4-dimension RAG health

**Existing tables pre-existing (no changes needed):**
- rate_cards, staffing_requests, task_dependencies, task_resources — all already exist and are used

## Time Log Module — Fixed Bugs (Apr 2026)

Three critical bugs resolved so entries now appear correctly in the weekly grid:

1. **entryDate stripped on POST** — `POST /api/timesheets` used an orval-generated Zod schema missing 8 fields (`entryDate`, `projectName`, `resourceName`, `taskId`, `categoryId`, `isBillable`, `activityType`). Replaced with a full inline `CreateTimesheetInput` Zod schema in `artifacts/api-server/src/routes/timesheets.ts`.
2. **WeeklyGrid never reloaded after Log Time modal saved** — Parent's `refetch()` only refreshed the list view, not the grid. Added `refreshKey` prop to WeeklyGrid; parent increments it post-save to trigger grid's `load()`.
3. **All 68 existing DB rows had `entry_date = NULL`** — Backfilled with `UPDATE timesheets SET entry_date = week_start WHERE entry_date IS NULL`. Grid only populates cells when `e.entryDate` is truthy, so rows were invisible.

Also added `"zod": "catalog:"` to `artifacts/api-server/package.json` (needed for inline schema import).

## RBAC Dual-Mode Identity (Sprint 7)

### Architecture
- **Multi-role users** — `DemoUser.availableRoles[]` defines all roles a user can switch between. Base `Employee` role is always present. Elevated roles are stored in `localStorage` with key `otmnow_user_roles`.
- **Role Switcher** — persists to `localStorage` (`otmnow_pref_role`, `otmnow_remember_role`). Active role shown in top-bar badge with dropdown to switch. Navigation redirects on role switch.
- **Self-approval prevention** — backend enforces in `PATCH /timesheets/:id` and `POST /timesheets/approve` (403 if `approverResourceId === entry.resourceId`). Frontend shows disabled approve button + "Own entry" badge.
- **My Profile page** (`/profile`) — role list, default role preference, "Remember last role" toggle, Delegation CRUD (given + received, active/expired, revoke, mandatory end date).
- **User Management** (`/settings/user-management`) — admin-only; searchable user table; Edit Roles dialog (Employee locked, elevated roles toggleable); localStorage-backed override.
- **Admin Panel** (`/admin`) — overview metrics + quick links to User Management and PMO Settings.
- **Delegation API** — `GET/POST/DELETE /api/delegations` backed by `delegations` DB table.

### Key Files
- `artifacts/businessnow/src/lib/auth.ts` — DemoUser type, getEffectiveRoles, role prefs helpers
- `artifacts/businessnow/src/components/layout/top-bar.tsx` — Role Switcher dropdown
- `artifacts/businessnow/src/pages/profile/index.tsx` — My Profile + Delegation Settings
- `artifacts/businessnow/src/pages/settings/user-management.tsx` — admin role assignment
- `artifacts/businessnow/src/pages/timesheets/approval.tsx` — self-approval UI guard
- `artifacts/api-server/src/routes/timesheets.ts` — self-approval backend enforcement
- `artifacts/api-server/src/routes/delegations.ts` — delegation CRUD API

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
