# KSAP BUSINESSNow — Delivery Command Center
## Comprehensive MVP Rebuild Guide (Executive Committee Edition)

> **Project:** Full-stack PSA (Professional Services Automation) platform for KSAP Technologies — an Oracle Transportation Management (OTM) consulting firm.
> **Stack:** React 19 + Vite 7 + Tailwind CSS v4 + shadcn/ui (New York style) + Wouter routing + Recharts | Express 5 + Drizzle ORM + PostgreSQL
> **Architecture:** pnpm monorepo — `api-server` (Express REST API) + `businessnow` (React SPA)
> **Auth model:** Role-based access control (RBAC) — localStorage role-picker for MVP; SSO-ready for post-MVP

---

## Executive Committee Changes vs Original Build

The following changes have been mandated by the executive committee and are incorporated throughout this guide:

| # | Area | Change |
|---|------|--------|
| 1 | Terminology | Rename `Account` → **Customer** throughout. Prospect is a separate pre-customer entity. |
| 2 | CRM | Add **Prospect** as a distinct entity with confidential fields not visible to project teams. |
| 3 | CRM | Prospect → Customer **conversion flow** with FK link retained on original prospect record. |
| 4 | Projects | Support **Internal / External project flag**. Internal projects for KSAP-internal work. |
| 5 | Projects | **7-level deep task hierarchy**. Time logged only at leaf level. Parent metrics roll up. |
| 6 | Projects | All **4 task dependency types** (FS, SS, FF, SF) with lag support. |
| 7 | Projects | **Planned vs Actual vs ETC** — ETC is independently editable, not derived. |
| 8 | Projects | **Multi-resource assignment** per task with individual hours, roles, and rates. |
| 9 | Projects | **Comments + @mentions** on tasks. Visual indicator for pending comments. |
| 10 | Projects | **Saved filters** on task views, shareable across team. |
| 11 | Milestones | Three milestone types: **Payment**, **Project**, **External/Customer**. |
| 12 | Milestones | Payment milestone completion → **automatic invoice alert** to PM. |
| 13 | Time Entry | **Collaboration time** — log hours on projects you are not assigned to. |
| 14 | Time Entry | **Billable/non-billable override** at entry level; default comes from task/project setup. |
| 15 | Time Entry | **Administrative placeholder project** for Vacation, Sick, Training, Holidays. |
| 16 | Time Entry | **Role derived from project assignment** — not a manual dropdown. |
| 17 | Resources | **Resource** replaces "Employee" as the master record concept. Includes contractors. |
| 18 | Resources | **Default role + project-level role override**. Project role governs billing rate. |
| 19 | Resources | **Soft allocation vs Hard allocation** with overlay on heatmap. |
| 20 | Resources | **Expandable tree view** on heatmap: resource → project breakdown. Invertible. |
| 21 | Resources | **Staffing request workflow** triggered at ≥70% opportunity win probability. |
| 22 | Resources | **Skills matrix** per resource with years-of-experience for intelligent matching. |
| 23 | Billing | **Sell Rate + Buy Rate per role** on a rate card. Both models coexist per project. |
| 24 | Billing | **Margin/profitability tracking** — cost variance flagged when wrong role fills a slot. |
| 25 | Security | **Field-level security** — prospect/financial fields blocked at data layer. |
| 26 | Security | **External/Customer portal** — scoped strictly to their own project tasks. |
| 27 | UX | **Table + Kanban views** on all major objects (Customers, Projects, Opportunities, Tasks). |
| 28 | UX | **Copy / Save-as-Template** on every major object. |

---

## How to Use This Guide

Each phase is a **self-contained prompt** you can paste directly into an AI coding assistant. Phases build on each other — complete and validate each phase before moving to the next. Validation checkpoints are included at the end of every phase.

> **Priority Legend:**
> - `[MUST]` — MVP blocker. Required for May 1 pilot.
> - `[NEEDED]` — Release 1. Immediate post-MVP sprint.
> - `[NICE]` — Future roadmap. Tracked in backlog.

---

## Phase 1 — Monorepo Foundation & Project Scaffold

```
Create a pnpm monorepo called "BUSINESSNow" using the following structure:

Monorepo layout:
  /artifacts/api-server          → Express 5 REST API
  /artifacts/businessnow         → React 19 + Vite SPA
  /lib/db                        → Shared Drizzle ORM schema package (@workspace/db)
  /lib/api-client-react          → Auto-generated React Query hooks (@workspace/api-client-react)
  pnpm-workspace.yaml            → declares artifacts/* and lib/*

Tech stack:
- React 19, Vite 7, Tailwind CSS v4, shadcn/ui (New York style), Wouter (routing),
  Recharts, Lucide React icons
- Express 5, Drizzle ORM, PostgreSQL (via DATABASE_URL env var), Zod for validation
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities for drag-and-drop
- date-fns, framer-motion
- pino for API logging

API Server setup:
- Binds to PORT env var (default 8080)
- CORS configured for development
- JSON body parser
- All routes prefixed with /api/
- GET /api/health returns { status: "ok", timestamp }
- Single esbuild build step outputs to dist/index.mjs
- pnpm dev = build then start with --enable-source-maps

Frontend (businessnow) setup:
- Vite dev server binds to 0.0.0.0 and reads PORT env var
- Base URL set to /businessnow/ (proxied via workspace routing)
- API calls use:
    const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api"
  NEVER hardcode /api — the /businessnow base path prefix must be preserved.
- Tailwind configured with dark navy sidebar theme:
    sidebar bg:   hsl(222, 47%, 11%)
    primary blue: hsl(221, 83%, 53%)
    page bg:      hsl(210, 20%, 98%)
- shadcn/ui components installed: button, input, label, select, dialog, table, badge,
  skeleton, textarea, switch, toast/toaster, card, tabs, separator, tooltip, popover,
  dropdown-menu, avatar, progress, command
- Global font: Inter via CSS import

Database (@workspace/db):
- Exports: db (Drizzle client), all table schemas
- Reads DATABASE_URL from environment
- Connection pooling via postgres.js

App shell:
- React app renders a <Router> with a persistent <AppShell> layout
- AppShell has: dark sidebar (240px wide), top bar, main content area
- Sidebar shows app logo "BUSINESSNow" + subtitle "Delivery Command Center" + nav links
- Top bar shows current user avatar + page title + notification bell
```

**✅ Phase 1 Validation:**
- `pnpm install` completes without errors
- `pnpm --filter @workspace/api-server run dev` starts and GET /api/health returns `{"status":"ok"}`
- `pnpm --filter @workspace/businessnow run dev` starts and shows the app shell at localhost
- Sidebar visible with logo; top bar visible with avatar placeholder
- No TypeScript errors in either artifact

---

## Phase 2 — Database Schema (All Core Tables)

