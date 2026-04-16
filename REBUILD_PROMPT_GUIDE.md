# BUSINESSNow — Delivery Command Center
## Comprehensive Phase-by-Phase Rebuild Guide

> **Project:** Full-stack PSA (Professional Services Automation) platform for an Oracle Transportation Management (OTM) consulting firm.  
> **Stack:** React 19 + Vite + Tailwind CSS v4 + shadcn/ui + Wouter routing + Recharts | Express 5 + Drizzle ORM + PostgreSQL  
> **Architecture:** pnpm monorepo with two artifacts — `api-server` (Express REST API) and `businessnow` (React SPA)  
> **Auth model:** Local role-picker stored in localStorage (no external auth provider)

---

## How to Use This Guide

Each phase below is a **self-contained prompt** you can paste directly into an AI coding assistant. Phases build on each other — complete and validate each phase before moving to the next. Validation checkpoints are included at the end of every phase.

---

## Phase 1 — Monorepo Foundation & Project Scaffold

```
Create a pnpm monorepo called "BUSINESSNow" using the following structure:

Monorepo layout:
  /artifacts/api-server   → Express 5 REST API
  /artifacts/businessnow  → React 19 + Vite SPA
  /lib/db                 → Shared Drizzle ORM schema package (@workspace/db)
  /lib/api-client-react   → Auto-generated React Query hooks (@workspace/api-client-react)
  pnpm-workspace.yaml     → declares artifacts/* and lib/*

Tech stack:
- React 19, Vite 7, Tailwind CSS v4, shadcn/ui (New York style), Wouter (routing), Recharts, Lucide React icons
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
- Base URL set to /businessnow/ (proxied via Replit workspace routing)
- API calls use: const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api"
- Tailwind configured with dark navy sidebar theme:
    sidebar bg: hsl(222, 47%, 11%)
    primary blue: hsl(221, 83%, 53%)
    page bg: hsl(210, 20%, 98%)
- shadcn/ui components installed: button, input, label, select, dialog, table, badge,
  skeleton, textarea, switch, toast/toaster, card, tabs, separator, tooltip
- Global font: Inter via CSS import

Database (@workspace/db):
- Exports: db (Drizzle client), all table schemas
- Reads DATABASE_URL from environment
- Connection pooling via postgres.js

App shell:
- React app renders a <Router> with a persistent <AppShell> layout
- AppShell has: dark sidebar (240px wide), top bar, main content area
- Sidebar shows app logo "BUSINESSNow" + nav links (placeholders for now)
- Top bar shows current user avatar + page title
```

**✅ Phase 1 Validation:**
- `pnpm install` completes without errors
- `pnpm --filter @workspace/api-server run dev` starts and GET /api/health returns `{"status":"ok"}`
- `pnpm --filter @workspace/businessnow run dev` starts and shows the app shell at localhost with sidebar and top bar visible
- No TypeScript errors in either artifact

---

## Phase 2 — Database Schema (Core Tables)

