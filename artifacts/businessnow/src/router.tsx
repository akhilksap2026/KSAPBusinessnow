import React from "react";
import { Switch, Route, Redirect } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/access-denied";
import { useAuthRole, ROUTE_ROLES } from "@/lib/auth";
import type { Role } from "@/lib/auth";

// Auth
import Login from "@/pages/login";

// Dashboards
import SalesDashboard from "@/pages/dashboard/sales";
import PMDashboard from "@/pages/dashboard/pm";
import AMDashboard from "@/pages/dashboard/am";
import AdminDashboard from "@/pages/dashboard/admin";

// Lists
import ProjectsList from "@/pages/projects/index";
import AccountsList from "@/pages/accounts/index";
import ResourcesList from "@/pages/resources/index";
import TimesheetsList from "@/pages/timesheets/index";
import InvoicesList from "@/pages/invoices/index";
import OpportunitiesList from "@/pages/opportunities/index";
import MilestonesList from "@/pages/milestones/index";
import TasksPage from "@/pages/tasks/index";

// Details
import ProjectDetail from "@/pages/projects/detail";
import ProjectCommand from "@/pages/projects/command";
import AccountDetail from "@/pages/accounts/detail";
import ResourceDetail from "@/pages/resources/detail";

// Pipeline
import OpportunityDetail from "@/pages/opportunities/detail";
import HandoffPage from "@/pages/handoff/index";

// Resource Command
import AllocationsPage from "@/pages/allocations/index";
import CapacityPage from "@/pages/capacity/index";

// Finance Command
import FinancePage from "@/pages/finance/index";
import ContractsPage from "@/pages/contracts/index";
import ChangesPage from "@/pages/changes/index";

// Client Portal
import ClientPortal from "@/pages/clients/portal";

// Templates
import TemplatesPage from "@/pages/templates/index";

// Phase 5 — Intelligence, Automations, Closure, Handover, Admin
import PortfolioPage from "@/pages/portfolio/index";
import AutomationsPage from "@/pages/automations/index";
import ClosurePage from "@/pages/projects/closure";
import HandoverPage from "@/pages/handover/index";
import AdminPage from "@/pages/admin/index";
import StaffingRequestsPage from "@/pages/staffing-requests/index";
import PMOSettingsPage from "@/pages/settings/pmo";

// ─── DashboardRedirect — role-appropriate home landing ───────────────────────

function DashboardRedirect() {
  const { role } = useAuthRole();
  if (!role) return <Redirect to="/login" />;
  switch (role) {
    case "executive":          return <Redirect to="/portfolio" />;
    case "delivery_director":  return <Redirect to="/portfolio" />;
    case "project_manager":    return <Redirect to="/dashboard/pm" />;
    case "resource_manager":   return <Redirect to="/resources" />;
    case "finance_lead":       return <Redirect to="/finance" />;
    case "sales":              return <Redirect to="/dashboard/sales" />;
    case "account_manager":    return <Redirect to="/dashboard/am" />;
    case "client_stakeholder": return <Redirect to="/portal" />;
    case "admin":              return <Redirect to="/dashboard/admin" />;
    case "consultant":         return <Redirect to="/dashboard/pm" />;
    default:                   return <Redirect to="/dashboard/pm" />;
  }
}

// ─── Guard — auth + role check + client-stakeholder containment ──────────────
//
//  roles  (optional)  — if omitted, any authenticated role is allowed.
//  Client stakeholders are always redirected to /portal unless "client_stakeholder"
//  is explicitly in the roles array.