```
Using Drizzle ORM, define ALL core tables in @workspace/db/schema.ts.
Use PostgreSQL serial primary keys. Export all tables.

IMPORTANT NAMING: The entity formerly called "Account" is now "Customer" in all
UI-facing labels, but the database table remains `accounts` for backward compatibility.
The `prospects` table is new and separate.

─── EXISTING TABLES (updated) ───

TABLE: users
  id (serial PK), name (text not null), email (text unique not null),
  role (text not null), avatarUrl (text), createdAt (timestamptz default now())

TABLE: resources  [UPDATED — replaces "employees" concept]
  id (serial PK), userId (int FK→users),
  name (text not null), title (text),
  defaultRole (text),                              ← [NEW] organizational role
  practiceArea (text not null default 'implementation'),
  employmentType (text not null default 'employee'), ← 'employee'|'contractor'|'partner'
  skills (text[] default '{}'),
  certifications (text[] default '{}'),
  specialties (text[] default '{}'),
  skillsWithYears (jsonb default '{}'),            ← [NEW] { skillName: yearsOfExp }
  utilizationTarget (int default 80),
  currentUtilization (int default 0),
  status (text not null default 'available'),
  hourlyRate (numeric 8,2),
  costRate (numeric 8,2),                          ← buy rate for margin tracking
  location (text), timezone (text),
  isContractor (bool default false),
  availableFrom (text), bio (text),
  dailyHoursCapacity (numeric 5,2 default 8),
  vacationAllocationDays (int default 15),         ← [NEW] from HR onboarding
  currency (text default 'CAD'),
  hireDate (text),                                 ← [NEW]
  createdAt (timestamptz default now())

TABLE: accounts  [= Customers in UI]
  id (serial PK), name (text not null),
  type (text default 'enterprise'),                ← 'enterprise'|'mid-market'
  industry (text), segment (text default 'enterprise'),
  status (text not null default 'active'),
  healthScore (int default 75),
  annualContractValue (numeric 14,2),
  accountOwnerId (int FK→resources),
  region (text), otmVersion (text),
  cloudDeployment (bool default false),
  renewalDate (text),
  paymentTerms (text),                             ← [NEW] e.g. "Net 30"
  contractHeader (text),                           ← [NEW] SOW/contract reference
  convertedFromProspectId (int),                   ← [NEW] FK to prospects if converted
  createdAt (timestamptz default now())

TABLE: prospects  [NEW — pre-customer CRM entity]
  id (serial PK), name (text not null),
  type (text default 'enterprise'),
  industry (text), segment (text),
  status (text not null default 'active'),         ← 'active'|'qualified'|'converted'|'dead'
  primaryContactName (text),                       ← confidential — not visible to project team
  primaryContactEmail (text),                      ← confidential
  linkedinUrl (text),                              ← confidential
  sentiment (text),                                ← confidential: 'positive'|'neutral'|'negative'
  touchPoints (jsonb default '[]'),                ← confidential: [{ date, type, notes }]
  ownerId (int FK→resources),
  notes (text),
  convertedToAccountId (int),                      ← set on conversion; retains prospect record
  convertedAt (timestamptz),
  createdAt (timestamptz default now())

TABLE: projects  [UPDATED]
  id (serial PK), name (text not null),
  accountId (int FK→accounts), accountName (text),
  isInternal (bool default false),                 ← [NEW] internal KSAP projects
  isExternal (bool default true),                  ← [NEW]
  status (text not null default 'active'),         ← 'forecasted'|'active'|'on_hold'|'completed'|'cancelled'
  phase (text default 'execution'),
  startDate (text), endDate (text),
  budget (numeric 14,2), estimatedHours (int),
  billedHours (numeric 10,2 default 0),
  projectManagerId (int FK→resources),
  deliveryLeadId (int FK→resources),
  description (text),
  healthStatus (text default 'green'),
  healthBudget (text default 'green'),             ← [NEW] per-dimension RAG
  healthHours (text default 'green'),              ← [NEW]
  healthTimeline (text default 'green'),           ← [NEW]
  healthRisks (text default 'green'),              ← [NEW]
  completionPct (int default 0),
  isFixedFee (bool default true),
  billingRate (numeric 8,2 default 125),
  currency (text default 'CAD'),
  templateId (int),                                ← [NEW] source template if created from one
  createdAt (timestamptz default now()),
  updatedAt (timestamptz default now())

TABLE: milestones  [UPDATED]
  id (serial PK), projectId (int FK→projects not null),
  name (text not null),
  milestoneType (text not null default 'project'), ← [NEW] 'payment'|'project'|'external'
  dueDate (text), completedDate (text),
  status (text default 'pending'),                 ← 'pending'|'in_progress'|'completed'|'at_risk'
  description (text), deliverables (text),
  isBillable (bool default false),
  invoiceAmount (numeric 14,2),
  invoiceAlertSent (bool default false),           ← [NEW] tracks if PM was notified
  signoffRequired (bool default false),
  signoffStatus (text default 'pending'),          ← [NEW]
  parentTaskId (int FK→tasks),                     ← [NEW] milestone can be inside a parent task
  createdAt (timestamptz default now())

TABLE: tasks  [UPDATED]
  id (serial PK), projectId (int FK→projects not null),
  milestoneId (int FK→milestones),
  parentTaskId (int FK→tasks),                     ← [NEW] enables 7-level deep hierarchy
  hierarchyLevel (int default 0),                  ← [NEW] 0=root, 1=phase, 2=task, ...6=leaf
  isLeaf (bool default true),                      ← [NEW] only leaf tasks allow time entry
  name (text not null), description (text),
  status (text default 'not_started'),             ← 'not_started'|'in_progress'|'review'|'blocked'|'completed'
  priority (text default 'medium'),
  estimatedHours (numeric 8,2),
  actualHours (numeric 8,2 default 0),
  etcHours (numeric 8,2),                          ← [NEW] Estimated Time to Complete — independently editable
  startDate (text), dueDate (text),
  assigneeId (int FK→resources),                   ← primary assignee; additional via task_assignments
  completionPct (int default 0),
  phase (text), deliverable (text),
  isMilestoneGate (bool default false),            ← [NEW]
  commentCount (int default 0),                    ← [NEW] denormalized for badge display
  createdAt (timestamptz default now())

TABLE: task_assignments  [NEW — multi-resource per task]
  id (serial PK), taskId (int FK→tasks not null),
  resourceId (int FK→resources not null),
  roleOnTask (text),                               ← role this resource fills on this specific task
  estimatedHours (numeric 8,2),
  createdAt (timestamptz default now())

TABLE: task_dependencies  [NEW]
  id (serial PK),
  predecessorTaskId (int FK→tasks not null),
  successorTaskId (int FK→tasks not null),
  dependencyType (text not null default 'FS'),     ← 'FS'|'SS'|'FF'|'SF'
  lagDays (int default 0),                         ← positive = lag, negative = lead
  createdAt (timestamptz default now())

TABLE: task_comments  [NEW]
  id (serial PK), taskId (int FK→tasks not null),
  authorId (int FK→resources not null),
  body (text not null),
  mentionedUserIds (int[] default '{}'),           ← parsed @mention targets
  isExternal (bool default false),                 ← true = visible to external/customer portal
  createdAt (timestamptz default now()),
  updatedAt (timestamptz default now())

TABLE: saved_filters  [NEW]
  id (serial PK), name (text not null),
  ownerId (int FK→resources not null),
  isShared (bool default false),
  filterContext (text not null),                   ← 'tasks'|'projects'|'resources'|'opportunities'
  filterJson (jsonb not null),                     ← { status, assigneeId, priority, ... }
  createdAt (timestamptz default now())

TABLE: allocations  [UPDATED]
  id (serial PK), resourceId (int FK→resources not null),
  projectId (int FK→projects not null),
  taskId (int FK→tasks),
  weekStart (text not null),
  allocationPct (int not null default 100),
  allocationType (text default 'hard'),            ← 'hard'|'soft'
  opportunityId (int),                             ← [NEW] soft allocations reference the opportunity
  notes (text),
  createdAt (timestamptz default now())

TABLE: staffing_requests  [NEW — linked to opportunity at ≥70%]
  id (serial PK), opportunityId (int FK→opportunities not null),
  projectId (int FK→projects),
  roleRequired (text not null),
  practiceArea (text),
  requiredSkills (text[] default '{}'),
  startDate (text), endDate (text),
  allocationPct (int default 100),
  status (text default 'open'),                    ← 'open'|'filled'|'cancelled'
  assignedResourceId (int FK→resources),
  createdAt (timestamptz default now())

TABLE: rate_cards  [NEW]
  id (serial PK), name (text not null),
  projectId (int FK→projects),                     ← null = global template
  isTemplate (bool default false),
  effectiveDate (text not null),
  expiryDate (text),
  currency (text default 'CAD'),
  createdAt (timestamptz default now())

TABLE: rate_card_roles  [NEW]
  id (serial PK), rateCardId (int FK→rate_cards not null),
  roleName (text not null),
  sellRate (numeric 8,2 not null),                 ← billed to customer
  buyRate (numeric 8,2 not null),                  ← internal resource cost
  createdAt (timestamptz default now())

TABLE: timesheets  [UPDATED]
  id (serial PK), resourceId (int FK→resources not null),
  projectId (int FK→projects),
  taskId (int FK→tasks),
  categoryId (int),
  entryDate (text not null),
  hours (numeric 5,2 not null),
  isBillable (bool default true),
  billedRole (text),                               ← [NEW] role used for billing (from project assignment)
  sellRate (numeric 8,2),                          ← [NEW] rate at time of entry
  costRate (numeric 8,2),                          ← [NEW] buy rate at time of entry
  activityType (text default 'consulting'),
  projectName (text), resourceName (text),
  notes (text),
  dailyComment (text),                             ← [NEW] required daily comment field
  isCollaboration (bool default false),            ← [NEW] true = logged on non-assigned project
  submittedAt (timestamptz),
  approvedAt (timestamptz),                        ← [NEW]
  approvedById (int FK→resources),                 ← [NEW] PM who approved
  status (text default 'draft'),                   ← 'draft'|'submitted'|'approved'|'rejected'|'invoiced'
  createdAt (timestamptz default now())

TABLE: invoices  [unchanged]
  id (serial PK), projectId (int FK→projects),
  accountId (int FK→accounts),
  invoiceNumber (text not null unique),
  milestoneId (int FK→milestones),                 ← [NEW] links to payment milestone if fixed-fee
  status (text default 'draft'),                   ← 'draft'|'sent'|'paid'|'overdue'
  issueDate (text), dueDate (text), paidDate (text),
  subtotal (numeric 14,2 default 0),
  tax (numeric 14,2 default 0),
  total (numeric 14,2 default 0),
  currency (text default 'CAD'),
  notes (text), lineItems (jsonb default '[]'),
  createdAt (timestamptz default now())

TABLE: opportunities  [UPDATED]
  id (serial PK), name (text not null),
  accountId (int FK→accounts),                    ← null if tied to a prospect
  prospectId (int FK→prospects),                  ← [NEW] null if tied to an account
  accountName (text),
  stage (text not null default 'discovery'),       ← 'discovery'|'qualified'|'proposal'|'negotiation'|'won'|'lost'
  type (text not null default 'implementation'),
  value (numeric 14,2),
  probability (int default 10),
  expectedStartDate (text), expectedCloseDate (text),
  expectedDurationWeeks (int),
  ownerId (int FK→resources), ownerName (text),
  deliveryComplexity (text default 'medium'),
  staffingRisk (text default 'none'),
  staffingRequestTriggered (bool default false),   ← [NEW] true once ≥70% staffing request fired
  summary (text), notes (text),
  goNoGoStatus (text default 'pending'),
  createdAt (timestamptz default now()),
  updatedAt (timestamptz default now())

TABLE: project_templates  [NEW]
  id (serial PK), name (text not null),
  description (text),
  phaseCount (int default 0),
  taskCount (int default 0),
  estimatedWeeks (int),
  templateData (jsonb not null),                   ← full task/milestone/phase structure
  createdById (int FK→resources),
  lastUsedAt (timestamptz),
  usageCount (int default 0),
  createdAt (timestamptz default now())

TABLE: notifications  [unchanged]
  id (serial PK), userId (int FK→users),
  type (text not null),                            ← 'milestone_due'|'overbooked'|'invoice_overdue'|
                                                      'milestone_payment'|'timesheet_approval'|
                                                      'staffing_request'|'mention'
  title (text not null), body (text),
  isRead (bool default false),
  resourceId (text), resourceType (text),
  createdAt (timestamptz default now())

─── AUTO-SEED SCRIPT ───

Create api-server/src/lib/auto-seed.ts:
- Idempotency: check SELECT COUNT(*) FROM resources; if > 0, skip entirely
- NEVER use TRUNCATE
- Seed order: resources → accounts → prospects → rate_cards → rate_card_roles →
              projects → milestones → tasks → task_assignments → allocations →
              timesheets → invoices → opportunities → notifications

Seed data:
  32 Resources: realistic OTM consulting roles across all practice areas
    Titles: Delivery Director (×1), Practice Lead (×2), Project Manager (×3),
            Senior Consultant (×6), Consultant (×8), Analyst (×3),
            Business Analyst (×2), Solution Architect (×3), QA Lead (×2),
            Integration Specialist (×1), Rate Management Specialist (×1)
    Practice areas: implementation, cloud_migration, ams, qa, data_migration,
                    custom_dev, rate_maintenance, solution_architect, integration, management
    Each resource has: hourlyRate, costRate (different — for margin tracking),
                       skills[], skillsWithYears (JSON), utilizationTarget

  8 Customers (accounts table): GlobalTrans Corp, Apex Logistics, NorthStar Freight,
    Pacific Distribution, Meridian Carriers, BlueStar Transport,
    Summit Freight Partners, Harbor Logistics Group
    Mix of statuses: active (5), at_risk (1), inactive (1), prospect/not-yet-converted (1)

  3 Prospects: separate pre-customer entities with confidential fields
    (primary contact, LinkedIn, sentiment, touchPoints)

  1 Global Rate Card template with 8 roles, each with sellRate and buyRate

  9 Projects: realistic names like "GlobalTrans OTM 24.2 Upgrade",
    "Apex Logistics Cloud Migration", "NorthStar AMS Engagement"
    Each project references the global rate card (projectId = null rate card)

  Milestones: 3–5 per project
    Names: "Requirements Sign-off", "Design Approved", "UAT Complete", "Go-Live",
           "Hypercare Complete"
    Types: mix of 'payment' (trigger billing), 'project', 'external'

  Tasks: 5–10 per project with parentTaskId to create 3-level hierarchy minimum
    Statuses: mix of not_started, in_progress, completed
    All leaf tasks have isLeaf=true

  Task assignments: 1–2 extra resources per task (beyond primary assignee)

  Allocations: 8-week rolling window, mix of hard and soft, mix of 50/80/100%
    Include 3–4 overbooked (>100%) entries to populate risk alerts

  Timesheets: 30 days of history for 8–10 active consultants
    Mix of submitted and draft; include billedRole, sellRate, costRate

  Invoices: 2–3 per project, mix of draft/sent/paid
    At least 2 overdue; at least 2 linked to milestoneId (fixed-fee triggers)

  Opportunities: 10 across all stages (discovery, qualified, proposal, negotiation,
    won, lost × 2, parked). Mix of accountId and prospectId references.

  Notifications: auto-generate on seed for overdue milestones + overbooked resources

Auto-seed runs at API server startup, before the server begins listening.
```