```
Using Drizzle ORM, define the following core tables in @workspace/db/schema.ts.
Use PostgreSQL serial primary keys for all tables. Export all tables.

TABLE: users
  id (serial PK), name (text not null), email (text unique), role (text not null),
  avatarUrl (text), createdAt (timestamptz default now())

TABLE: resources
  id (serial PK), userId (int FK→users), name (text not null), title (text),
  practiceArea (text not null default 'implementation'), employmentType (text not null default 'employee'),
  skills (text[] default '{}'), certifications (text[] default '{}'), specialties (text[] default '{}'),
  utilizationTarget (int default 80), currentUtilization (int default 0),
  status (text not null default 'available'), hourlyRate (numeric 8,2), costRate (numeric 8,2),
  location (text), timezone (text), isContractor (bool default false),
  availableFrom (text), bio (text), dailyHoursCapacity (numeric 5,2 default 8),
  currency (text default 'CAD'), createdAt (timestamptz default now())

TABLE: accounts
  id (serial PK), name (text not null), industry (text), segment (text default 'enterprise'),
  status (text not null default 'active'), healthScore (int default 75),
  annualContractValue (numeric 14,2), accountOwnerId (int FK→resources),
  region (text), otmVersion (text), cloudDeployment (bool default false),
  renewalDate (text), createdAt (timestamptz default now())

TABLE: projects
  id (serial PK), name (text not null), accountId (int FK→accounts), accountName (text),
  status (text not null default 'active'), phase (text default 'execution'),
  startDate (text), endDate (text), budget (numeric 14,2), estimatedHours (int),
  billedHours (numeric 10,2 default 0), projectManagerId (int FK→resources),
  deliveryLeadId (int FK→resources), description (text), healthStatus (text default 'green'),
  completionPct (int default 0), isFixedFee (bool default true),
  billingRate (numeric 8,2 default 125), currency (text default 'CAD'),
  createdAt (timestamptz default now()), updatedAt (timestamptz default now())

TABLE: milestones
  id (serial PK), projectId (int FK→projects not null), name (text not null),
  dueDate (text), completedDate (text), status (text default 'pending'),
  description (text), deliverables (text), isBillable (bool default false),
  invoiceAmount (numeric 14,2), signoffRequired (bool default false),
  createdAt (timestamptz default now())

TABLE: tasks
  id (serial PK), projectId (int FK→projects not null), milestoneId (int FK→milestones),
  name (text not null), description (text), status (text default 'not_started'),
  priority (text default 'medium'), estimatedHours (numeric 8,2), actualHours (numeric 8,2 default 0),
  startDate (text), dueDate (text), assigneeId (int FK→resources),
  completionPct (int default 0), phase (text), deliverable (text),
  createdAt (timestamptz default now())

TABLE: allocations
  id (serial PK), resourceId (int FK→resources not null), projectId (int FK→projects not null),
  taskId (int FK→tasks), weekStart (text not null), allocationPct (int not null default 100),
  allocationType (text default 'hard'), notes (text),
  createdAt (timestamptz default now())

TABLE: timesheets
  id (serial PK), resourceId (int FK→resources not null), projectId (int FK→projects),
  taskId (int FK→tasks), categoryId (int), entryDate (text not null),
  hours (numeric 5,2 not null), isBillable (bool default true),
  activityType (text default 'consulting'), projectName (text), resourceName (text),
  notes (text), submittedAt (timestamptz), status (text default 'draft'),
  createdAt (timestamptz default now())

TABLE: invoices
  id (serial PK), projectId (int FK→projects), accountId (int FK→accounts),
  invoiceNumber (text not null unique), status (text default 'draft'),
  issueDate (text), dueDate (text), paidDate (text),
  subtotal (numeric 14,2 default 0), tax (numeric 14,2 default 0),
  total (numeric 14,2 default 0), currency (text default 'CAD'),
  notes (text), lineItems (jsonb default '[]'), createdAt (timestamptz default now())

TABLE: opportunities
  id (serial PK), name (text not null), accountId (int FK→accounts not null),
  accountName (text), stage (text not null default 'lead'),
  type (text not null default 'implementation'), value (numeric 14,2),
  probability (int default 20), expectedStartDate (text), expectedCloseDate (text),
  expectedDurationWeeks (int), ownerId (int FK→resources), ownerName (text),
  deliveryComplexity (text default 'medium'), staffingRisk (text default 'none'),
  summary (text), notes (text), goNoGoStatus (text default 'pending'),
  createdAt (timestamptz default now()), updatedAt (timestamptz default now())

TABLE: notifications
  id (serial PK), userId (int FK→users), type (text not null),
  title (text not null), body (text), isRead (bool default false),
  resourceId (text), resourceType (text), createdAt (timestamptz default now())

After defining schema:
1. Run db:push to sync schema to PostgreSQL
2. Create an auto-seed script at api-server/src/lib/auto-seed.ts that:
   - Checks if resources table has any rows; if yes, skips (idempotent)
   - Seeds in order: resources (32 OTM consultants), accounts (8 logistics companies),
     projects (9 active projects), opportunities (10 across all pipeline stages)
   - The 32 resources should have realistic OTM consulting roles:
     Delivery Director, Practice Lead, Senior Consultant, Consultant, Analyst,
     Business Analyst, Solution Architect, QA Lead, Integration Specialist,
     Rate Management Specialist — across practice areas:
     implementation, cloud_migration, ams, qa, data_migration, custom_dev,
     rate_maintenance, solution_architect, integration, management
   - The 8 accounts should be: GlobalTrans Corp, Apex Logistics, NorthStar Freight,
     Pacific Distribution, Meridian Carriers, BlueStar Transport,
     Summit Freight Partners, Harbor Logistics Group
     (mix of active, at_risk, prospect, inactive statuses)
   - Projects reference accounts and have realistic names like:
     "GlobalTrans OTM 24.2 Upgrade", "Apex Logistics Cloud Migration"
   - Opportunities span all stages: lead, qualified, discovery, proposal,
     negotiation, won, lost, parked
3. Auto-seed runs at API server startup before the server begins listening
```

**✅ Phase 2 Validation:**
- `GET /api/health` still responds OK
- Database has tables: run `psql $DATABASE_URL -c "\dt"` and confirm all 12 tables above exist
- Auto-seed runs on first boot: after restart, `SELECT COUNT(*) FROM resources` returns 32
- On second restart, seed is skipped (idempotent check works)
- `SELECT COUNT(*) FROM accounts` returns 8, `SELECT COUNT(*) FROM opportunities` returns 10

---

## Phase 3 — Auth Shell, Routing & Navigation

