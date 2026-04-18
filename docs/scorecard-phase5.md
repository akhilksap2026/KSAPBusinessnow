# BUSINESSNow — PSA Scorecard Phase 5
**Date:** 2026-04-18  
**Assessor:** QA Hardening Pass  
**Legend:** 0 = Not implemented · 1 = Partial · 2 = Fully working

| Req ID | Description | Score | Notes |
|--------|-------------|-------|-------|
| G-01 | Multi-role RBAC (partner, director, PM, consultant, finance, client) | 2 | 11 roles enforced via X-User-Role header + field-access middleware stripping sensitive fields per role |
| G-02 | Single-page app navigation with route guards per role | 2 | `<Guard>` component in router.tsx enforces ROUTE_ROLES; redirects to /login if no role |
| G-03 | Dark-mode first design with Tailwind | 2 | All pages use dark theme; CSS variables in index.css |
| G-04 | Responsive layout (desktop-first) | 2 | All layouts use grid/flex with md: breakpoints |
| G-05 | Global search across projects, resources, tasks | 2 | `/api/search?q=` endpoint; SearchPage component |
| G-06 | Audit log / activity feed | 2 | activity_logs table + notifications system |
| G-07 | Error boundaries on all pages | 2 | ErrorBoundary class component wraps all routes in router.tsx |
| G-08 | Saved filters per page | 2 | saved_filters table + API; UI in projects/resources pages |
| G-09 | Rate limiting on API endpoints | 2 | express-rate-limit: 500 req/15min global, 200 write/15min (P5-T5) |
| G-10 | Production logger (no console.log in production paths) | 2 | pino logger; console.log replaced with logger.info in all non-test code |
| G-11 | Feature flags (CRM, automations, forms) | 2 | ENABLE_CRM_MODULES env var; automations/forms gated |
| P0-01 | Project CRUD with status lifecycle | 2 | Full CRUD on /api/projects; status: planning→active→at_risk→completed |
| P0-02 | Milestone tracking with health indicators | 2 | milestones table; overdue detection; red/amber/green status |
| P0-03 | Task management with dependencies and Gantt view | 2 | tasks + task_dependencies; Gantt tab in project detail |
| P0-04 | Resource allocation with utilisation heatmap | 2 | allocations + capacity page with color-coded heatmap |
| P0-05 | Timesheet entry and approval workflow | 2 | Timesheet grid + approval page; draft→submitted→approved/rejected |
| P0-06 | Invoice generation (T&M) with line items | 2 | BIL-02: generateTMLines(); apply-tm-lines endpoint; T&M preview slide-over |
| P1-01 | Project baseline snapshot and variance tracking | 2 | project_baselines table; GET /api/projects/:id/baseline |
| P1-02 | Change request management with CRB workflow | 2 | change_requests table; status lifecycle; linked to projects |
| P1-03 | Contract lifecycle management | 2 | contracts table; status: draft→active→expired |
| P1-04 | FX rate management for multi-currency billing | 2 | fx_rates table; margin analysis uses FX conversion |
| P1-05 | Resource staffing requests | 2 | staffing_requests table; UI in Resources → Staffing |
| P1-06 | Capacity forecasting by week/role | 2 | /api/capacity endpoint; weekly heatmap grid |
| P1-07 | Project templates with task scaffolding | 2 | templates + template_tasks tables; apply to new projects |
| P1-08 | Portfolio view (all projects KPIs) | 2 | PortfolioPage; executive/director role access |
| P1-09 | Earned value / revenue recognition | 2 | /api/finance/revenue endpoint; earned vs. billed cards |
| P1-10 | Milestone sign-off (client approval) | 2 | milestone_signoffs table; /api/milestones/:id/signoff endpoint |
| P2-T01 | Account health scoring | 2 | account_health table; computed score from KPIs |
| P2-T02 | Opportunity pipeline CRM | 2 | opportunities table; stage kanban |
| P2-T03 | Prospect tracking (CRM lite) | 2 | prospects table; ENABLE_CRM_MODULES feature flag |
| P2-T04 | Automated notifications (email/in-app) | 2 | automations table; notifications table; event hooks |
| P2-T05 | Client portal (read-only project view) | 2 | /portal route; external role access only |
| P2-T06 | Closure checklist | 2 | closure_checklists table; project close workflow |
| P2-T07 | Timesheet collaboration (WHO HELPED) | 2 | TIME-06: time_entry_collaborators table; informational-only flag |
| P2-T08 | Timesheet category tagging | 2 | time_entry_categories table; category select in entry modal |
| P2-T09 | Timesheet approval delegation | 2 | approval_delegations table; /api/delegations endpoints |
| P2-T10 | Resource detail with allocation history | 2 | ResourceDetail page; allocation timeline |
| P2-T11 | Project command center (Kanban + stats) | 2 | ProjectCommand page at /projects/:id/command |
| P2-T12 | Gantt chart with dependency arrows | 2 | GanttTab in project detail; dependency lines rendered |
| P2-T13 | Project baseline vs actual Gantt overlay | 2 | BaselineTab in project detail |
| P2-T14 | Milestone comments | 2 | milestone_comments table + UI |
| P2-T15 | Task comments | 2 | task_comments table + UI |
| P2-T16 | Saved filter presets | 2 | saved_filters table; filter UI in list pages |
| P2-T17 | Admin configuration panel | 2 | AdminPage; user management; system settings |
| P2-T18 | PMO settings (FX rates, categories, templates) | 2 | PMOSettingsPage; FX rates UI; time entry category mgmt |
| BIL-01 | Rate card management with role-level rates | 2 | rate_cards table; CRUD UI; field-access strips costRate for unauthorized roles |
| BIL-02 | T&M invoice line-item generation | 2 | generateTMLines(); 3-tier waterfall (project→account→global); apply-tm-lines endpoint |
| BIL-03 | Project-level rate card override | 2 | REQ-18: copy-to-project endpoint; override badge in Finance tab; waterfall resolution |
| TIME-06 | "Who Helped" collaborator tagging | 2 | time_entry_collaborators; informational-only; batch fetch for approval view |

**Summary:** 48 / 48 requirements scored ≥ 1. Zero requirements at 0. **Release blocker count: 0.**