**✅ Phase 2 Validation:**
- `GET /api/health` returns OK
- `psql $DATABASE_URL -c "\dt"` shows all tables including: prospects, task_assignments, task_dependencies, task_comments, saved_filters, staffing_requests, rate_cards, rate_card_roles, project_templates
- `SELECT COUNT(*) FROM resources` returns 32
- `SELECT COUNT(*) FROM accounts` returns 8
- `SELECT COUNT(*) FROM prospects` returns 3
- `SELECT COUNT(*) FROM opportunities` returns 10
- `SELECT COUNT(*) FROM tasks WHERE is_leaf = true` returns tasks with no children
- On second restart, seed is skipped (idempotent check works)

---

## Phase 3 — Auth, RBAC & Navigation

```
Build the authentication system, RBAC layer, and full application navigation.

─── AUTH SYSTEM (localStorage — no backend required) ───

File: src/lib/auth.ts
Stores selected user as JSON in localStorage key "businessnow_user"
Shape: { id, name, role, title, practiceArea }

Roles:
  "delivery_director" | "project_manager" | "consultant" | "resource_manager" |
  "account_manager" | "finance" | "admin" | "external"

Title → Role mapping:
  "Delivery Director"           → delivery_director
  "Practice Lead"               → delivery_director
  "Project Manager"             → project_manager
  "Senior Consultant"           → consultant
  "Consultant"                  → consultant
  "Analyst"                     → consultant
  "Business Analyst"            → project_manager
  "Solution Architect"          → resource_manager
  "QA Lead"                     → consultant
  "Integration Specialist"      → consultant
  "Rate Management Specialist"  → consultant
  (default)                     → consultant

Hooks:
  useAuth()     → { user, setUser, clearUser }
  useAuthRole() → current role string
  useCanSee(field)  → boolean — field-level security hook:
    'financial_rates'    → delivery_director, project_manager, finance, admin only
    'prospect_data'      → account_manager, delivery_director, admin only
    'resource_costs'     → delivery_director, finance, admin only
    'all_projects'       → delivery_director, admin, finance
    'approve_time'       → delivery_director, project_manager, admin

─── FIELD-LEVEL SECURITY [NEW — enforced in API routes AND UI] ───

The following fields are NEVER returned by API for unauthorized roles:
  resources.costRate           → delivery_director, finance, admin only
  rate_card_roles.buyRate      → delivery_director, finance, admin only
  prospects.primaryContact*   → account_manager, delivery_director, admin only
  prospects.linkedinUrl        → same as above
  prospects.sentiment          → same as above
  prospects.touchPoints        → same as above
  timesheets.costRate          → delivery_director, finance, admin only
  timesheets.sellRate          → delivery_director, project_manager, finance, admin

Implement as Express middleware: checkFieldAccess(role, fields[])
Strip unauthorized fields before returning JSON responses.

─── LOGIN PAGE (/login) ───

- Fetches GET /api/resources to get the full 32-person roster
- Displays a scrollable grid of avatar cards — initials, name, title, practice area badge
- Clicking a card sets them as the logged-in user
- After selection, redirects to / (role-based routing handles the rest)

─── ROUTE GUARD ───

HOC: <Guard roles={[...]}> — redirects to /login if no user or wrong role
If user is logged in but hits /login, redirect to /

─── APP SHELL ───

Sidebar (240px, hsl(222,47%,11%), white text, collapses to icon rail <1024px):

  Logo: "BUSINESSNow" + "Delivery Command Center"

  ── OVERVIEW
    Dashboard              → /                    (LayoutDashboard)

  ── DELIVERY
    Projects               → /projects            (Folder)
    Milestones             → /milestones          (Flag)
    Tasks                  → /tasks               (CheckSquare)
    Timesheets             → /timesheets          (Clock)

  ── RESOURCES
    Team                   → /resources           (Users)
    Allocations            → /allocations         (Calendar)
    Capacity               → /capacity            (BarChart2)

  ── CUSTOMERS  [renamed from Accounts]
    Customers              → /customers           (Building2)  ← was /accounts
    Prospects              → /prospects           (Target)     ← [NEW]
    Opportunities          → /opportunities       (Handshake)
    Contracts              → /contracts           (FileText)

  ── FINANCE
    Finance                → /finance             (DollarSign)
    Invoices               → /invoices            (Receipt)
    Rate Cards             → /rate-cards          (CreditCard)  ← [NEW]

  ── PLATFORM
    Templates              → /templates           (Layout)
    Settings               → /settings/pmo        (Settings)
    Admin                  → /admin               (Shield) — delivery_director + admin only

  Bottom: logged-in user avatar + name + role + "Sign out" button

Top bar:
  Left: current page title (derived from route)
  Right: notification bell (unread count badge, polls every 30s) + user avatar

─── ROUTES (router.tsx) ───

  /login                  → LoginPage (no guard)
  /                       → role-based redirect:
                            delivery_director/admin → /dashboard/admin
                            project_manager         → /dashboard/pm
                            resource_manager        → /resources
                            finance                 → /finance
                            account_manager         → /customers
                            others                  → /timesheets
  /dashboard/pm           → PMDashboard
  /dashboard/admin        → AdminDashboard

  /projects               → ProjectsList
  /projects/:id           → ProjectDetail
  /projects/:id/command   → ProjectCommand (Gantt view)
  /milestones             → MilestonesList
  /tasks                  → TasksList
  /timesheets             → TimesheetsPage

  /resources              → ResourcesList
  /resources/:id          → ResourceDetail
  /allocations            → AllocationsPage
  /capacity               → CapacityPage

  /customers              → CustomersList          ← was /accounts
  /customers/:id          → CustomerDetail         ← was /accounts/:id
  /prospects              → ProspectsList          ← [NEW]
  /prospects/:id          → ProspectDetail         ← [NEW]
  /opportunities          → OpportunitiesPage
  /contracts              → ContractsPage

  /finance                → FinancePage
  /invoices               → InvoicesPage
  /rate-cards             → RateCardsPage          ← [NEW]

  /templates              → TemplatesPage
  /admin                  → AdminPage
  /settings/pmo           → PMOSettingsPage
  /* (404)                → NotFoundPage

All non-login routes have a Guard. Stub all pages as "Coming soon" placeholders.
```

**✅ Phase 3 Validation:**
- `/` redirects to `/login` when no user is set
- Login shows all 32 resources; clicking one logs in and routes correctly per role
- Sidebar shows "Customers", "Prospects", "Rate Cards" as new nav items
- `useCanSee('financial_rates')` returns false for consultant role, true for finance role
- Sign out clears localStorage and returns to `/login`
- All routes render without crashing

---

## Phase 4 — Resource Management Module

```
Build the full Resource Management module at /resources with three tabs.

─── API ENDPOINTS ───

GET /api/resources
  Returns all resources ordered by name.
  Fields returned depend on caller's role (strip costRate for consultant).
  Each resource: id, name, title, defaultRole, practiceArea, employmentType,
  skills, certifications, specialties, skillsWithYears, utilizationTarget,
  currentUtilization, status, hourlyRate, costRate (role-gated), location,
  timezone, isContractor, availableFrom, bio, vacationAllocationDays

GET /api/resources/utilization?weeks=12&granularity=week
  Returns heatmap payload:
  {
    weeks: string[],  // ISO week start dates
    resources: Array<{
      resource: Resource,
      weeks: Array<{
        week: string,
        hard: number,    // hard allocation %
        soft: number,    // soft allocation % (from prospective projects)
        total: number,   // hard + soft
        band: string     // "bench"|"available"|"optimal"|"booked"|"overbooked"
      }>,
      avgUtilization: number,
      projectBreakdown: Array<{ projectId, projectName, pct }>  ← [NEW] for tree expand
    }>
  }
  Bands: bench (0–19%), available (20–59%), optimal (60–89%),
         booked (90–110%), overbooked (>110%)
  granularity=month: aggregate weeks into calendar months

GET /api/resources/:id
  Full resource detail including project breakdown, skills matrix with years

POST /api/resources
  Required: name, practiceArea, employmentType
  Optional: title, defaultRole, skills[], skillsWithYears, location,
            hourlyRate, costRate, utilizationTarget, status, isContractor,
            bio, vacationAllocationDays, hireDate

PUT /api/resources/:id
  Full update

GET /api/staffing-requests?status=open
  [NEW] Returns open staffing requests for heatmap overlay

─── TAB 1: UTILIZATION HEATMAP (default) ───

Layout:
  Sticky left column: resource name + default role + practice area chip
  Week/month columns across the top
  Each cell shows total allocation % (hard + soft stacked visually)
    - Hard allocation: solid color fill
    - Soft allocation: diagonal stripe pattern overlay  ← [NEW]
  Band colors: bench=slate, available=emerald, optimal=blue, booked=amber, overbooked=red
  "—" shown if zero allocation

Expandable tree [NEW]:
  Clicking a resource row expands it to show one sub-row per project:
    sub-row: project name | allocation % on that project | type (hard/soft badge)
  Collapse row by clicking resource name again

Invertible view [NEW]:
  Toggle button "View by Resource" / "View by Project"
  Project view: project rows, resource columns, same color bands

Staffing request overlay [NEW]:
  Phantom rows at bottom of heatmap labeled "REQUESTED: [Role]"
  Show soft-allocation-style stripe in the requested week range
  Each row links to the staffing_requests record

Controls:
  Week/Month granularity toggle
  Window selector: 4w | 8w | 12w
  View toggle: By Resource | By Project
  "Allocate Range" button → inline panel:
    Resource (select), Project (select from /api/projects),
    Start Date, End Date, Allocation %, Type (Hard/Soft)
    Submit: POST /api/allocations/fill-range

─── TAB 2: RESOURCE ROSTER ───

  Search: filters by name, title, practice area, skills
  Filter chips: All | On Bench | Overbooked | Contractors
  Grouped by practice area (collapsible section headers)
  
  Each resource card:
    Colored initials avatar (red=overbooked, slate=bench, blue=optimal)
    Name + employment badge (Employee/Contractor/Partner) + warning icon if overbooked
    Default role + location + top 3 skill tags
    Utilization ring (SVG donut, hard vs soft in two rings)  ← [NEW dual ring]
    Hourly rate (visible to authorized roles only)
    Copy button (duplicates resource record)  ← [NEW]
    Click row → /resources/:id

─── TAB 3: STAFFING RISKS ───

  3 KPI tiles: Overbooked (red) | Near Capacity (amber) | On Bench (slate)
  Risk list: severity icon | message | resource title + practice area | badge
    High: utilization > 100%
    Medium: utilization 90–100%
    Low: utilization < 20%
  Open Staffing Requests panel [NEW]:
    List of open requests: role required | opportunity name | start date | status
    "Assign Resource" button → opens assignment modal

─── ADD RESOURCE MODAL ───

Fields: Full Name (required), Job Title, Default Role, Employment Type
  (Employee/Contractor/Partner), Status, Practice Area (all 10),
  Location, Hourly Rate ($), Cost Rate ($) [finance/admin only],
  Utilization Target (%), Vacation Days Allocation [NEW],
  Hire Date [NEW], Skills (comma-separated), Skills with Years [NEW — JSON input],
  Bio/Notes
Submit: POST /api/resources, toast, refresh roster

─── RESOURCE DETAIL PAGE (/resources/:id) ───

Profile header: name, title, default role, practice area, employment badge,
  location, bio
Tabs:
  Profile — skills tag cloud, certifications, specialties, skills matrix with years [NEW]
  Allocations — current project allocations (hard vs soft labeled) + heatmap mini-view
  Timesheets — recent entries with hours, project, task, date, status
  Leave — vacation allocation vs taken; leave history [NEW]
  Utilization — 12-week utilization history area chart
```