```
Build the authentication system and full application navigation for BUSINESSNow.

AUTH SYSTEM (no backend required — localStorage only):
- File: src/lib/auth.ts
- Stores selected user as JSON in localStorage key "businessnow_user"
- Shape: { id, name, role, title }
- Roles: "delivery_director" | "project_manager" | "consultant" | "resource_manager" |
          "account_manager" | "finance" | "admin"
- Hook: useAuth() returns { user, setUser, clearUser }
- Hook: useAuthRole() returns the current role string

LOGIN PAGE (/login):
- Fetches GET /api/resources to get the full 32-person roster
- Displays a scrollable grid of avatar cards — each showing initials, name, title
- Clicking a card sets them as the logged-in user (their role derived from their title)
- Title → Role mapping:
    "Delivery Director"      → delivery_director
    "Practice Lead"          → delivery_director
    "Project Manager"        → project_manager
    "Senior Consultant"      → consultant
    "Consultant"             → consultant
    "Analyst"                → consultant
    "Business Analyst"       → project_manager
    "Solution Architect"     → resource_manager
    "QA Lead"                → consultant
    "Integration Specialist" → consultant
    "Rate Management Specialist" → consultant
    (default) → consultant
- After selection, redirects to /

ROUTE GUARD:
- HOC: <Guard roles={[...]}> — redirects to /login if no user or wrong role
- If user is logged in but hits /login, redirect to /

APP SHELL (persistent layout after login):
Sidebar (240px, dark navy bg hsl(222,47%,11%), white text):
  Logo section: "BUSINESSNow" + subtitle "Delivery Command Center"
  
  Navigation sections with icons (Lucide):
  ── OVERVIEW
    Dashboard          → /  (LayoutDashboard icon)
  
  ── DELIVERY
    Projects           → /projects          (Folder icon)
    Milestones         → /milestones        (Flag icon)
    Tasks              → /tasks             (CheckSquare icon)
    Timesheets         → /timesheets        (Clock icon)
  
  ── RESOURCES
    Team               → /resources         (Users icon)
    Allocations        → /allocations       (Calendar icon)
    Capacity           → /capacity          (BarChart2 icon)
  
  ── CUSTOMERS
    Accounts           → /accounts          (Building2 icon)
    Opportunities      → /opportunities     (Handshake icon)
    Contracts          → /contracts         (FileText icon)
  
  ── FINANCE
    Finance            → /finance           (DollarSign icon)
    Invoices           → /invoices          (Receipt icon)
  
  ── PLATFORM
    Templates          → /templates         (Layout icon)
    Settings           → /settings/pmo      (Settings icon)
    Admin              → /admin             (Shield icon) — only for admin/delivery_director

  Bottom: User avatar card showing logged-in user name + role + "Sign out" button

Top bar:
  Left: current page title (derived from route)
  Right: notification bell with unread count badge, user avatar

ROUTES (router.tsx):
  /login          → LoginPage (no guard)
  /               → redirect based on role:
                    delivery_director/admin → /dashboard/admin
                    project_manager        → /dashboard/pm
                    resource_manager       → /resources
                    others                 → /timesheets
  /dashboard/pm   → PMDashboard
  /dashboard/admin → AdminDashboard
  /projects       → ProjectsList
  /projects/:id   → ProjectDetail
  /projects/:id/command → ProjectCommand
  /milestones     → MilestonesList
  /tasks          → TasksList
  /timesheets     → TimesheetsPage
  /resources      → ResourcesList
  /resources/:id  → ResourceDetail
  /allocations    → AllocationsPage
  /capacity       → CapacityPage
  /accounts       → AccountsList
  /accounts/:id   → AccountDetail
  /opportunities  → OpportunitiesPage
  /contracts      → ContractsPage
  /finance        → FinancePage
  /invoices       → InvoicesPage
  /templates      → TemplatesPage
  /admin          → AdminPage
  /settings/pmo   → PMOSettingsPage
  /* (404)        → NotFoundPage

All non-login routes have a guard. Stub all pages with a placeholder
"Page coming soon" component for now — they will be built in later phases.
```

**✅ Phase 3 Validation:**
- Navigating to `/businessnow` (or `/`) redirects to `/login`
- Login page shows a grid of all 32 employees fetched from the API
- Clicking an employee logs in and redirects to the correct dashboard
- Sidebar is visible on all post-login pages with all nav links
- Active nav link is highlighted
- "Sign out" clears localStorage and returns to /login
- All routes render without crashing (even if showing placeholder content)
- Notification bell shows in top bar

---

## Phase 4 — Resource Management Module

```
Build the full Team / Resource Management module at /resources.

The page has three tabs: "Utilization Heatmap" (default), "Resource Roster", "Staffing Risks"

─── API ENDPOINTS (Express) ───

GET /api/resources
  Returns all resources ordered by name.
  Each resource includes: id, name, title, practiceArea, employmentType,
  skills, certifications, specialties, utilizationTarget, currentUtilization,
  status, hourlyRate, location, timezone, isContractor, availableFrom, bio

GET /api/resources/utilization?weeks=12&granularity=week
  Returns a heatmap payload:
  {
    weeks: string[],  // ISO date strings for each week start
    resources: Array<{
      resource: Resource,
      weeks: Array<{ week: string, hard: number, soft: number, total: number, band: string }>,
      avgUtilization: number
    }>
  }
  band values: "bench" (0–19%), "available" (20–59%), "optimal" (60–89%),
               "booked" (90–110%), "overbooked" (>110%)
  Compute utilization by summing allocations for each resource+week.
  granularity=month aggregates weeks into calendar months.

GET /api/resources/:id
  Returns single resource with full details

POST /api/resources
  Creates a new resource. Required: name, practiceArea, employmentType.
  Optional: title, skills (array), location, hourlyRate, utilizationTarget,
  status, isContractor, bio

PUT /api/resources/:id
  Full update of a resource

─── FRONTEND COMPONENTS ───

UTILIZATION HEATMAP TAB:
- Sticky left column showing resource name + practice area
- Date columns across the top (week or month labels)
- Color-coded cells: bench=slate, available=emerald, optimal=blue, booked=amber, overbooked=red
- Each cell shows the hard allocation % or "—" if zero
- Legend at top explaining band colors
- Controls: Week/Month granularity toggle, Window selector (4w / 8w / 12w)
- "Allocate Range" button that expands an inline panel:
  Fields: Resource (select), Project (select, fetched from /api/projects),
          Start Date, End Date, Allocation %, Type (Hard/Soft)
  Submits to POST /api/allocations/fill-range

RESOURCE ROSTER TAB:
- Search box (filters by name, title, practice area, skills)
- Filter chips: All | On Bench | Overbooked | Contractors
- Results grouped by practice area with a collapsible section header
- Each resource row shows:
  - Colored initials avatar (red if overbooked, slate if bench, blue otherwise)
  - Name + employment type badge + warning icons
  - Title + location + top 3 skill tags
  - Utilization ring (SVG donut chart showing %) + hourly rate
  - Clicking a row navigates to /resources/:id

STAFFING RISKS TAB:
- 3 KPI tiles: Overbooked count (red), Near Capacity count (amber), On Bench count (slate)
- Risk list: each row shows severity icon, message, resource title + practice area, employment badge
  - High: utilization > 100%
  - Medium: utilization 90–100%
  - Low: utilization < 20%

ADD EMPLOYEE MODAL (triggered by "Add Employee" button in header):
Fields: Full Name (required), Job Title, Employment Type (Employee/Contractor/Partner),
        Status (Available/Allocated/On Bench/On Leave), Practice Area (all 10 areas),
        Location, Hourly Rate ($), Utilization Target (%), Skills (comma-separated),
        Bio/Notes
On submit: POST /api/resources, show toast, refresh roster

RESOURCE DETAIL PAGE (/resources/:id):
- Profile header: name, title, practice area, employment badge, location, bio
- Skills/certifications/specialties tag clouds
- Current project allocations table (from /api/allocations?resourceId=:id)
- Recent timesheet entries (from /api/timesheets?resourceId=:id)
- Utilization history mini-chart
```