function Guard({ children, roles }: { children: React.ReactNode; roles?: readonly Role[] }) {
  const { role } = useAuthRole();

  // 1. Not logged in
  if (!role) return <Redirect to="/login" />;

  // 2. Client stakeholder containment — they only see /portal
  if (role === "client_stakeholder" && (!roles || !roles.includes("client_stakeholder"))) {
    return <Redirect to="/portal" />;
  }

  // 3. Role not in allowlist
  if (roles && !roles.includes(role)) {
    return <AppLayout><AccessDenied allowedRoles={roles} /></AppLayout>;
  }

  return <AppLayout>{children}</AppLayout>;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export function AppRouter() {
  const { role } = useAuthRole();

  return (
    <Switch>
      <Route path="/login" component={Login} />

      <Route path="/">
        {role ? <AppLayout><DashboardRedirect /></AppLayout> : <Redirect to="/login" />}
      </Route>

      {/* ── Dashboards (role-specific) ─────────────────────────────────── */}
      <Route path="/dashboard/sales">
        <Guard roles={ROUTE_ROLES["/dashboard/sales"]}><SalesDashboard /></Guard>
      </Route>
      <Route path="/dashboard/pm">
        <Guard roles={ROUTE_ROLES["/dashboard/pm"]}><PMDashboard /></Guard>
      </Route>
      <Route path="/dashboard/am">
        <Guard roles={ROUTE_ROLES["/dashboard/am"]}><AMDashboard /></Guard>
      </Route>
      <Route path="/dashboard/admin">
        <Guard roles={ROUTE_ROLES["/dashboard/admin"]}><AdminDashboard /></Guard>
      </Route>

      {/* ── Delivery (open to all internal roles) ──────────────────────── */}
      <Route path="/projects"><Guard><ProjectsList /></Guard></Route>
      <Route path="/milestones"><Guard><MilestonesList /></Guard></Route>
      <Route path="/tasks"><Guard><TasksPage /></Guard></Route>
      <Route path="/timesheets"><Guard><TimesheetsList /></Guard></Route>

      {/* ── Resource Command ───────────────────────────────────────────── */}
      <Route path="/resources">
        <Guard roles={ROUTE_ROLES["/resources"]}><ResourcesList /></Guard>
      </Route>
      <Route path="/allocations">
        <Guard roles={ROUTE_ROLES["/allocations"]}><AllocationsPage /></Guard>
      </Route>
      <Route path="/capacity">
        <Guard roles={ROUTE_ROLES["/capacity"]}><CapacityPage /></Guard>
      </Route>
      <Route path="/staffing-requests">
        <Guard roles={ROUTE_ROLES["/staffing-requests"]}><StaffingRequestsPage /></Guard>
      </Route>

      {/* ── Finance Command ────────────────────────────────────────────── */}
      <Route path="/finance">
        <Guard roles={ROUTE_ROLES["/finance"]}><FinancePage /></Guard>
      </Route>
      <Route path="/contracts">
        <Guard roles={ROUTE_ROLES["/contracts"]}><ContractsPage /></Guard>
      </Route>
      <Route path="/changes">
        <Guard roles={ROUTE_ROLES["/changes"]}><ChangesPage /></Guard>
      </Route>

      {/* ── Commercial ─────────────────────────────────────────────────── */}
      <Route path="/invoices">
        <Guard roles={ROUTE_ROLES["/invoices"]}><InvoicesList /></Guard>
      </Route>
      <Route path="/opportunities"><Guard><OpportunitiesList /></Guard></Route>
      <Route path="/accounts"><Guard><AccountsList /></Guard></Route>

      {/* ── Templates ──────────────────────────────────────────────────── */}
      <Route path="/templates">
        <Guard roles={ROUTE_ROLES["/templates"]}><TemplatesPage /></Guard>
      </Route>

      {/* ── Intelligence ───────────────────────────────────────────────── */}
      <Route path="/portfolio/director">
        <Redirect to="/portfolio" />
      </Route>
      <Route path="/portfolio">
        <Guard roles={ROUTE_ROLES["/portfolio"]}><PortfolioPage /></Guard>
      </Route>

      {/* ── Operations ─────────────────────────────────────────────────── */}
      <Route path="/automations">
        <Guard roles={ROUTE_ROLES["/automations"]}><AutomationsPage /></Guard>
      </Route>
      <Route path="/admin">
        <Guard roles={ROUTE_ROLES["/admin"]}><AdminPage /></Guard>
      </Route>
      <Route path="/settings/pmo">
        <Guard roles={["admin", "delivery_director", "project_manager"]}><PMOSettingsPage /></Guard>
      </Route>

      {/* ── Client Portal (client_stakeholder only) ────────────────────── */}
      <Route path="/portal">
        {role ? <ClientPortal /> : <Redirect to="/login" />}
      </Route>
      <Route path="/clients/:id/portal">
        {role ? <ClientPortal /> : <Redirect to="/login" />}
      </Route>

      {/* ── Project sub-routes (before /projects/:id) ──────────────────── */}
      <Route path="/projects/:id/command">
        {role ? <AppLayout><ProjectCommand /></AppLayout> : <Redirect to="/login" />}
      </Route>
      <Route path="/projects/:id/close">
        <Guard><ClosurePage /></Guard>
      </Route>
      <Route path="/handover/:id">
        <Guard><HandoverPage /></Guard>
      </Route>

      {/* ── Sales Handoff (before /opportunities/:id) ──────────────────── */}
      <Route path="/handoff/:opportunityId">
        <Guard><HandoffPage /></Guard>
      </Route>

      {/* ── Detail pages ───────────────────────────────────────────────── */}
      <Route path="/projects/:id"><Guard><ProjectDetail /></Guard></Route>
      <Route path="/accounts/:id"><Guard><AccountDetail /></Guard></Route>
      <Route path="/resources/:id">
        <Guard roles={ROUTE_ROLES["/resources/:id"]}><ResourceDetail /></Guard>
      </Route>

      {/* ── Pipeline ───────────────────────────────────────────────────── */}
      <Route path="/opportunities/:id"><Guard><OpportunityDetail /></Guard></Route>

      {/* ── Catch-all ──────────────────────────────────────────────────── */}
      <Route path="/:rest*">
        {role
          ? <AppLayout><div className="p-8 text-center text-muted-foreground">Page not found</div></AppLayout>
          : <Redirect to="/login" />
        }
      </Route>
    </Switch>
  );
}