**✅ Phase 4 Validation:**
- `/resources` heatmap shows all 32 resources with hard (solid) and soft (striped) allocation layers
- Expand a resource row — see per-project breakdown
- Toggle "View by Project" — project rows appear with resource columns
- "Resource Roster" tab shows grouped cards with dual utilization rings
- Filter chips work: On Bench shows only <20% resources
- costRate field absent from API response for consultant role
- Add Resource modal: Cost Rate field only visible to finance/admin roles
- Navigate to `/resources/1` — all 5 profile tabs load correctly

---

## Phase 5 — Project Management Module

```
Build the Projects list and Project Detail pages.

─── API ENDPOINTS ───

GET /api/projects?status=&accountId=&isInternal=
  Returns all projects with: id, name, accountId, accountName, isInternal,
  status, phase, startDate, endDate, budget, estimatedHours, billedHours,
  projectManagerId, completionPct, healthStatus, healthBudget, healthHours,
  healthTimeline, healthRisks, isFixedFee, billingRate, currency, description
  Supports: ?status=active, ?accountId=, ?isInternal=true

GET /api/projects/:id
  Full project + milestones summary + tasks summary + team + recent timesheets

GET /api/projects/:id/full
  Project + all milestones + all tasks (with hierarchy) + allocations

GET /api/projects/:id/revenue
  { totalBilled, totalBillable, budget, remainingBudget, billedHours, unbilledHours,
    marginPct, totalRevenue, totalCost }  ← [NEW: margin fields]

GET /api/projects/:id/margin-forecast
  { weeks: [{ week, plannedRevenue, actualRevenue, plannedCost, actualCost,
              margin, cumulative }] }  ← [NEW: cost/margin data per week]

GET /api/projects/:id/projection
  { projectedHours, burnRate, estimatedCompletion, budgetAtRisk: bool,
    etcHours, forecastedEndDate }  ← [NEW: ETC-based projection]

POST /api/projects
  Required: name, accountId. Optional: isInternal, templateId (creates from template).
  Auto-sets accountName. Auto-assigns project rate card from global template.

PUT /api/projects/:id

POST /api/projects/:id/save-as-template  ← [NEW]
  Saves current project structure as a project_template record.
  Body: { templateName, description }

POST /api/projects/from-template  ← [NEW]
  Body: { templateId, name, accountId, startDate }
  Instantiates full task/milestone structure from template.

─── PROJECTS LIST PAGE (/projects) ───

Header: "New Project" button + filter controls
  Filter options: Search | Status | Health | Is Internal toggle [NEW]

4 KPI cards: Active Projects | Total Budget | Avg Completion % | At-Risk Count

Projects table columns:
  Project Name (link) | Customer | Internal badge [NEW] | Status badge |
  Health indicator (per-dimension icons) [NEW] | Phase |
  Start → End | Budget | Completion bar | PM | Actions (Copy, Save as Template) [NEW]

Status badge colors:
  forecasted=slate, active=blue, on_hold=amber, completed=emerald, cancelled=red

Health per-dimension icons [NEW]:
  Show 4 small colored dots: Budget | Hours | Timeline | Risks
  Each dot: green / amber / red

─── PROJECT DETAIL PAGE (/projects/:id) ───

Project header: name, customer, Internal/External badge [NEW], status badge,
  health badge, description
Action buttons: Edit | Copy | Save as Template [NEW]

Tabs: Overview | Milestones | Tasks | Team | Finance | Command

OVERVIEW TAB:
  4 KPI tiles: Budget Used % | Billed Hours | Completion % | Days Remaining
  Health dashboard [NEW]:
    4 RAG cards: Budget | Hours | Timeline | Risks
    Each shows current status, threshold, and trend arrow
  Margin forecast area chart (Recharts AreaChart):
    Lines: Planned Revenue, Actual Revenue, Planned Cost, Actual Cost
    [NEW: show both revenue AND cost lines, not just revenue]
  ETC projection card [NEW]:
    Shows: Est. Completion Date (from ETC), Budget at Risk (yes/no),
    Projected Total Hours, Current Burn Rate
  Recent timesheets list

MILESTONES TAB:
  Timeline view with milestone cards
  Each card shows milestoneType badge [NEW]: "Payment" | "Project" | "External"
  Payment milestones show invoice amount + alert sent status [NEW]
  External milestones show "Awaiting Customer" indicator [NEW]
  Status transitions: pending → in_progress → completed / at_risk
  "Add Milestone" form: name, type, due date, isBillable, invoiceAmount (if payment type),
    description, deliverables, signoffRequired

TASKS TAB:
  Hierarchical tree display [NEW]:
    - Collapsible/expandable rows (chevron icon)
    - Indent per level (20px per hierarchy level)
    - Parent rows show rolled-up: total hours, completion %, assignee count
    - Leaf rows (isLeaf=true) show: individual hours, ETC, assignee, status, priority
    - Time entry only allowed on leaf tasks; parent rows disabled
  Filter chips: All | Not Started | In Progress | Completed | Blocked
  Saved filters dropdown [NEW]: load/save filter combinations
  "Add Task" button: opens form with parentTaskId field (select parent)
  Task row click → slide-in edit panel from right:
    Editable: name, description, status, priority, estimatedHours, ETC [NEW],
              startDate, dueDate, assignees (multi-select) [NEW], comments [NEW]
  Comments section in task panel [NEW]:
    Show existing comments with author + timestamp
    @mention autocomplete (type @ to trigger resource list)
    Post comment button
    External comments toggle (visible in customer portal if enabled)

TEAM TAB:
  Grid of resource cards currently allocated to the project
  Each card: name, role on project [NEW — from rate card], allocation %, hours logged,
    hard/soft allocation badge [NEW]
  "Add to Team" button → allocation form

FINANCE TAB:
  Rate card for this project [NEW]:
    Table: Role | Sell Rate | Buy Rate (admin/finance only) | Resources in Role
    "Edit Rate Card" button (admin/finance only)
  Revenue vs Budget gauge (donut chart)
  Margin analysis [NEW]:
    Per-resource margin table: Resource | Role | Hours | Revenue | Cost | Margin %
    Flag rows where cost > expected (wrong role filling slot)
  Invoices table for this project
  Billable hours breakdown by resource

COMMAND TAB:
  Interactive Gantt chart [NEW — must implement]:
    X-axis: calendar dates
    Y-axis: tasks (grouped by phase/parent)
    Task bars: colored by status
    Dependency arrows between tasks (all 4 types)
    Drag to reschedule (updates startDate/dueDate via PUT)
    Baseline overlay: show original planned dates vs current dates [NEW]
    Milestone diamonds on the timeline
    Today line (vertical red line)
```

**✅ Phase 5 Validation:**
- `/projects` loads with all 9 projects; Internal badge shows on internal projects
- Health indicator shows 4 colored dots per project row
- KPI cards show real aggregated data
- Project detail: all 6 tabs load without error
- Tasks tab: hierarchy displays with expand/collapse; leaf tasks only allow time entry
- Task slide-in panel: ETC field editable; comments section shows + allows posting
- @mention triggers resource autocomplete
- Finance tab: rate card visible; margin table shows per-resource breakdown
- Command tab: Gantt renders tasks with dependency arrows
- "Save as Template" creates a template and it appears in /templates

---

## Phase 6 — Milestones, Tasks & Allocations

```
Build standalone Milestones, Tasks, and Allocations pages.

─── MILESTONES PAGE (/milestones) ───

API:
  GET /api/milestones?projectId=&status=&milestoneType=
  POST /api/milestones
  PATCH /api/milestones/:id
  DELETE /api/milestones/:id
  POST /api/milestones/:id/complete  ← [NEW] marks complete + triggers invoice alert if payment type
  GET /api/milestones/:id/signoffs
  POST /api/milestones/:id/signoffs

Page layout:
  Filter bar: Project selector | Status filter | Type filter [NEW] | Date range
  View: Vertical timeline of milestone cards

  Each milestone card:
    Project name chip | Milestone type badge [NEW]: Payment (amber) | Project (blue) | External (violet)
    Milestone name (bold) | Due date (red if past due, amber if within 7 days)
    Status badge: pending=slate, in_progress=blue, completed=emerald, at_risk=red
    Description + deliverables list
    Payment type only [NEW]: Invoice Amount + "Invoice Alert Sent" indicator
    External type only [NEW]: "Awaiting Customer Sign-off" banner
    "Complete Milestone" button [NEW]:
      For payment type: confirms invoice amount, sends PM notification, creates invoice record
      For external type: requires signoff before completing
    Signoff panel on pending/at_risk milestones: "Request Sign-off" button → notifies PM

─── TASKS PAGE (/tasks) ───

API:
  GET /api/tasks?projectId=&status=&assigneeId=&milestoneId=&parentTaskId=
  POST /api/tasks
  PATCH /api/tasks/:id
  DELETE /api/tasks/:id
  GET /api/task-dependencies
  POST /api/task-dependencies
  DELETE /api/task-dependencies/:id  ← [NEW]
  GET /api/task-comments?taskId=
  POST /api/task-comments
  GET /api/saved-filters?context=tasks  ← [NEW]
  POST /api/saved-filters              ← [NEW]
  DELETE /api/saved-filters/:id        ← [NEW]

Page layout:
  View toggle: List | Board (Kanban) | Hierarchy (tree) [NEW]
  Filter bar: Project | Assignee | Status | Priority | Search
  Saved Filters dropdown [NEW]:
    Shows saved filter sets (personal + shared)
    "Save current filter" button → dialog: name + share toggle
    Applying a saved filter populates all filter fields

  LIST VIEW:
    Columns: Task | Project | Milestone | Assignee | Status | Priority |
             Est Hours | Actual Hours | ETC [NEW] | Due Date | % | Comments badge [NEW]
    ETC column: shows remaining estimate; red if ETC > (Planned - Actual)

  BOARD VIEW (Kanban by status):
    Columns: Not Started | In Progress | Review | Blocked | Completed
    Drag cards using @dnd-kit → PATCH /api/tasks/:id on drop
    Each card shows: name | assignee avatar | priority badge | hours | comment count badge [NEW]

  HIERARCHY VIEW [NEW]:
    Full collapsible/expandable tree — same as Project Detail Tasks tab but cross-project
    Shows all tasks for selected project in hierarchical order
    Parent rows: rolled-up metrics
    Leaf rows: full detail + time entry enabled

  "Add Task" dialog:
    Name (required), Project (required), Parent Task (select — enables hierarchy) [NEW],
    Milestone, Assignee, Additional Assignees (multi-select) [NEW],
    Estimated Hours, ETC [NEW], Start Date, Due Date, Priority, Description
    Dependency Type (FS/SS/FF/SF) + predecessor task selector [NEW]
    Lag Days [NEW]

  Task click → slide-in panel:
    All fields editable + Comments + Dependency management [NEW]
    Dependency panel: shows predecessors and successors; add/remove dependencies

─── ALLOCATIONS PAGE (/allocations) ───

API:
  GET /api/allocations?resourceId=&projectId=&weekStart=&allocationType=
  POST /api/allocations
  PUT /api/allocations/:id
  DELETE /api/allocations/:id
  POST /api/allocations/fill-range
    Body: { resourceId, projectId, startDate, endDate, allocationPct,
            allocationType, opportunityId }  ← [NEW opportunityId for soft alloc]

Page layout:
  Header: Resource selector | Project selector | Week range | Type filter (Hard/Soft/All) [NEW]
  
  Allocation grid: resources as rows, week columns across the top
  Cells show: allocation % with hard (solid) and soft (striped) layers [NEW]
  Color coding: 0%=empty, 1-59%=emerald, 60-90%=blue, 91-110%=amber, >110%=red
  
  "New Allocation" form: Resource, Project, Week, %, Type (Hard/Soft), Opportunity (if Soft) [NEW]
  "Fill Range" form: Resource, Project, Start, End, %, Type, Opportunity [NEW]

─── CAPACITY PAGE (/capacity) ───

  Reuses heatmap component from Phase 4 (standalone view)
  Bench Summary: list of resources with <20% utilization, next availability date
  Upcoming Availability [NEW]: resources whose projects end within 30 days
  Staffing Requests panel [NEW]: open requests with required role, dates, opportunity name
```