**✅ Phase 4 Validation:**
- Navigate to /resources — heatmap loads and shows all 32 resources
- Colored cells appear correctly based on allocation percentages
- Switch to "Resource Roster" tab — see grouped cards with utilization rings
- Filter to "On Bench" — only shows resources with < 20% utilization
- Search for "OTM" in skills — filters results correctly
- Click "Add Employee", fill the form, submit — new person appears in roster
- Navigate to /resources/1 — profile page loads without error
- Switch between Week/Month granularity and 4w/8w/12w windows in heatmap

---

## Phase 5 — Project Management Module

```
Build the Projects and Project Detail pages.

─── API ENDPOINTS ───

GET /api/projects
  Returns all projects with: id, name, accountId, accountName, status, phase,
  startDate, endDate, budget, estimatedHours, billedHours, projectManagerId,
  completionPct, healthStatus, isFixedFee, billingRate, currency, description
  Supports query: ?status=active&accountId=

GET /api/projects/:id
  Full project including milestones, tasks summary, team, recent timesheets

GET /api/projects/:id/full
  Returns project + all milestones + all tasks + allocations (for project command view)

GET /api/projects/:id/revenue
  Returns: { totalBilled, totalBillable, budget, remainingBudget, billedHours, unbilledHours }
  Computed from timesheets for that project.

GET /api/projects/:id/margin-forecast
  Returns weekly margin data for recharts.
  { weeks: [{ week, planned, actual, cumulative }] }

GET /api/projects/:id/projection
  Returns: { projectedHours, burnRate, estimatedCompletion, budgetAtRisk: bool }

POST /api/projects
  Creates project. Required: name, accountId. Auto-sets accountName from accounts table.

PUT /api/projects/:id
  Updates project fields.

─── PROJECTS LIST PAGE (/projects) ───

Header with "New Project" button + filter controls
4 KPI cards: Active Projects, Total Budget, Avg Completion %, At-Risk count

Filter bar: Search by name/account | Status filter (active/on_hold/completed/cancelled) | Health filter

Projects table columns:
  Project Name (link to detail) | Account | Status badge | Health indicator |
  Phase | Start → End dates | Budget | Completion progress bar | PM name | Actions

Status badge colors:
  active=blue, on_hold=amber, completed=emerald, cancelled=red/muted

Health indicator: green circle / amber triangle / red warning based on healthStatus field

─── PROJECT DETAIL PAGE (/projects/:id) ───

Tabs: Overview | Milestones | Tasks | Team | Finance | Command

OVERVIEW TAB:
- Project header: name, account, status badge, health badge, description
- 4 KPI tiles: Budget Used %, Billed Hours, Completion %, Days Remaining
- Margin forecast area chart (Recharts AreaChart, weekly planned vs actual)
- Recent activity / latest timesheets list

MILESTONES TAB:
- Timeline view with milestone cards
- Each card: name, due date, status badge, description, deliverables, billable flag
- Status transitions: pending → in_progress → completed / at_risk
- "Add Milestone" inline form

TASKS TAB:
- Grouped by milestone (or "No Milestone")
- Each task row: name, assignee avatar, status badge, priority badge,
  estimated vs actual hours, due date, progress %
- Status filter chips: All | Not Started | In Progress | Completed | Blocked
- "Add Task" button opens inline form

TEAM TAB:
- Grid of resource cards showing who is allocated to the project
- Each card: name, role on project, allocation %, total hours logged

FINANCE TAB:
- Revenue vs Budget gauge
- Invoices table for this project
- Billable hours breakdown by resource

COMMAND TAB (project-scoped command center):
- Gantt-style timeline showing tasks on a horizontal date axis
- Status columns or swim-lanes
```

**✅ Phase 5 Validation:**
- /projects loads with all 9 seeded projects showing correct status badges
- KPI cards show real aggregated numbers (not hardcoded)
- Click a project → /projects/:id opens with all 5 tabs
- Overview tab shows margin forecast chart with data
- Milestones tab lists milestones for that project
- Tasks tab shows tasks with correct grouping
- Finance tab shows real revenue numbers from timesheet aggregation
- "New Project" opens a creation form; submitting creates a project and it appears in the list

---

## Phase 6 — Milestones, Tasks & Allocations

