import React from "react";
import { Switch, Route, Redirect } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/access-denied";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { useAuthRole, ROUTE_ROLES } from "@/lib/auth";
import type { Role } from "@/lib/auth";

// Auth
import Login from "@/pages/login";

// Dashboards
import PMDashboard from "@/pages/dashboard/pm";
import AdminDashboard from "@/pages/dashboard/admin";

// Lists
import ProjectsList from "@/pages/projects/index";
import AccountsList from "@/pages/accounts/index";
import ResourcesList from "@/pages/resources/index";
import TimesheetsList from "@/pages/timesheets/index";
import TimesheetApprovalPage from "@/pages/timesheets/approval";
import InvoicesList from "@/pages/invoices/index";
import MilestonesList from "@/pages/milestones/index";
import TasksPage from "@/pages/tasks/index";

// Details
import ProjectDetail from "@/pages/projects/detail";
import ProjectCommand from "@/pages/projects/command";
import AccountDetail from "@/pages/accounts/detail";
import ResourceDetail from "@/pages/resources/detail";

// Resource Command
import AllocationsPage from "@/pages/allocations/index";
import CapacityPage from "@/pages/capacity/index";

// Finance Command
import FinancePage from "@/pages/finance/index";
import ContractsPage from "@/pages/contracts/index";
import ChangesPage from "@/pages/changes/index";

// Opportunities
import OpportunitiesPage from "@/pages/opportunities/index";

import ProspectsPage from "@/pages/prospects/index";
import ProspectDetail from "@/pages/prospects/detail";
import RateCardsPage from "@/pages/rate-cards/index";

// Templates
import TemplatesPage from "@/pages/templates/index";

// Portfolio & Admin
import PortfolioPage from "@/pages/portfolio/index";
import AdminPage from "@/pages/admin/index";
import PMOSettingsPage from "@/pages/settings/pmo";

// Portal
import PortalPage from "@/pages/portal/index";

// ─── DashboardRedirect — role-appropriate home landing ───────────────────────

function DashboardRedirect() {
  const { role } = useAuthRole();
  if (!role) return <Redirect to="/login" />;
  switch (role) {
    case "external":           return <Redirect to="/portal" />;
    case "executive":          return <Redirect to="/portfolio" />;
    case "delivery_director":  return <Redirect to="/portfolio" />;
    case "project_manager":    return <Redirect to="/dashboard/pm" />;
    case "resource_manager":   return <Redirect to="/resources" />;
    case "finance_lead":       return <Redirect to="/finance" />;
    case "sales":              return <Redirect to="/customers" />;
    case "account_manager":    return <Redirect to="/customers" />;
    case "client_stakeholder": return <Redirect to="/projects" />;
    case "admin":              return <Redirect to="/dashboard/admin" />;
    case "consultant":         return <Redirect to="/timesheets" />;
    default:                   return <Redirect to="/dashboard/pm" />;
  }
}

// ─── Guard — auth + role check ────────────────────────────────────────────────

function Guard({ children, roles }: { children: React.ReactNode; roles?: readonly Role[] }) {
  const { role } = useAuthRole();

  if (!role) return <Redirect to="/login" />;

  if (roles && !roles.includes(role)) {
    return <AppLayout><AccessDenied allowedRoles={roles} /></AppLayout>;
  }

  return <AppLayout><ErrorBoundary>{children}</ErrorBoundary></AppLayout>;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export function AppRouter() {
  const { role } = useAuthRole();

  return (
    <Switch>
      <Route path="/login" component={Login} />

      {/* ── External Portal ─────────────────────────────────────────────── */}
      <Route path="/portal">
        {role === "external"
          ? <ErrorBoundary><PortalPage /></ErrorBoundary>
          : role
            ? <Redirect to="/" />
            : <Redirect to="/login" />
        }
      </Route>

      <Route path="/">
        {role ? <AppLayout><DashboardRedirect /></AppLayout> : <Redirect to="/login" />}
      </Route>

      {/* ── Dashboards (role-specific) ─────────────────────────────────── */}
      <Route path="/dashboard/pm">
        <Guard roles={ROUTE_ROLES["/dashboard/pm"]}><PMDashboard /></Guard>
      </Route>
      <Route path="/dashboard/admin">
        <Guard roles={ROUTE_ROLES["/dashboard/admin"]}><AdminDashboard /></Guard>
      </Route>

      {/* ── Delivery (open to all internal roles) ──────────────────────── */}
      <Route path="/projects"><Guard><ProjectsList /></Guard></Route>
      <Route path="/milestones"><Guard><MilestonesList /></Guard></Route>
      <Route path="/tasks"><Guard><TasksPage /></Guard></Route>
      <Route path="/timesheets"><Guard><TimesheetsList /></Guard></Route>
      <Route path="/timesheets/approval">
        <Guard roles={["admin", "delivery_director", "project_manager"] as Role[]}><TimesheetApprovalPage /></Guard>
      </Route>

      {/* ── Customer Management ────────────────────────────────────────── */}
      <Route path="/customers"><Guard><AccountsList /></Guard></Route>
      <Route path="/accounts"><Redirect to="/customers" /></Route>
      <Route path="/prospects"><Guard><ProspectsPage /></Guard></Route>
      <Route path="/opportunities"><Guard><OpportunitiesPage /></Guard></Route>

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
      <Route path="/rate-cards"><Guard><RateCardsPage /></Guard></Route>

      {/* ── Templates ──────────────────────────────────────────────────── */}
      <Route path="/templates">
        <Guard roles={ROUTE_ROLES["/templates"]}><TemplatesPage /></Guard>
      </Route>

      {/* ── Intelligence ───────────────────────────────────────────────── */}
      <Route path="/portfolio/director"><Redirect to="/portfolio" /></Route>
      <Route path="/portfolio">
        <Guard roles={ROUTE_ROLES["/portfolio"]}><PortfolioPage /></Guard>
      </Route>

      {/* ── Operations ─────────────────────────────────────────────────── */}
      <Route path="/admin">
        <Guard roles={ROUTE_ROLES["/admin"]}><AdminPage /></Guard>
      </Route>
      <Route path="/settings/pmo">
        <Guard roles={["admin", "delivery_director", "project_manager"] as Role[]}><PMOSettingsPage /></Guard>
      </Route>

      {/* ── Project sub-routes (before /projects/:id) ──────────────────── */}
      <Route path="/projects/:id/command">
        {role ? <AppLayout><ErrorBoundary><ProjectCommand /></ErrorBoundary></AppLayout> : <Redirect to="/login" />}
      </Route>

      {/* ── Detail pages ───────────────────────────────────────────────── */}
      <Route path="/projects/:id"><Guard><ProjectDetail /></Guard></Route>
      <Route path="/customers/:id"><Guard><AccountDetail /></Guard></Route>
      <Route path="/accounts/:id"><Redirect to="/customers" /></Route>
      <Route path="/prospects/:id">
        <Guard roles={["account_manager", "delivery_director", "admin"] as Role[]}><ProspectDetail /></Guard>
      </Route>
      <Route path="/resources/:id">
        <Guard roles={ROUTE_ROLES["/resources/:id"]}><ResourceDetail /></Guard>
      </Route>

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