**✅ Phase 6 Validation:**
- `/milestones` shows milestone type badges (Payment, Project, External)
- Completing a payment milestone shows invoice amount confirmation and triggers notification
- External milestone shows "Awaiting Sign-off" banner
- `/tasks` shows all 3 views (List, Board, Hierarchy)
- Hierarchy view shows tree with correct parent-child nesting
- Saving a filter and re-applying it restores all filter values
- Dependency panel in task slide-in shows predecessors/successors
- `/allocations` grid shows hard (solid) vs soft (striped) allocation types
- `/capacity` shows bench list and upcoming availability section

---

## Phase 7 — Customer & CRM Module

```
Build the full Customers, Prospects, and Opportunities modules.

─── CUSTOMERS MODULE (was Accounts) ───

API:
  GET /api/customers?status=&segment=&type=  ← route can alias /api/accounts
  POST /api/customers
  GET /api/customers/:id  (includes opportunities, projects, invoices, changeOrders)
  PUT /api/customers/:id
  POST /api/customers/:id/copy  ← [NEW]
  POST /api/customers/:id/save-as-template  ← [NEW]

CUSTOMERS LIST PAGE (/customers):

  4 KPI cards: Total Customers | Total ACV ($) | At Risk Count | Avg Health Score

  Filter bar: Search (name/industry/region) | Status | Segment | Type [NEW] | Clear

  Table columns:
    Customer Name (link) | Type (Enterprise/Mid-Market) [NEW] | Industry | Segment |
    Status badge | Health bar (emerald≥80, amber 65–79, red<65) |
    Region | OTM Version | Renewal Date (warning if <60 days) | ACV ($) |
    Actions: Copy, Save as Template [NEW]

  Status badge colors:
    active=emerald, at_risk=red, inactive=muted

  ADD CUSTOMER MODAL:
    Fields: Customer Name (required), Type (Enterprise/Mid-Market) [NEW],
      Status, Segment, Industry (10 options), Region, OTM Version,
      Annual Contract Value ($), Payment Terms [NEW], Contract Header [NEW],
      Contract Renewal Date, Cloud Deployment (toggle)
      Converted From Prospect (select from prospects list) [NEW]
    Submit: POST /api/customers, toast, refresh list

CUSTOMER DETAIL PAGE (/customers/:id):

  Header: name, type badge, industry, segment badge, status badge, health score
  Action buttons: Edit | Copy | Save as Template [NEW]
  4 KPI tiles: ACV | Health Score | Active Projects | Open Opportunities

  Tabs: Overview | Projects | Opportunities | Change Orders [NEW] | Invoices | Contacts [NEW]
  
  Overview: customer info cards + payment terms [NEW] + contract header [NEW] +
    renewal date + OTM version + cloud deployment flag +
    "Converted from Prospect" link if applicable [NEW]
  Projects tab: projects table with status + completion % + health dots [NEW]
  Opportunities tab: opportunities for this customer with stage badges
  Change Orders tab [NEW]: list of SOW amendments with status and value
  Invoices tab: invoice list with status + amounts
  Contacts tab [NEW]: internal KSAP contacts + customer contacts (name, role, email, phone)

─── PROSPECTS MODULE [NEW] ───

API:
  GET /api/prospects?status=&ownerId=   ← requires account_manager / delivery_director / admin
  POST /api/prospects
  GET /api/prospects/:id
  PUT /api/prospects/:id
  DELETE /api/prospects/:id
  POST /api/prospects/:id/convert  ← converts to customer; sets convertedToAccountId + convertedAt

NOTE: All prospect confidential fields (primaryContact, linkedinUrl, sentiment, touchPoints)
are stripped from responses for any role that is not account_manager, delivery_director, or admin.

PROSPECTS LIST PAGE (/prospects):
  [Visible to: account_manager, delivery_director, admin only]
  
  4 KPI cards: Total Prospects | Active | Qualified | Converted (this quarter)

  Table columns:
    Prospect Name | Owner | Status | Sentiment [confidential] | Last Touch Point date |
    Created Date | Actions (Convert to Customer, Edit, Delete)

  ADD PROSPECT MODAL:
    Fields: Prospect Name (required), Type, Industry, Segment, Owner (resource select),
      Primary Contact Name [confidential], Primary Contact Email [confidential],
      LinkedIn URL [confidential], Sentiment (Positive/Neutral/Negative) [confidential],
      Initial Notes
    Submit: POST /api/prospects, toast, refresh list

PROSPECT DETAIL PAGE (/prospects/:id):
  Header: name, type, status badge, owner, created date
  Confidential section (account_manager/admin only):
    Contact info, LinkedIn, sentiment, touch points timeline
  Opportunities linked to this prospect (opportunityList with prospectId)
  "Convert to Customer" button → opens conversion modal:
    Pre-fills customer fields from prospect (name, type, industry)
    Additional fields: ACV, payment terms, contract dates
    On confirm: POST /api/prospects/:id/convert
      Server: creates new accounts record, sets prospect.convertedToAccountId + convertedAt
      Redirects to new /customers/:id page
      Prospect record retained in DB with FK link

─── OPPORTUNITIES MODULE [UPDATED] ───

API:
  GET /api/opportunities?stage=&accountId=&prospectId=&type=&q=
  POST /api/opportunities
  GET /api/opportunities/:id
  PATCH /api/opportunities/:id  (stage update, probability update, staffing trigger)
  DELETE /api/opportunities/:id

OPPORTUNITIES PAGE (/opportunities):

  View toggle: List | Kanban — persists in sessionStorage

  4 KPI cards:
    Active Pipeline (value sum for non-won/lost/parked)
    Weighted Value (pipeline × probability)
    Win Rate (won / (won + lost) × 100%)
    30-Day Forecast (opps likely to close in 30 days, weighted) [NEW]

  LIST VIEW:
    Stage filter chips: All | Discovery | Qualified | Proposal | Negotiation | Won | Lost
    Filter bar: Search | Type | Owner | Clear | Result count
    Table columns: Opportunity | Customer/Prospect [NEW] | Stage | Type |
      Value | Prob bar | Close Date | Owner | Complexity | Staffing Risk [NEW] | →
    Pipeline by Stage: horizontal bar chart below table (total value per stage)
    30/60/90-day forecast section [NEW]:
      Three columns showing opportunities weighted by probability in each time bucket

  KANBAN VIEW:
    8 columns: Discovery | Qualified | Proposal | Negotiation | Won | Lost | Parked [removed Lead — merged into Discovery per exec meeting]
    Wait — use: Discovery (10%) | Qualified (30%) | Proposal (50%) | Negotiation (70%) |
               Won (100%) | Lost (0%) | Parked (0%)
    
    Each column:
      Color-coded top border + stage label + card count + total value
      Min height 480px, scrollable, dashed "Empty" placeholder
      Glow effect when card dragged over

    Opportunity cards:
      GripVertical drag handle + opportunity name
      Customer or Prospect name (with icon) [NEW — shows prospect icon if prospect]
      Engagement type badge
      Deal value (bold) + probability mini-bar
      Close date + owner
      Staffing Risk badge [NEW]: none/low/medium/high
      If probability ≥ 70% and staffingRequestTriggered=false: [NEW]
        "Trigger Staffing Request" button on card
        On click: POST /api/staffing-requests, sets staffingRequestTriggered=true

    Drag behavior:
      PointerSensor (desktop) + TouchSensor (mobile, 200ms delay)
      DragOverlay: ghost card rotated 1°
      On drop: optimistic UI update + PATCH /api/opportunities/:id { stage, probability }
      On API failure: revert + error toast
      On success: "Moved to [Stage]" toast
      At ≥70% (Negotiation): if staffingRequestTriggered=false, prompt PM to trigger staffing

  ADD OPPORTUNITY MODAL:
    Fields: Opportunity Name (required),
      Linked To: Customer or Prospect (radio + select) [NEW],
      Stage (auto-fills probability), Engagement Type,
      Delivery Complexity (Low/Medium/High/Very High),
      Deal Value ($), Win Probability (%),
      Expected Close Date, Expected Start Date,
      Duration (weeks), Owner (resource select) [NEW — was text field],
      Staffing Risk (none/low/medium/high) [NEW],
      Summary/Notes
    Stage → probability defaults:
      discovery=10, qualified=30, proposal=50, negotiation=70, won=100, lost=0, parked=0
    Submit: POST /api/opportunities, refresh list + KPI cards
```

**✅ Phase 7 Validation:**
- `/customers` shows 8 customers with correct health bars, type badges, ACV
- Customer detail has all tabs including "Change Orders" and "Contacts"
- Add Customer modal includes Payment Terms and Contract Header fields
- `/prospects` page is visible only to account_manager/delivery_director/admin roles
- Consultant navigating to `/prospects` gets redirected
- Prospect confidential fields are NOT returned by API for unauthorized roles
- "Convert to Customer" flow: creates customer, FK set on prospect, redirect to new customer detail
- `/opportunities` KPI cards show 30-Day Forecast metric
- Kanban shows 7 columns (no "Lead" column — merged into Discovery)
- Opportunity cards linked to a prospect show prospect icon
- Dragging to Negotiation (70%): "Trigger Staffing Request" prompt appears on card
- Clicking "Trigger Staffing Request" creates staffing_request record + soft allocation on heatmap

---

## Phase 8 — Time Entry & Timesheet Module