```
Build the standalone Milestones and Tasks pages plus the Allocations module.

─── MILESTONES PAGE (/milestones) ───

API:
  GET /api/milestones?projectId=&status=
  POST /api/milestones
  PATCH /api/milestones/:id
  DELETE /api/milestones/:id
  GET /api/milestones/:id/signoffs
  POST /api/milestones/:id/signoffs

Page layout:
- Filter bar: Project selector | Status filter | Date range
- Milestone cards in a vertical timeline layout
- Each card: project name chip, milestone name, due date (color-coded by urgency),
  status badge, description, deliverables list, billable flag + invoice amount
- Status badge colors: pending=slate, in_progress=blue, completed=emerald, at_risk=red
- Signoff section on at-risk/pending milestones: "Request Signoff" button
- Completion % progress bar

─── TASKS PAGE (/tasks) ───

API:
  GET /api/tasks?projectId=&status=&assigneeId=&milestoneId=
  POST /api/tasks
  PATCH /api/tasks/:id
  GET /api/task-dependencies
  POST /api/task-dependencies

Page layout:
- View toggle: List view | Board view (Kanban by status)
- Filter bar: Project | Assignee | Status | Priority | Search
- List view: table with columns: Task | Project | Assignee | Status | Priority |
  Est Hours | Actual Hours | Due Date | Progress
- Board view: Kanban columns: Not Started | In Progress | Review | Blocked | Completed
  Drag cards between columns using @dnd-kit. PATCH /api/tasks/:id on drop.
- "Add Task" button → dialog with: name, project (required), milestone, assignee,
  estimated hours, start date, due date, priority, description
- Task rows are clickable → inline edit panel slides in from right

─── ALLOCATIONS PAGE (/allocations) ───

API:
  GET /api/allocations?resourceId=&projectId=&weekStart=
  POST /api/allocations
  PUT /api/allocations/:id
  DELETE /api/allocations/:id
  POST /api/allocations/fill-range  → creates weekly allocations between startDate and endDate

Page layout:
- Header: Resource selector + Project selector + Week range picker
- Allocation grid: resources as rows, week columns across the top
- Each cell: allocation % (editable inline on click)
- Color coding: 0%=empty, 1-59%=emerald/light, 60-90%=blue, 91-110%=amber, >110%=red
- "New Allocation" form: Resource, Project, Week, %, Type (Hard/Soft)
- "Fill Range" form (bulk allocation): Resource, Project, Start, End, %, Type

─── CAPACITY PAGE (/capacity) ───

API:
  GET /api/resources/utilization?weeks=8 (reuse from Phase 4)

Page layout:
- Capacity heat map (same component as Phase 4 heatmap, but page-standalone)
- Bench summary: list of resources available for new work
- Upcoming availability: resources whose projects end within 30 days
```

**✅ Phase 6 Validation:**
- /milestones lists milestones across all projects with correct date coloring
- Filtering milestones by project or status works
- /tasks shows tasks in both list and board (Kanban) views
- Drag a task card in board view — status updates via PATCH and persists after refresh
- /allocations grid shows all resources vs weeks with color-coded cells
- Creating a fill-range allocation populates multiple week cells
- /capacity shows the heatmap and bench list

---

## Phase 7 — Customer Management Module

```
Build the full Accounts and Opportunities modules.

─── ACCOUNTS MODULE ───

API:
  GET /api/accounts?status=&segment=
  POST /api/accounts
  GET /api/accounts/:id  (includes related opportunities, projects, invoices)
  PUT /api/accounts/:id

ACCOUNTS LIST PAGE (/accounts):

4 KPI cards: Total Accounts, Total ACV ($), At Risk count, Avg Health Score

Filter bar: Search (name/industry/region) | Status filter | Segment filter | Clear button

Accounts table columns:
  Account Name (link to /accounts/:id) | Industry | Segment | Status badge |
  Health bar (0–100 score with color gradient) | Region | OTM Version (cloud/server icon) |
  Renewal Date (warning if < 60 days) | ACV ($)

Status badge colors:
  active=emerald, at_risk=red, prospect=violet, inactive=muted, churned=muted

Health bar: emerald if ≥80, amber if 65–79, red if <65

ADD ACCOUNT MODAL (triggered by "Add Account" button in header):
Fields: Account Name (required), Status, Segment, Industry (dropdown of 10 industries),
        Region, OTM Version, Annual Contract Value ($), Contract Renewal Date,
        Cloud Deployment (toggle switch)
Submit: POST /api/accounts, toast, refresh list

ACCOUNT DETAIL PAGE (/accounts/:id):
- Account header: name, industry, segment badge, status badge, health score
- 4 KPI tiles: ACV, Health Score, Active Projects, Open Opportunities
- Tabs: Overview | Projects | Opportunities | Invoices | Contacts
- Overview: account info cards + renewal date + OTM version + cloud deployment flag
- Projects tab: table of related projects with status + completion %
- Opportunities tab: list of opportunities for this account with stage badges
- Invoices tab: invoice list with status + amounts

─── OPPORTUNITIES MODULE ───

API:
  GET /api/opportunities?stage=&accountId=&type=&q=
  POST /api/opportunities
  GET /api/opportunities/:id
  PATCH /api/opportunities/:id (used for stage updates from Kanban drag)
  DELETE /api/opportunities/:id

OPPORTUNITIES PAGE (/opportunities):

View toggle: "List" (table) | "Kanban" (drag-and-drop board) — persists during session

4 KPI cards:
  Active Pipeline (sum of value for non-won/lost/parked stages)
  Weighted Value (pipeline × probability)
  Win Rate (won / (won + lost) × 100%)
  Total Opps (all time count)

LIST VIEW:
  Stage filter chips: All (n) | Lead (n) | Qualified (n) | ... — togglable
  Filter bar: Search | Type filter | Clear filters button | Result count
  Table columns: Opportunity | Account | Stage | Type | Value | Prob. bar |
                 Close Date | Owner | Complexity | →

  Stage badge colors:
    lead=slate, qualified=blue, discovery=violet, proposal=amber,
    negotiation=orange, won=emerald, lost=red, parked=muted

  Probability bar: mini progress bar colored by probability range

  Pipeline by Stage section below table: horizontal bar chart per stage showing total value

KANBAN VIEW:
  8 columns (one per stage) using @dnd-kit/core + @dnd-kit/utilities
  Each column:
    - Color-coded top border (matches stage color)
    - Stage label + card count badge + total stage value
    - Min height 480px, scrollable, has dashed "Empty" placeholder when no cards
    - Highlights (glow) when a card is dragged over it

  Opportunity cards show:
    - Drag handle icon (GripVertical) + opportunity name
    - Account name with building icon
    - Engagement type badge
    - Deal value (bold) + probability mini-bar
    - Close date + owner (if present)
    - Hover effect: card lifts slightly

  Drag behavior:
    - PointerSensor (desktop) + TouchSensor (mobile, 200ms delay)
    - DragOverlay renders a ghost card rotated 1° while dragging
    - On drop: optimistic UI update + PATCH /api/opportunities/:id with new stage
    - On API failure: revert and show error toast
    - On success: show "Moved to [Stage]" toast

ADD OPPORTUNITY MODAL (triggered by "Add Opportunity" button):
Fields:
  Opportunity Name (required), Account (select from /api/accounts, required),
  Stage (select, auto-fills probability), Engagement Type,
  Delivery Complexity (Low/Medium/High/Very High),
  Deal Value ($), Win Probability (%), Expected Close Date,
  Expected Start Date, Duration (weeks), Owner name (text),
  Summary/Notes (textarea)
Stage → probability defaults: lead=10, qualified=20, discovery=30, proposal=50,
  negotiation=70, won=100, lost=0, parked=0
Submit: POST /api/opportunities, toast, refresh list + KPI cards
```

**✅ Phase 7 Validation:**
- /accounts shows 8 accounts with correct health bars, ACV values, status badges
- Click an account → detail page with all tabs loading correctly
- "Add Account" modal opens, fill and submit → new account appears in list, count KPI updates
- /opportunities shows 10 seeded opportunities in list view with stage badges
- KPI cards show correct pipeline value and win rate
- Switch to Kanban view — 8 columns show with cards in correct stages
- Drag a card from "Lead" to "Proposal" — card moves, toast confirms, PATCH logged in API
- Refresh page — card stays in new stage (persisted to DB)
- "Add Opportunity" modal opens, account dropdown loads all 8 accounts
- Submit creates opportunity and it appears in both list and Kanban views

---

## Phase 8 — Time & Reporting Module

```
Build the Timesheets weekly grid — the primary time entry interface.

─── API ENDPOINTS ───

GET /api/timesheets?resourceId=&projectId=&startDate=&endDate=&status=
  Returns timesheet entries. Supports date range filtering.

POST /api/timesheets
  Creates a timesheet entry.
  Body: { resourceId, projectId, taskId, categoryId, entryDate, hours,
          isBillable, activityType, projectName, resourceName, notes }
  All ID fields accept string or number (coerce to string internally).

PATCH /api/timesheets/:id
  Update hours, notes, status of an entry.

DELETE /api/timesheets/:id

POST /api/timesheets/submit-day
  Marks all entries for a given (resourceId, date) as submitted.
  Body: { resourceId, entryDate }

GET /api/timesheets/missing
  Returns { missingDays: string[] } — ISO dates in the past 30 days
  with no timesheet entry for the current user.

GET /api/time-entry-categories
  Returns categories: id, name, isBillable, color

─── WEEKLY GRID PAGE (/timesheets) ───

Layout: full-height page with a sticky header and scrollable grid body.

Header controls:
  Left: "← Previous week" / "Next week →" navigation + current week label
  Right: Resource selector (for managers) + "Export" button

Grid structure:
  - Always shows the current user's allocated projects as rows
  - Rows = one per project (fetched from /api/projects?resourceId=currentUser)
  - Columns = Mon Tue Wed Thu Fri Sat Sun (7 day columns)
  - Today's column header highlighted with a blue circle around the date number

Each cell (project × day):
  - Shows hours logged (e.g. "8.0h") or dashed "+" if empty
  - Empty cells show a dashed border affordance — clicking opens an entry popover
  - Popover fields: Hours, Category (select from time-entry-categories),
    Activity Type, Billable toggle, Notes
  - Filled cells show the hours with color coding:
    green if ≤ 8h total for day, amber if 8–10h, red if > 10h
  - Cells are editable inline (click to edit existing entry)

Fixed rows at bottom of grid:
  "Day Total" row: sums all hours per day column. Red if > 8h, amber if = 8h, normal if < 8h
  "Submit" row: one submit button per day column.
    - Submit button is disabled if no entries for that day
    - Submit button shows "Submitted ✓" if all entries for that day are submitted
    - Clicking calls POST /api/timesheets/submit-day

Below grid:
  "Missing Days" alert banner — shows count of unsubmitted days in the past month
  with a link to jump to the correct week

ADD TASK ROW:
  At the bottom of the project rows, a dashed "+ Add task-specific row" link
  allows adding a row for a specific task within a project.

Data loading:
  On mount: fetch current week's timesheets for the logged-in resource
  On week navigation: re-fetch for the selected week
  Optimistic updates: entry appears immediately; API call runs in background
  On API failure: revert entry and show error toast
```

**✅ Phase 8 Validation:**
- /timesheets shows current week with all allocated projects as rows
- Today's date column header has a blue circle highlight
- Click an empty cell → popover opens with hours/category/notes fields
- Enter 8 hours → cell shows "8.0h" with green tint
- Enter 10 hours → Day Total row shows red warning
- Click "Submit" button for a day → button changes to "Submitted ✓", disabled
- Navigate to previous week with "← Previous week" button
- "Missing Days" banner appears if any past days have no entries

---

## Phase 9 — Finance, Admin & Supporting Pages