```
Build the Timesheets weekly grid — the primary daily interface for all consultants.

─── API ENDPOINTS ───

GET /api/timesheets?resourceId=&projectId=&startDate=&endDate=&status=
  Returns timesheet entries. Strips sellRate/costRate fields for unauthorized roles.

POST /api/timesheets
  Body: { resourceId, projectId, taskId, categoryId, entryDate, hours,
          isBillable, activityType, dailyComment, isCollaboration,
          projectName, resourceName, notes }
  Server auto-populates: billedRole (from resource's project assignment),
    sellRate (from rate card role), costRate (resource.costRate)
  All ID fields accept string or number (coerce to int internally)

PATCH /api/timesheets/:id
  Update: hours, isBillable, dailyComment, notes, activityType

DELETE /api/timesheets/:id
  Only allowed if status = 'draft'

POST /api/timesheets/submit-day
  Marks all entries for (resourceId, entryDate) as 'submitted'
  Body: { resourceId, entryDate }

POST /api/timesheets/approve  [NEW — PM approval]
  Body: { timesheetIds: number[], approverId: number }
  Sets status='approved', approvedAt, approvedById on each entry

POST /api/timesheets/reject  [NEW]
  Body: { timesheetIds: number[], approverId: number, reason: string }
  Sets status='rejected'

GET /api/timesheets/missing?resourceId=
  Returns { missingDays: string[] } — ISO dates in past 30 days with no entry

GET /api/timesheets/pending-approval?projectId=  [NEW — for PM review screen]
  Returns submitted entries awaiting approval, grouped by resource

GET /api/time-entry-categories
  Returns: id, name, isBillable, color

─── ADMINISTRATIVE PROJECT [NEW] ───

On first seed (or PMO settings), create a protected project:
  name: "Administrative — KSAP Internal"
  isInternal: true
  status: 'active'
  Special flag: isAdministrative = true (add column to projects table)
  
  Pre-seeded tasks (leaf, isLeaf=true):
    - Vacation / PTO
    - Sick Leave
    - Training / Learning
    - Public Holidays
    - Internal Meetings
    - Business Development

  This project appears in ALL resources' timesheet grids automatically.
  It is NOT shown in billing reports, finance pages, or customer-facing views.
  It has no budget limit.
  Deleting entries from this project is not allowed (protected).

─── WEEKLY GRID PAGE (/timesheets) ───

Layout: full-height page, sticky header, scrollable grid body

Header controls:
  Left: "← Prev week" / "Next week →" + current week label (Mon DD – Sun DD MMM YYYY)
  Right: Resource selector (for PM/admin — view any resource's timesheet) + "Export CSV" button

Role logic:
  Consultant: sees own grid only
  PM/Admin: Resource selector visible; can view and edit any resource's timesheet

Grid structure:
  Rows = one row per project the resource is allocated to [pre-populated]
    + Administrative project row (always present, cannot be removed)
    + Collaboration rows (dynamically added) [NEW]
  Columns = Mon | Tue | Wed | Thu | Fri | Sat | Sun
  Today's column header: blue circle around date number

Each cell (project × day):
  Empty: dashed "+" affordance → click to open entry popover
  Filled: shows hours (e.g. "8.0h") with color:
    green if day total ≤ 8h
    amber if day total 8–10h
    red if day total > 10h
  Editable: click filled cell → popover opens pre-filled

Entry popover fields:
  Task (select from project's leaf tasks — hierarchy displayed)  ← [NEW: task-aware]
  Hours (numeric, 0.25 increments)
  Daily Comment (required if hours > 0) [NEW — required field]
  Category (select from time-entry-categories)
  Billable toggle (default from task/project; override allowed)
  Activity Type
  Notes (optional)

Collaboration row [NEW]:
  Dashed "+" at bottom of project rows: "+ Add collaboration hours"
  Opens dialog: Project (search all projects, not just assigned) | Task | Hours | Comment
  Creates timesheet entry with isCollaboration=true
  PM for that project sees collaboration hours separately in their approval queue

Fixed rows at bottom:
  "Day Total" row: sums all hours per day; colors same as cell thresholds
  "Billable Hours" row [NEW]: shows only billable hours per day (grey non-billable)
  "Submit" row: submit button per day
    Disabled if no entries
    Shows "Submitted ✓" if all entries submitted
    Shows "Approved ✓" in green if PM has approved [NEW]
    Clicking: POST /api/timesheets/submit-day

Below grid:
  Missing Days banner: "X days in the past 30 days have no time logged" + link to week

─── PM APPROVAL SCREEN [NEW — /timesheets/approval] ───

  Visible to: project_manager, delivery_director, admin
  
  Filter: Project selector | Date range | Resource | Status (submitted/approved/rejected)
  
  Table: Resource | Date | Project | Task | Hours | Billable | Comment | Role | Status | Actions
  
  Bulk actions:
    Select all for a day/resource → Approve All | Reject All
    Individual: Approve | Reject (with reason)
  
  Rejected entries return to resource's timesheet with rejection reason shown
  Approved entries are available for invoice generation
```

**✅ Phase 8 Validation:**
- `/timesheets` shows current week; Administrative project row always present
- Task selector in popover shows project's leaf tasks in hierarchy order
- Daily Comment is required — saving without it shows validation error
- Billable Hours row shows below Day Total
- Collaboration hours row available; adding collaboration entry saves with isCollaboration=true
- PM logs in → can use Resource selector to view any consultant's timesheet
- `/timesheets/approval` visible to PM; shows submitted entries; bulk approve works
- Approved entries show "Approved ✓" on consultant's submit row
- Missing Days banner appears for past unsubmitted days

---

## Phase 9 — Billing, Rate Cards & Finance

```
Build Rate Cards, Finance dashboard, Invoices, and the billing lifecycle.

─── RATE CARDS PAGE (/rate-cards) [NEW] ───

API:
  GET /api/rate-cards?isTemplate=true
  POST /api/rate-cards
  GET /api/rate-cards/:id (includes rate_card_roles)
  PUT /api/rate-cards/:id
  POST /api/rate-cards/:id/roles  → add/update a role entry
  DELETE /api/rate-cards/:id/roles/:roleId

  GET /api/rate-cards/project/:projectId  → get rate card for a project
  POST /api/rate-cards/project/:projectId/copy-from-template
    Body: { templateRateCardId }
    Copies template into a project-specific rate card

Page layout:
  Two sections: Global Templates | Project Rate Cards

  Global Templates:
    List of template rate cards with effective dates
    "New Template" button → form: name, effectiveDate, expiryDate, currency
    Each template: expand to show role table

  Rate Card Role Table (per card):
    Columns: Role Name | Sell Rate ($/hr) | Buy Rate ($/hr) [admin/finance only] |
             Resources Currently in This Role
    "Add Role" button → inline row: role name, sell rate, buy rate
    Edit inline; save per row
    Copy icon on card → duplicates template with new effective date prompt

  Project Rate Cards:
    Link per project showing which rate card it uses
    Override capability: PM can copy global template to project-specific card
    and adjust individual role rates

─── MARGIN TRACKING (server-side) [NEW] ───

When a timesheet entry is created or approved:
  Server looks up the resource's assigned role on the project (from allocations or task_assignments)
  Looks up sellRate and buyRate for that role from the project's rate card
  Stores sellRate and buyRate on the timesheet entry
  If resource's costRate > buyRate for their assigned role: flag as cost_variance=true [NEW field]
  This feeds margin tracking with real numbers instead of estimates

GET /api/projects/:id/margin-analysis [NEW]
  Returns per-resource breakdown:
  [{ resourceId, resourceName, role, hours, revenue: sellRate*hours,
     cost: costRate*hours, margin, variance: costRate - buyRate }]
  Rows with variance > 0 are flagged (resource more expensive than budgeted for this role)

─── FINANCE PAGE (/finance) ───

API:
  GET /api/finance/summary
    Returns: { totalRevenue, totalCost, grossMargin, marginPct, billedHours,
               unbilledHours, outstandingInvoices, overdueInvoices, costVarianceCount [NEW],
               revenueByMonth: [{ month, revenue, cost, margin }] }

Page layout:
  6 KPI cards: Total Revenue | Total Cost | Gross Margin | Margin % | Billed Hours | Outstanding AR
  Cost Variance Alert [NEW]: banner showing count of entries where wrong role was used

  Revenue vs Cost area chart (Recharts, 12-month):
    Three lines: Revenue, Cost, Margin %
  
  Revenue by project breakdown table:
    Columns: Project | Customer | Billed Hours | Revenue | Cost [NEW] | Margin % [NEW] |
             Variance Flag [NEW]
  
  Pending Approvals summary [NEW]:
    Count of submitted timesheets awaiting PM approval, by project
    Link to /timesheets/approval for each

─── INVOICES PAGE (/invoices) ───

API:
  GET /api/invoices?status=&accountId=&projectId=
  POST /api/invoices
  GET /api/invoices/:id
  PATCH /api/invoices/:id  (status: draft → sent → paid / overdue)
  DELETE /api/invoices/:id
  POST /api/invoices/generate-from-timesheets  [NEW]
    Body: { projectId, startDate, endDate, includeApprovedOnly: true }
    Auto-creates invoice with line items from approved timesheet entries
    Each line item: resourceName, date, task, hours, rate, amount, comment (as description)
  POST /api/invoices/generate-from-milestone  [NEW]
    Body: { milestoneId }
    Creates invoice from payment milestone invoiceAmount

Page layout:
  4 KPI cards: Total Outstanding | Overdue | Paid (30 days) | Draft count

  Filter: Status tabs (All | Draft | Sent | Paid | Overdue) + Project filter + Date range

  Invoices table:
    Invoice # | Project | Customer | Issue Date | Due Date | Amount |
    Type (T&M or Fixed-Fee) [NEW] | Status badge | Actions (View, Mark Paid, Download PDF)

  Invoice detail modal/page:
    Header: invoice number, dates, customer, project, type
    Line items table (for T&M): Resource | Date | Task | Hours | Rate | Amount | Billable Comment
    For Fixed-Fee: single line with milestone name and amount
    Totals: subtotal, tax, total

  "New Invoice" button:
    Step 1: Select invoice type — T&M (from approved timesheets) or Fixed-Fee (from milestone)
    Step 2a (T&M): Select project + date range → preview approved billable entries → confirm
    Step 2b (Fixed-Fee): Select payment milestone → shows amount → confirm
    Generates invoice with correct line items automatically

─── ADMIN DASHBOARD (/admin, /dashboard/admin) ───

  Platform health: API response time, DB connection, seed data status
  User activity: last login per resource, timesheet submission rates by consultant
  Data overview: entity counts for all tables
  System metrics: projects by status (pie chart) | utilization histogram |
    Cost variance count (how many timesheet entries have wrong-role variance) [NEW]
  
  PMO Settings link → /settings/pmo

─── PM DASHBOARD (/dashboard/pm) ───

  My projects: list with health dots (Budget/Hours/Timeline/Risks) [NEW]
  My tasks due this week: sorted by due date
  Pending timesheet approvals: count + link to /timesheets/approval [NEW]
  Team utilization: mini heatmap for resources on my projects

─── CONTRACTS PAGE (/contracts) ───

  Table columns: Contract Name | Customer | Type | Value | Start | End | Status
  Status filter: draft | active | expired | terminated
  "New Contract" button → basic form

─── TEMPLATES PAGE (/templates) ───

  Project Templates list:
    Columns: Name | Phases | Tasks | Estimated Weeks | Last Used | Usage Count | Actions
    "Use Template" → /projects/from-template (pre-fills form with template structure)
    "Edit" → opens template structure editor (add/remove tasks/phases/milestones)
    Source: project_templates table (populated via "Save as Template" from project detail)

─── SETTINGS PAGE (/settings/pmo) ───

  Sections:
    Billing Defaults: default billing rate, default currency, default payment terms
    Utilization Thresholds: bench %, optimal range %, overbooked threshold %
    Notification Preferences: which events trigger notifications, frequency
    Time Entry Categories: CRUD on time-entry-categories table
    Administrative Project Tasks: manage the protected admin project's task list [NEW]
    Rate Card Management: link to /rate-cards

─── NOTIFICATIONS (API) ───

  GET /api/notifications?userId=&isRead=
  PATCH /api/notifications/:id (mark read)
  GET /api/notifications/unread-count?userId=

  Auto-generated events:
    milestone_due:       milestones due within 7 days
    overbooked:          resources > 110% utilization
    invoice_overdue:     invoices past due date with status != 'paid'
    milestone_payment:   [NEW] payment milestone completed → notify PM to invoice
    timesheet_approval:  [NEW] resource submitted timesheet → notify PM to approve
    staffing_request:    [NEW] opportunity hit ≥70% → notify resource manager
    mention:             [NEW] @mention in task comment → notify mentioned user

  Top bar bell: polls /api/notifications/unread-count every 30 seconds
  Bell click: dropdown with 10 most recent notifications
    Each: icon + title + body + time ago + "Mark read" button
    "View all" link at bottom

─── NOT FOUND PAGE ───

  Friendly 404 with message + link to dashboard
```