```
Build the Finance, Invoices, Admin dashboard, and remaining utility pages.

─── FINANCE PAGE (/finance) ───

API:
  GET /api/finance/summary
    Returns: { totalRevenue, totalCost, grossMargin, marginPct, billedHours,
               unbilledHours, outstandingInvoices, overdueInvoices,
               revenueByMonth: [{ month, revenue, cost, margin }] }

Page layout:
  6 KPI cards: Total Revenue | Total Cost | Gross Margin | Margin % | Billed Hours | Outstanding AR
  Revenue vs Cost area chart (Recharts, 12-month view)
  Margin % line chart
  Revenue by project breakdown table: project name, client, billed hours, revenue, margin %

─── INVOICES PAGE (/invoices) ───

API:
  GET /api/invoices?status=&accountId=&projectId=
  POST /api/invoices
  GET /api/invoices/:id
  PATCH /api/invoices/:id (update status: draft → sent → paid / overdue)
  DELETE /api/invoices/:id

Page layout:
  4 KPI cards: Total Outstanding, Overdue, Paid (30 days), Draft count
  Filter: Status tabs (All | Draft | Sent | Paid | Overdue)
  Invoices table: Invoice # | Project | Account | Issue Date | Due Date |
                  Amount | Status badge | Actions (View, Mark Paid)
  "New Invoice" button → dialog with project, account, line items, dates, amounts

─── ADMIN DASHBOARD (/admin, /dashboard/admin) ───

Sections:
  Platform health: API response time, DB connection status, active sessions
  User activity: last login per user, timesheet submission rates
  Data overview: counts of all entities (projects, resources, accounts, etc.)
  System metrics: projects by status pie chart, utilization histogram

─── PM DASHBOARD (/dashboard/pm) ───

Sections:
  My projects list with health status
  My tasks due this week
  Timesheet completion % this week
  Team utilization snapshot

─── CONTRACTS PAGE (/contracts) ───
  List of contracts linked to accounts/projects
  Columns: Contract name, Account, Type, Value, Start, End, Status
  Status filter: draft | active | expired | terminated

─── TEMPLATES PAGE (/templates) ───
  Project delivery templates (reusable project skeletons)
  List view with: name, phase count, task count, last used
  "Use Template" → creates a new project with pre-defined milestones/tasks

─── SETTINGS PAGE (/settings/pmo) ───
  PMO configuration: default billing rates, utilization thresholds,
  notification preferences, time entry categories management

─── NOT FOUND PAGE (/*) ───
  Friendly 404 with link back to dashboard

─── API: GET /api/notifications ───
  GET /api/notifications?userId=&isRead=
  PATCH /api/notifications/:id (mark read)
  GET /api/notifications/unread-count?userId=
  The API auto-generates notifications for:
    - Milestones due within 7 days (type: "milestone_due")
    - Resources overbooked > 110% (type: "overbooked")
    - Invoices overdue (type: "invoice_overdue")
  The top bar notification bell queries /api/notifications/unread-count every 30 seconds
  Clicking the bell opens a dropdown panel with the 10 most recent notifications
```

**✅ Phase 9 Validation:**
- /finance loads with real aggregated numbers from timesheets
- Revenue vs Cost chart renders with 12 months of data
- /invoices lists invoices with correct status badges
- Marking an invoice as paid updates status and removes from outstanding total
- /admin shows entity counts and system metrics
- /dashboard/admin and /dashboard/pm load with role-appropriate content
- Notification bell shows unread count; clicking shows notification dropdown
- /contracts, /templates, /settings/pmo all render without errors
- 404 page shows for unknown routes

---

## Phase 10 — Polish, Seed Data Enrichment & Full Validation

```
Enrich seed data and complete final polish for production readiness.

─── SEED DATA ENRICHMENT ───

Expand auto-seed.ts to include:
1. Milestones: 3–5 milestones per project, realistic names:
   "Requirements Sign-off", "Design Approved", "UAT Complete",
   "Go-Live", "Hypercare Complete"

2. Tasks: 5–10 tasks per project, assigned to resources,
   with varying statuses (mix of not_started, in_progress, completed)

3. Allocations: weekly allocations for each resource across their projects,
   covering the current rolling 8-week window. Mix of 50%, 80%, 100%.
   Include a few overbooked (>100%) entries to make risk alerts useful.

4. Timesheets: ~30 days of historical entries for 8–10 active consultants
   across their allocated projects. Mix of submitted and draft status.
   Use entry_date as ISO date strings.

5. Invoices: 2–3 invoices per project, mix of draft/sent/paid statuses.
   At least 2 overdue invoices for alert generation.

6. Notifications: auto-generate on first seed for overdue milestones and
   overbooked resources.

─── UI POLISH ───

Consistent empty states: every list/table has an illustration + helpful message
  when no data matches filters. Include a CTA button ("Add your first X").

Loading skeletons: all data-fetching states use shadcn Skeleton components,
  not spinners. Match the skeleton shape to the actual content.

Toast notifications: all create/update/delete actions show toasts:
  success=default, error=destructive variant.

Error boundaries: wrap each page in an error boundary that shows a
  friendly error card instead of a blank screen.

Form validation: all modals show inline field-level error messages on submit.
  Required fields marked with red asterisk (*).

Responsive layout: sidebar collapses to an icon rail on screens < 1024px.
  A hamburger button in the top bar toggles it.

Dark mode: Tailwind dark: variants applied throughout. System preference
  detected via prefers-color-scheme. Toggle in settings page.

─── PERFORMANCE ───
- React Query caching: staleTime=60s for reference data (resources, accounts, projects)
- Debounce search inputs by 300ms
- Large tables: only render visible rows (virtual list for >100 rows)

─── FINAL VALIDATION CHECKLIST ───

Walk through the full user journey for each role:

DELIVERY DIRECTOR login:
  [ ] /dashboard/admin loads with platform KPIs and charts
  [ ] Can view all projects, all resources, all accounts
  [ ] Add Account modal works end-to-end
  [ ] Add Opportunity modal works; new opp appears in Kanban immediately
  [ ] Kanban drag-and-drop persists stage changes after page refresh

PROJECT MANAGER login:
  [ ] /dashboard/pm shows their projects and tasks due this week
  [ ] /timesheets shows weekly grid; can log hours; submit day works
  [ ] /projects/:id shows all 5 tabs with real data
  [ ] Can add milestones and tasks to a project

CONSULTANT login:
  [ ] Redirected to /timesheets by default
  [ ] Can log time, navigate weeks, see missing days banner
  [ ] /resources shows their own roster card

ADMIN login:
  [ ] /admin page accessible; shows entity counts
  [ ] Can navigate to all sections without permission errors

CROSS-CUTTING:
  [ ] Notification bell updates count; marking a notification read works
  [ ] All 8 accounts visible in /accounts with correct ACV and health scores
  [ ] All 32 resources visible in /resources roster with utilization data
  [ ] All 10 opportunities visible in Kanban with cards in correct stage columns
  [ ] Finance page shows aggregated revenue data
  [ ] No console errors on any page
  [ ] API server shows no 500 errors in logs
  [ ] Page refresh on any route works correctly (no 404 on reload)
  [ ] Sign out clears all state and returns to /login
```

---

## Architecture Reference

### Directory Structure
```
/
├── artifacts/
│   ├── api-server/
│   │   ├── src/
│   │   │   ├── index.ts           # Express app entry
│   │   │   ├── routes/
│   │   │   │   ├── index.ts       # Router aggregator
│   │   │   │   ├── accounts.ts
│   │   │   │   ├── resources.ts
│   │   │   │   ├── projects.ts
│   │   │   │   ├── milestones.ts
│   │   │   │   ├── tasks.ts
│   │   │   │   ├── allocations.ts
│   │   │   │   ├── timesheets.ts
│   │   │   │   ├── invoices.ts
│   │   │   │   ├── opportunities.ts
│   │   │   │   ├── notifications.ts
│   │   │   │   ├── finance.ts
│   │   │   │   ├── dashboard.ts
│   │   │   │   └── admin.ts
│   │   │   └── lib/
│   │   │       └── auto-seed.ts
│   │   ├── package.json
│   │   └── build.mjs
│   │
│   └── businessnow/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── router.tsx
│       │   ├── index.css
│       │   ├── lib/
│       │   │   └── auth.ts
│       │   ├── components/
│       │   │   ├── layout/
│       │   │   │   ├── app-shell.tsx
│       │   │   │   ├── context-sidebar.tsx
│       │   │   │   └── top-bar.tsx
│       │   │   └── ui/           # shadcn/ui components
│       │   ├── pages/
│       │   │   ├── login.tsx
│       │   │   ├── dashboard/
│       │   │   ├── projects/
│       │   │   ├── resources/
│       │   │   ├── accounts/
│       │   │   ├── opportunities/
│       │   │   ├── timesheets/
│       │   │   ├── finance/
│       │   │   ├── invoices/
│       │   │   ├── milestones/
│       │   │   ├── tasks/
│       │   │   ├── allocations/
│       │   │   ├── capacity/
│       │   │   ├── contracts/
│       │   │   ├── templates/
│       │   │   ├── admin/
│       │   │   └── settings/
│       │   └── hooks/
│       │       └── use-toast.ts
│       ├── package.json
│       └── vite.config.ts
│
├── lib/
│   ├── db/
│   │   ├── index.ts              # Drizzle client
│   │   ├── schema.ts             # All table definitions
│   │   └── package.json
│   └── api-client-react/
│       └── package.json
│
├── package.json
└── pnpm-workspace.yaml
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Routing | Wouter | Lightweight, no React Router overhead |
| Auth | localStorage role-picker | Simple internal tool — no SSO needed |
| State | React Query + local useState | Server state via React Query, UI state local |
| Forms | Controlled inputs + Zod validation | No form library overhead |
| Charts | Recharts | Native React, good Tailwind compatibility |
| Drag & Drop | @dnd-kit/core | Accessible, pointer+touch support |
| DB ORM | Drizzle | Type-safe, minimal overhead, pairs well with Postgres.js |
| API validation | Zod schemas in routes | Consistent error messages, type inference |
| Styling | Tailwind v4 + shadcn/ui | Utility-first + pre-built accessible components |

### Important Implementation Notes

1. **API Base URL in frontend**: Always use  
   `const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api"`  
   Never hardcode `/api` — the `/businessnow` base path prefix must be preserved.

2. **Radix Select empty values**: Never use `value=""` on `<SelectItem>`.  
   Use sentinel value `"__none__"` and convert back to empty string in the onChange handler.

3. **Drizzle numeric fields**: PostgreSQL `numeric` columns come back as strings from Drizzle.  
   Always `parseFloat()` before arithmetic operations.

4. **Array fields (skills, certifications)**: PostgreSQL text[] columns require array literals in INSERT.  
   Drizzle handles this automatically — pass a JS string array directly.

5. **Optimistic updates**: For Kanban drag-and-drop, update React state immediately,  
   then fire the PATCH. On failure, call `fetchOpps()` to revert to server state.

6. **Auto-seed idempotency**: Check `SELECT COUNT(*) FROM resources` before seeding.  
   If count > 0, skip entirely. Never use TRUNCATE in seed scripts.
```

---

*Generated from BUSINESSNow Delivery Command Center — production build*  
*Stack: React 19 + Vite 7 + Express 5 + Drizzle ORM + PostgreSQL*