**✅ Phase 9 Validation:**
- `/rate-cards` shows global templates and project-specific cards
- Rate card role table: buy rate hidden for consultant role
- Adding a role to a rate card saves correctly; shows in project Finance tab
- `/finance` KPI cards show real aggregated data from timesheets
- Cost Variance banner appears when timesheets have entries with variance
- `/invoices` list includes Type column (T&M vs Fixed-Fee)
- "New Invoice" → T&M flow: selects project/dates, previews approved entries, creates invoice with line items
- "New Invoice" → Fixed-Fee flow: selects payment milestone, creates invoice for milestone amount
- `/timesheets/approval` linked from PM Dashboard pending count
- Notification bell: mention notification received when @mentioned in a task comment
- staffing_request notification auto-created when opportunity hits 70%
- `/templates` shows templates saved from projects; "Use Template" opens project form

---

## Phase 10 — Polish, Seed Enrichment & Full Validation

```
Final polish, enriched seed data, performance, and cross-cutting quality.

─── SEED DATA ENRICHMENT ───

Expand auto-seed.ts to include fully realistic data:

1. Rate Cards:
   1 global template with 8 roles:
   Role                        | Sell Rate | Buy Rate
   Delivery Director           | $195/hr   | $120/hr
   Practice Lead               | $175/hr   | $105/hr
   Solution Architect          | $165/hr   | $98/hr
   Senior OTM Consultant       | $150/hr   | $88/hr
   OTM Consultant              | $130/hr   | $75/hr
   Business Analyst            | $120/hr   | $68/hr
   QA Specialist               | $110/hr   | $62/hr
   Rate Management Specialist  | $105/hr   | $60/hr

2. Projects (9 total, each with projectManagerId, rate card assigned):
   - GlobalTrans OTM 24.2 Upgrade (active, fixed-fee, $485K)
   - Apex Logistics Cloud Migration (active, T&M, $320K)
   - NorthStar AMS Engagement (at_risk, fixed-fee, $210K)
   - Pacific Distribution Rate Maintenance (active, T&M, $95K)
   - Meridian Carriers Integration (active, fixed-fee, $175K)
   - Summit Freight Partners AMS (active, T&M, $140K)
   - GlobalTrans Data Migration (active, fixed-fee, $225K)
   - BlueStar Implementation Phase 1 (forecasted, fixed-fee, $510K)
   - KSAP Internal — Platform Build (isInternal=true, no billing)

3. Milestones (3–5 per project):
   Each has milestoneType set correctly:
   - "Requirements Sign-off" → external (customer gate)
   - "Design Approved" → external
   - "UAT Complete" → payment (triggers 30% invoice on fixed-fee projects)
   - "Go-Live" → payment (triggers 50% invoice)
   - "Hypercare Complete" → project (internal checkpoint)

4. Tasks (5–10 per project, 3-level hierarchy):
   Level 0 (phase): "Discovery & Requirements", "Solution Design",
     "Build & Configure", "Testing", "Go-Live & Hypercare"
   Level 1 (task): e.g., "Stakeholder Interviews", "As-Is Process Mapping"
   Level 2 (leaf, isLeaf=true): e.g., "Document shipper requirements",
     "Map TM to OTM rate fields"
   assigneeId set to realistic resource for that project
   task_assignments: 1 additional resource per leaf task
   Mix of statuses: not_started (40%), in_progress (35%), completed (25%)
   ETC set for in_progress tasks

5. Allocations (rolling 8-week window):
   Hard allocations: each active resource on their projects (50/80/100%)
   Soft allocations: 3 resources on BlueStar (prospective) from staffing_requests
   Overbooked: 3 intentional entries >100% for risk alert testing

6. Timesheets (30-day history):
   8 active consultants, each with daily entries on their projects
   billedRole, sellRate, costRate populated from rate card
   2 entries with costRate > buyRate (cost variance testing)
   Mix: 60% submitted, 30% approved, 10% draft
   Daily comments present on all entries

7. Invoices (2–3 per project):
   T&M projects: line items from timesheet data
   Fixed-fee projects: milestone-linked invoices
   At least 2 overdue (dueDate < today, status='sent')
   At least 1 per project in 'paid' status

8. Opportunities (10 total):
   Mix of accountId and prospectId (3 tied to prospects)
   2 at Negotiation stage (≥70%) with staffingRequestTriggered=false
     → these should trigger staffing request workflow on load
   stages: discovery×2, qualified×2, proposal×2, negotiation×2, won×1, lost×1

9. Task Comments:
   2–3 comments per in_progress task, with realistic content
   1 comment with mentionedUserIds populated

10. Saved Filters:
    2 pre-seeded shared saved filters:
      "Open Tasks" (context: tasks, status: ['not_started', 'in_progress'])
      "My Team Overdue" (context: tasks, status: ['blocked'], assigneeId: null — team-wide)

─── UI POLISH ───

Empty States:
  Every list/table shows illustration + helpful message + CTA button when empty
  Examples:
    /customers (no results): "No customers found. Add your first customer."
    /tasks (no results): "No tasks match your filters. Try adjusting your search."
    /timesheets (no entries): "No time logged this week. Click any cell to start."

Loading Skeletons:
  All data-fetching states: shadcn Skeleton components matching content shape
  Heatmap: skeleton shows grey cells in grid pattern
  Cards: skeleton shows avatar + 2 lines
  Tables: 5 skeleton rows matching column count

Toast Notifications:
  Create success: "[Entity] created successfully"
  Update success: "[Entity] updated"
  Delete success: "[Entity] deleted"
  Error: "Something went wrong. Please try again." (destructive variant)
  Approval: "X entries approved"
  Invoice: "Invoice #INV-XXXX generated"

Error Boundaries:
  Every page wrapped in ErrorBoundary → shows friendly card: "Something went wrong"
  + "Retry" button + link to dashboard

Form Validation:
  All required fields marked with red asterisk (*)
  Inline error messages below each field on submit attempt
  Zod schemas validated server-side; error messages propagated to UI

Dark Mode:
  Tailwind dark: variants applied throughout
  System preference detected via prefers-color-scheme
  Manual toggle in /settings/pmo → stored in localStorage

─── PERFORMANCE ───

React Query caching:
  staleTime: 60_000 for reference data (resources, accounts, rate-cards)
  staleTime: 30_000 for frequently changing data (timesheets, notifications)
  queryClient.invalidateQueries() called on all mutations

Search debounce: 300ms on all search inputs

Virtual lists:
  Tables with >100 rows use @tanstack/virtual (windowed rendering)
  Heatmap with >50 resources uses row virtualization

API response compression: gzip via compression middleware on Express

─── FINAL VALIDATION CHECKLIST ───

DELIVERY DIRECTOR login:
  [ ] /dashboard/admin loads with all KPI charts and cost variance alert
  [ ] Can view all projects, all resources, all customers, all prospects
  [ ] Rate card buy rates visible on /rate-cards
  [ ] Prospect confidential fields visible on /prospects/:id
  [ ] Add Customer modal includes Payment Terms + Contract Header fields
  [ ] Add Opportunity modal: "Linked To" shows Prospect option
  [ ] Kanban drag to Negotiation → staffing request prompt appears
  [ ] Triggering staffing request creates record + soft allocation on heatmap

PROJECT MANAGER login:
  [ ] /dashboard/pm shows pending timesheet approval count
  [ ] /timesheets/approval lists submitted entries; bulk approve works
  [ ] Approved entries show "Approved ✓" on consultant's timesheet
  [ ] /projects/:id all 6 tabs load with real data
  [ ] Tasks tab: hierarchy tree expands/collapses; leaf tasks only allow time entry
  [ ] ETC field editable on leaf tasks; ETC projection updates in Finance tab
  [ ] Payment milestone "Complete" → invoice alert notification sent
  [ ] "Save as Template" from project → appears in /templates
  [ ] "New Invoice" T&M flow: line items from approved timesheets

CONSULTANT login:
  [ ] Redirected to /timesheets by default
  [ ] Administrative project row always visible in grid
  [ ] Daily Comment is required — saving without it shows validation error
  [ ] Collaboration hours row visible; can log on non-assigned project
  [ ] Billable Hours row shows below Day Total
  [ ] costRate / buyRate fields NOT returned by API (check network tab)
  [ ] /prospects route redirects away (no access)
  [ ] Task @mention: mentioned user receives notification

ACCOUNT MANAGER login:
  [ ] /prospects page accessible; confidential fields visible
  [ ] /customers page accessible; no financial rates visible
  [ ] Converting a prospect → customer: new customer created, FK set, prospect retained

FINANCE login:
  [ ] /finance shows cost variance banner with count
  [ ] Revenue by project table shows Cost and Margin % columns
  [ ] Rate card buy rates visible
  [ ] "Generate Invoice from Timesheets" flow works end-to-end

CROSS-CUTTING:
  [ ] All 32 resources on /resources roster with dual utilization rings
  [ ] Heatmap expandable tree shows project breakdown per resource
  [ ] Heatmap inversion (view by project) works
  [ ] Staffing request phantom rows appear on heatmap
  [ ] Soft allocation shown with stripe pattern distinct from hard allocation
  [ ] /milestones: all 3 milestone types display correctly
  [ ] Completing a payment milestone triggers notification to PM
  [ ] /tasks saved filters: save, share, and reload filter combinations
  [ ] Task dependency panel: add FS dependency between two tasks
  [ ] @mention in task comment: notification received by mentioned user
  [ ] All 10 opportunities in Kanban in correct stage columns
  [ ] No console errors on any page
  [ ] API returns no 500 errors in logs
  [ ] Page refresh on any route works (SPA routing correctly configured)
  [ ] Sign out clears all state and returns to /login
  [ ] Sidebar collapses to icon rail on screens < 1024px
  [ ] Dark mode toggle in settings works system-wide
  [ ] Empty state shown on /customers when all filtered out (clear filter to restore)
  [ ] Loading skeletons match content shape (not spinners)
```

---

## Architecture Reference

### Directory Structure

```
/
├── artifacts/
│   ├── api-server/
│   │   ├── src/
│   │   │   ├── index.ts                   # Express app entry
│   │   │   ├── middleware/
│   │   │   │   ├── rbac.ts                # Role checks + field-level security
│   │   │   │   └── field-access.ts        # Strip unauthorized fields from responses
│   │   │   ├── routes/
│   │   │   │   ├── index.ts               # Router aggregator
│   │   │   │   ├── accounts.ts            # /api/customers + /api/accounts alias
│   │   │   │   ├── prospects.ts           # [NEW] /api/prospects
│   │   │   │   ├── resources.ts
│   │   │   │   ├── projects.ts
│   │   │   │   ├── milestones.ts
│   │   │   │   ├── tasks.ts
│   │   │   │   ├── task-comments.ts       # [NEW]
│   │   │   │   ├── task-dependencies.ts   # [NEW]
│   │   │   │   ├── saved-filters.ts       # [NEW]
│   │   │   │   ├── allocations.ts
│   │   │   │   ├── staffing-requests.ts   # [NEW]
│   │   │   │   ├── timesheets.ts
│   │   │   │   ├── rate-cards.ts          # [NEW]
│   │   │   │   ├── invoices.ts
│   │   │   │   ├── opportunities.ts
│   │   │   │   ├── notifications.ts
│   │   │   │   ├── finance.ts
│   │   │   │   ├── dashboard.ts
│   │   │   │   └── admin.ts
│   │   │   └── lib/
│   │   │       ├── auto-seed.ts
│   │   │       └── margin.ts              # [NEW] margin calculation utilities
│   │   ├── package.json
│   │   └── build.mjs
│   │
│   └── businessnow/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── router.tsx
│       │   ├── index.css
│       │   ├── lib/
│       │   │   ├── auth.ts                # useAuth, useAuthRole, useCanSee
│       │   │   └── query-client.ts        # React Query config
│       │   ├── components/
│       │   │   ├── layout/
│       │   │   │   ├── app-shell.tsx
│       │   │   │   ├── sidebar.tsx        # Collapsible to icon rail
│       │   │   │   └── top-bar.tsx
│       │   │   ├── shared/
│       │   │   │   ├── heatmap.tsx        # Reusable heatmap (resources + capacity)
│       │   │   │   ├── kanban-board.tsx   # Reusable Kanban (tasks + opportunities)
│       │   │   │   ├── gantt-chart.tsx    # [NEW] project command view
│       │   │   │   ├── task-tree.tsx      # [NEW] hierarchical task display
│       │   │   │   ├── saved-filters.tsx  # [NEW] filter save/load UI
│       │   │   │   ├── comment-panel.tsx  # [NEW] task comments + @mention
│       │   │   │   └── error-boundary.tsx
│       │   │   └── ui/                    # shadcn/ui components
│       │   ├── pages/
│       │   │   ├── login.tsx
│       │   │   ├── dashboard/
│       │   │   │   ├── admin.tsx
│       │   │   │   └── pm.tsx
│       │   │   ├── projects/
│       │   │   │   ├── list.tsx
│       │   │   │   ├── detail.tsx
│       │   │   │   └── command.tsx        # Gantt view
│       │   │   ├── resources/
│       │   │   │   ├── list.tsx
│       │   │   │   └── detail.tsx
│       │   │   ├── customers/             # [renamed from accounts]
│       │   │   │   ├── list.tsx
│       │   │   │   └── detail.tsx
│       │   │   ├── prospects/             # [NEW]
│       │   │   │   ├── list.tsx
│       │   │   │   └── detail.tsx
│       │   │   ├── opportunities/
│       │   │   ├── timesheets/
│       │   │   │   ├── grid.tsx
│       │   │   │   └── approval.tsx       # [NEW] PM approval screen
│       │   │   ├── finance/
│       │   │   ├── invoices/
│       │   │   ├── rate-cards/            # [NEW]
│       │   │   ├── milestones/
│       │   │   ├── tasks/
│       │   │   ├── allocations/
│       │   │   ├── capacity/
│       │   │   ├── contracts/
│       │   │   ├── templates/
│       │   │   ├── admin/
│       │   │   └── settings/
│       │   └── hooks/
│       │       ├── use-toast.ts
│       │       ├── use-heatmap.ts
│       │       └── use-mention.ts         # [NEW] @mention autocomplete
│       ├── package.json
│       └── vite.config.ts
│
├── lib/
│   ├── db/
│   │   ├── index.ts
│   │   ├── schema.ts                      # All table definitions (updated)
│   │   └── package.json
│   └── api-client-react/
│       └── package.json
│
├── package.json
└── pnpm-workspace.yaml
```

---

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Routing | Wouter | Lightweight; no React Router overhead |
| Auth | localStorage role-picker | Simple internal tool — SSO added post-MVP |
| Field security | Express middleware + UI hook | Enforced at data layer AND view layer |
| State | React Query + local useState | Server state via RQ; UI state local |
| Forms | Controlled inputs + Zod | No form library overhead; consistent validation |
| Charts | Recharts | Native React; Tailwind-compatible |
| Drag & Drop | @dnd-kit/core | Accessible; pointer + touch support |
| Task hierarchy | Adjacency list (parentTaskId) | Simple recursive queries; 7-level depth |
| DB ORM | Drizzle | Type-safe; minimal overhead; pairs with postgres.js |
| API validation | Zod schemas in routes | Type inference + consistent error messages |
| Styling | Tailwind v4 + shadcn/ui | Utility-first + accessible components |
| Margin tracking | Stored on timesheet at entry | Real numbers; no re-calculation needed |

---

### Critical Implementation Notes

1. **API Base URL**: Always use `const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api"`. Never hardcode `/api`.

2. **Field-level security**: Implement `checkFieldAccess(role, fields[])` as Express middleware. Apply on every route that returns resource costs, prospect confidential data, or rate card buy rates. Strip fields before response — never rely on UI alone.

3. **Drizzle numeric fields**: PostgreSQL `numeric` columns return as strings. Always `parseFloat()` before arithmetic. Applies to: hourlyRate, costRate, sellRate, buyRate, budget, allocationPct, etc.

4. **Task hierarchy queries**: Use recursive CTE (`WITH RECURSIVE`) for fetching full task trees. Index `parentTaskId` column. Pre-compute `hierarchyLevel` on insert for display performance.

5. **ETC vs Remaining**: ETC is stored independently (`etcHours` column). Never derive it as `estimatedHours - actualHours`. When ETC is null, fall back to `MAX(0, estimatedHours - actualHours)` for display only.

6. **Soft vs Hard allocation visual**: Hard allocation = solid color cell fill. Soft allocation = same color but with `repeating-linear-gradient` diagonal stripe overlay (CSS). Both stack in the same cell.

7. **Optimistic updates**: For all Kanban drag-and-drop (tasks and opportunities), update React state immediately, then fire PATCH. On failure, re-fetch from server and show error toast. Never leave UI in inconsistent state.

8. **Prospect conversion**: POST `/api/prospects/:id/convert` must be transactional: create account record + set `prospect.convertedToAccountId` + `prospect.convertedAt` + `prospect.status = 'converted'` in a single DB transaction. If any step fails, roll back entirely.

9. **Administrative project protection**: Filter `isAdministrative=true` projects from all billing, finance, and customer-facing API responses. Never allow deletion. Always inject into timesheet grid regardless of allocations.

10. **Milestone invoice trigger**: When PATCH `/api/milestones/:id` sets `status='completed'` and `milestoneType='payment'`: automatically create a notification (type: `milestone_payment`) for the project's PM. Set `invoiceAlertSent=true`. Do NOT auto-create the invoice — PM must manually generate it.

11. **Rate auto-population on timesheets**: POST `/api/timesheets` server handler must look up the resource's project-role assignment, find the matching rate_card_role, and store `sellRate` and `costRate` on the entry. This is non-negotiable — margin calculations depend on it.

12. **Radix Select sentinel values**: Never use `value=""` on `<SelectItem>`. Use `"__none__"` and convert back to `null`/`""` in the `onChange` handler.

13. **Auto-seed idempotency**: Check `SELECT COUNT(*) FROM resources` before any seeding. If > 0, exit entirely. Never `TRUNCATE`. The seed is append-only.

14. **Array fields**: PostgreSQL `text[]` columns — pass a JS `string[]` directly to Drizzle. No manual array literal formatting needed.

15. **@mention notification**: When a task comment is posted with `mentionedUserIds`, create one `notification` record per mentioned user with `type='mention'`, `resourceId=taskId`, `resourceType='task'`. The notification bell must poll and show these.

---

### New Tables Summary (Executive Committee Additions)

| Table | Purpose |
|-------|---------|
| `prospects` | Pre-customer CRM entity with confidential fields |
| `task_assignments` | Multi-resource assignment per task (beyond primary assignee) |
| `task_dependencies` | FS/SS/FF/SF dependency relationships with lag |
| `task_comments` | Rich comments with @mention and external visibility flag |
| `saved_filters` | Saved + shared filter combinations per context |
| `staffing_requests` | Role-based staffing needs triggered by ≥70% opportunity |
| `rate_cards` | Billing rate card definitions (global templates + project overrides) |
| `rate_card_roles` | Sell rate + buy rate per role per rate card |
| `project_templates` | Reusable project skeletons (tasks + milestones + phases) |

---

### API Route Summary

| Route Group | Key Endpoints |
|-------------|---------------|
| `/api/customers` | GET, POST, GET/:id, PUT/:id, POST/:id/copy, POST/:id/save-as-template |
| `/api/prospects` | GET, POST, GET/:id, PUT/:id, DELETE/:id, POST/:id/convert |
| `/api/resources` | GET, GET/utilization, GET/:id, POST, PUT/:id |
| `/api/staffing-requests` | GET, POST, PATCH/:id |
| `/api/projects` | GET, POST, GET/:id, GET/:id/full, GET/:id/revenue, GET/:id/margin-forecast, GET/:id/margin-analysis, GET/:id/projection, PUT/:id, POST/:id/save-as-template, POST/from-template |
| `/api/milestones` | GET, POST, PATCH/:id, DELETE/:id, POST/:id/complete, GET/:id/signoffs, POST/:id/signoffs |
| `/api/tasks` | GET, POST, PATCH/:id, DELETE/:id |
| `/api/task-comments` | GET?taskId=, POST, PATCH/:id, DELETE/:id |
| `/api/task-dependencies` | GET, POST, DELETE/:id |
| `/api/saved-filters` | GET?context=, POST, DELETE/:id |
| `/api/allocations` | GET, POST, PUT/:id, DELETE/:id, POST/fill-range |
| `/api/timesheets` | GET, POST, PATCH/:id, DELETE/:id, POST/submit-day, POST/approve, POST/reject, GET/missing, GET/pending-approval |
| `/api/rate-cards` | GET, POST, GET/:id, PUT/:id, POST/:id/roles, DELETE/:id/roles/:roleId, GET/project/:projectId, POST/project/:projectId/copy-from-template |
| `/api/invoices` | GET, POST, GET/:id, PATCH/:id, DELETE/:id, POST/generate-from-timesheets, POST/generate-from-milestone |
| `/api/opportunities` | GET, POST, GET/:id, PATCH/:id, DELETE/:id |
| `/api/finance/summary` | GET |
| `/api/notifications` | GET, PATCH/:id, GET/unread-count |
| `/api/time-entry-categories` | GET |
| `/api/health` | GET → `{ status: "ok", timestamp }` |

---

*KSAP Technologies — BUSINESSNow Delivery Command Center*
*MVP Target: May 1, 2026 | Stack: React 19 + Vite 7 + Express 5 + Drizzle ORM + PostgreSQL*
*This document incorporates all executive committee mandated changes from the April 15, 2026 meeting.*
