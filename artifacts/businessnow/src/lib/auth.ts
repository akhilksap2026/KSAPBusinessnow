import { useState, useEffect } from "react";

export const ROLES = [
  "admin",
  "executive",
  "delivery_director",
  "project_manager",
  "consultant",
  "resource_manager",
  "finance_lead",
  "sales",
  "account_manager",
  "client_stakeholder",
  "external",
] as const;

export type Role = typeof ROLES[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin:              "System Admin",
  executive:          "Partner / Executive",
  delivery_director:  "Delivery Director",
  project_manager:    "Project Manager",
  consultant:         "Consultant",
  resource_manager:   "Resource Manager",
  finance_lead:       "Finance Manager",
  sales:              "Business Development",
  account_manager:    "Account Manager",
  client_stakeholder: "Client Contact",
  external:           "External User",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin:              "System configuration, audit log, data health",
  executive:          "Portfolio KPIs, revenue, project health",
  delivery_director:  "Project escalations, overdue milestones, team capacity",
  project_manager:    "Active projects, tasks, milestones, timesheets",
  consultant:         "Log time, view assigned projects, update task status",
  resource_manager:   "Staffing, utilization, capacity forecasting",
  finance_lead:       "Invoices, contracts, finance, change orders",
  sales:              "Customer accounts and project overview",
  account_manager:    "Customer accounts and project overview",
  client_stakeholder: "View assigned projects and milestone status",
  external:           "Limited access for external collaborators",
};

export interface DemoUser {
  id: string;
  name: string;
  title: string;
  role: Role;                   // Primary / current active role
  availableRoles: Role[];       // All roles the user can switch between
  initials: string;
  resourceId?: number;
}

export const DEMO_USERS: DemoUser[] = [
  // ── Admin (1) ───────────────────────────────────────────────────────────
  {
    id: "rachel.nguyen", name: "Rachel Nguyen", title: "System Administrator",
    role: "admin", availableRoles: ["admin", "consultant"],
    initials: "RN",
  },

  // ── Executive (1) ───────────────────────────────────────────────────────
  {
    id: "james.whitfield", name: "James Whitfield", title: "Managing Partner",
    role: "executive", availableRoles: ["executive", "consultant"],
    initials: "JW",
  },

  // ── Delivery Director (1) ───────────────────────────────────────────────
  {
    id: "jana.kovac", name: "Jana Kovac", title: "VP of Delivery",
    role: "delivery_director", availableRoles: ["delivery_director", "project_manager", "consultant"],
    initials: "JK", resourceId: 2,
  },

  // ── Project Manager (3) ─────────────────────────────────────────────────
  {
    id: "alex.okafor", name: "Alex Okafor", title: "Principal Project Manager",
    role: "project_manager", availableRoles: ["project_manager", "consultant"],
    initials: "AO", resourceId: 1,
  },
  {
    id: "priya.mehta", name: "Priya Mehta", title: "Senior Project Manager",
    role: "project_manager", availableRoles: ["project_manager", "consultant"],
    initials: "PM",
  },
  {
    id: "tom.kirkland", name: "Tom Kirkland", title: "Project Manager",
    role: "project_manager", availableRoles: ["project_manager", "consultant"],
    initials: "TK",
  },

  // ── Consultant (3) ──────────────────────────────────────────────────────
  {
    id: "derek.tran", name: "Derek Tran", title: "QA Lead",
    role: "consultant", availableRoles: ["consultant"],
    initials: "DT", resourceId: 3,
  },
  {
    id: "aisha.johnson", name: "Aisha Johnson", title: "Senior OTM Developer",
    role: "consultant", availableRoles: ["consultant"],
    initials: "AJ", resourceId: 8,
  },
  {
    id: "kevin.hart", name: "Kevin Hart", title: "Data Migration Specialist",
    role: "consultant", availableRoles: ["consultant"],
    initials: "KH", resourceId: 5,
  },

  // ── Resource Manager (2) ────────────────────────────────────────────────
  {
    id: "maria.santos", name: "Maria Santos", title: "Resource Manager",
    role: "resource_manager", availableRoles: ["resource_manager", "consultant"],
    initials: "MS", resourceId: 4,
  },
  {
    id: "ben.patterson", name: "Ben Patterson", title: "Staffing Coordinator",
    role: "resource_manager", availableRoles: ["resource_manager", "consultant"],
    initials: "BP",
  },

  // ── Finance Manager (2) ─────────────────────────────────────────────────
  {
    id: "sandra.liu", name: "Sandra Liu", title: "Finance Director",
    role: "finance_lead", availableRoles: ["finance_lead", "consultant"],
    initials: "SL",
  },
  {
    id: "brendan.walsh", name: "Brendan Walsh", title: "Finance Analyst",
    role: "finance_lead", availableRoles: ["finance_lead", "consultant"],
    initials: "BW", resourceId: 9,
  },

  // ── Business Development (2) ────────────────────────────────────────────
  {
    id: "diana.flores", name: "Diana Flores", title: "Business Development Manager",
    role: "sales", availableRoles: ["sales", "consultant"],
    initials: "DF", resourceId: 10,
  },
  {
    id: "chris.morgan", name: "Chris Morgan", title: "Senior Account Executive",
    role: "sales", availableRoles: ["sales", "consultant"],
    initials: "CM",
  },

  // ── Account Manager (2) ─────────────────────────────────────────────────
  {
    id: "yuki.tanaka", name: "Yuki Tanaka", title: "Senior Account Manager",
    role: "account_manager", availableRoles: ["account_manager", "consultant"],
    initials: "YT", resourceId: 6,
  },
  {
    id: "carlos.rivera", name: "Carlos Rivera", title: "Account Manager",
    role: "account_manager", availableRoles: ["account_manager", "consultant"],
    initials: "CR", resourceId: 7,
  },

  // ── Client Stakeholder (2) ──────────────────────────────────────────────
  {
    id: "robert.chen", name: "Robert Chen", title: "IT Director",
    role: "client_stakeholder", availableRoles: ["client_stakeholder"],
    initials: "RC",
  },
  {
    id: "angela.torres", name: "Angela Torres", title: "Supply Chain VP",
    role: "client_stakeholder", availableRoles: ["client_stakeholder"],
    initials: "AT",
  },
];

// Demo resource mapping — IDs match the auto-seed insertion order (1-indexed).
// Seed order: [0]=Rachel(id 1), [1]=Jana(id 2), [2]=Sandra(id 3), [3]=Ben(id 4),
// [4]=Maria(id 5), [5]=Alex(id 6), [6]=Priya(id 7), [7]=Tom(id 8),
// [8]=Derek Tran(id 9), [9]=Aisha(id 10), ... [18]=Kevin Hart(id 19)
export const ROLE_DEMO_RESOURCE: Partial<Record<Role, { id: number; name: string }>> = {
  admin:             { id: 1,  name: "Rachel Nguyen" },
  delivery_director: { id: 2,  name: "Jana Kovac" },
  project_manager:   { id: 6,  name: "Alex Okafor" },
  consultant:        { id: 9,  name: "Derek Tran" },
  resource_manager:  { id: 5,  name: "Maria Santos" },
};

// ─── Permission Map ──────────────────────────────────────────────────────────

export const PERMISSIONS = {
  // Projects
  createProject:            ["admin","delivery_director","project_manager"],
  editProject:              ["admin","delivery_director","project_manager"],
  deleteProject:            ["admin"],
  changeProjectStatus:      ["admin","delivery_director","project_manager"],
  viewProjectFinancials:    ["admin","executive","delivery_director","finance_lead","project_manager"],
  // Milestones
  createMilestone:          ["admin","delivery_director","project_manager"],
  completeMilestone:        ["admin","delivery_director","project_manager"],
  viewMilestoneBilling:     ["admin","finance_lead","executive","project_manager"],
  // Tasks
  createTask:               ["admin","delivery_director","project_manager"],
  assignTask:               ["admin","delivery_director","project_manager"],
  updateAnyTaskStatus:      ["admin","delivery_director","project_manager"],
  // Timesheets
  logTime:                  ["admin","delivery_director","project_manager","consultant","resource_manager"],
  approveTimesheets:        ["admin","delivery_director","project_manager","resource_manager"],
  viewAllTimesheets:        ["admin","delivery_director","resource_manager","finance_lead"],
  // Accounts / Customers
  createAccount:            ["admin","delivery_director","project_manager","finance_lead"],
  editAccount:              ["admin","delivery_director","project_manager","finance_lead"],
  viewAccountACV:           ["admin","executive","finance_lead"],
  // Contracts
  createContract:           ["admin","finance_lead","project_manager"],
  editContract:             ["admin","finance_lead"],
  viewContractValue:        ["admin","executive","finance_lead","project_manager"],
  // Finance
  viewWIPData:              ["admin","executive","finance_lead","delivery_director"],
  viewMarginData:           ["admin","executive","finance_lead"],
  viewLeakageData:          ["admin","finance_lead"],
  viewReceivables:          ["admin","executive","finance_lead","delivery_director"],
  // Invoices
  createInvoice:            ["admin","finance_lead"],
  markInvoicePaid:          ["admin","finance_lead"],
  // Change Orders
  createChangeOrder:        ["admin","delivery_director","project_manager"],
  approveChangeOrder:       ["admin","executive","delivery_director","finance_lead"],
  advanceChangeOrderStage:  ["admin","delivery_director","project_manager"],
  // Resources
  createResource:           ["admin","resource_manager","delivery_director"],
  editResource:             ["admin","resource_manager","delivery_director"],
  viewResourceRates:        ["admin","finance_lead","resource_manager"],
  viewUtilization:          ["admin","delivery_director","resource_manager","project_manager"],
  // Allocations
  createAllocation:         ["admin","resource_manager","delivery_director","project_manager"],
  removeAllocation:         ["admin","resource_manager","delivery_director"],
  resolveConflicts:         ["admin","resource_manager","delivery_director"],
  // Templates (Project Blueprints)
  createTemplate:           ["admin","delivery_director"],
  editTemplate:             ["admin","delivery_director"],
  useTemplate:              ["admin","delivery_director","project_manager"],
  // Portfolio
  viewPortfolio:            ["admin","executive","delivery_director","project_manager"],
  viewDirectorView:         ["admin","executive","delivery_director"],
  // Project Closure
  executeProjectClosure:    ["admin","delivery_director","project_manager"],
  // Admin
  viewAdminPanel:           ["admin"],
  manageUsers:              ["admin"],
  // Capacity
  viewCapacityForecast:     ["admin","delivery_director","resource_manager","project_manager"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role | null, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export function usePermission(permission: Permission): boolean {
  const { role } = useAuthRole();
  return hasPermission(role, permission);
}

export function useCanSee(field: string): boolean {
  const { role } = useAuthRole();
  const rules: Record<string, string[]> = {
    financial_rates:  ["delivery_director", "project_manager", "finance_lead", "admin"],
    prospect_data:    ["account_manager", "delivery_director", "admin"],
    resource_costs:   ["delivery_director", "finance_lead", "admin"],
    all_projects:     ["delivery_director", "admin", "finance_lead"],
    approve_time:     ["delivery_director", "project_manager", "admin"],
  };
  return !!(role && rules[field]?.includes(role));
}

// ─── Route-level role allowlists ─────────────────────────────────────────────

export const ROUTE_ROLES: Record<string, readonly Role[]> = {
  "/admin":               ["admin"],
  "/dashboard/admin":     ["admin"],
  "/dashboard/pm":        ["project_manager","admin","delivery_director","consultant"],
  "/portfolio":           ["admin","executive","delivery_director","project_manager"],
  "/finance":             ["admin","executive","finance_lead","delivery_director","project_manager"],
  "/contracts":           ["admin","finance_lead","project_manager"],
  "/changes":             ["admin","finance_lead","project_manager","delivery_director"],
  "/invoices":            ["admin","executive","finance_lead","delivery_director","project_manager"],
  "/capacity":            ["admin","resource_manager","delivery_director","project_manager"],
  "/allocations":         ["admin","resource_manager","delivery_director","project_manager"],
  "/templates":           ["admin","delivery_director","project_manager"],
  "/resources":           ["admin","delivery_director","resource_manager","project_manager","consultant"],
  "/resources/:id":       ["admin","delivery_director","resource_manager","project_manager"],
};

// ─── Role priority (for display ordering in role switcher) ────────────────────
export const ROLE_PRIORITY: Record<Role, number> = {
  admin:              0,
  executive:          1,
  delivery_director:  2,
  project_manager:    3,
  resource_manager:   4,
  finance_lead:       5,
  sales:              6,
  account_manager:    7,
  client_stakeholder: 8,
  consultant:         9,  // Employee (Self) mode — always last
  external:           10,
};

// ─── Storage keys ─────────────────────────────────────────────────────────────

const ROLE_KEY      = "otmnow_role";
const USER_KEY      = "otmnow_user_id";
const PREF_ROLE_KEY = "otmnow_pref_role";       // Per-user default role preference
const REMEMBER_KEY  = "otmnow_remember_role";   // Remember last role toggle

// ─── Per-user role overrides (for User Management demo) ─────────────────────
// Stored as JSON: { [userId]: Role[] }
const USER_ROLES_KEY = "otmnow_user_roles";

export function getUserRoles(userId: string): Role[] | null {
  try {
    const raw = localStorage.getItem(USER_ROLES_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, Role[]>;
    return map[userId] ?? null;
  } catch {
    return null;
  }
}

export function setUserRoles(userId: string, roles: Role[]) {
  try {
    const raw = localStorage.getItem(USER_ROLES_KEY);
    const map = raw ? JSON.parse(raw) as Record<string, Role[]> : {};
    map[userId] = roles;
    localStorage.setItem(USER_ROLES_KEY, JSON.stringify(map));
  } catch { }
}

export function getEffectiveRoles(user: DemoUser): Role[] {
  const overrides = getUserRoles(user.id);
  return overrides ?? user.availableRoles;
}

// ─── Default role preference ──────────────────────────────────────────────────

export function getDefaultRole(userId: string): Role | null {
  try {
    const raw = localStorage.getItem(PREF_ROLE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, Role>;
    return map[userId] ?? null;
  } catch {
    return null;
  }
}

export function setDefaultRole(userId: string, role: Role | null) {
  try {
    const raw = localStorage.getItem(PREF_ROLE_KEY);
    const map = raw ? JSON.parse(raw) as Record<string, Role> : {};
    if (role) {
      map[userId] = role;
    } else {
      delete map[userId];
    }
    localStorage.setItem(PREF_ROLE_KEY, JSON.stringify(map));
  } catch { }
}

export function getRememberRole(): boolean {
  return localStorage.getItem(REMEMBER_KEY) === "true";
}

export function setRememberRole(val: boolean) {
  localStorage.setItem(REMEMBER_KEY, val ? "true" : "false");
}

// ─── Global state ────────────────────────────────────────────────────────────

function readRoleFromStorage(): Role | null {
  try {
    const saved = localStorage.getItem(ROLE_KEY);
    return ROLES.includes(saved as Role) ? (saved as Role) : null;
  } catch {
    return null;
  }
}

function readUserFromStorage(): DemoUser | null {
  try {
    const saved = localStorage.getItem(USER_KEY);
    return DEMO_USERS.find(u => u.id === saved) ?? null;
  } catch {
    return null;
  }
}

let _role: Role | null = readRoleFromStorage();
let _user: DemoUser | null = readUserFromStorage();
const _listeners = new Set<() => void>();

function notifyAll() {
  _listeners.forEach(fn => fn());
}

export function setRoleGlobal(newRole: Role | null) {
  _role = newRole;
  try {
    if (newRole) {
      localStorage.setItem(ROLE_KEY, newRole);
    } else {
      localStorage.removeItem(ROLE_KEY);
    }
  } catch { }
  notifyAll();
}

export function setUserGlobal(user: DemoUser | null) {
  _user = user;

  if (user) {
    // Determine which role to start with
    let startingRole: Role = user.role;

    if (getRememberRole()) {
      // Restore last active role if it's still available
      const lastRole = readRoleFromStorage();
      const effectiveRoles = getEffectiveRoles(user);
      if (lastRole && effectiveRoles.includes(lastRole)) {
        startingRole = lastRole;
      }
    } else {
      // Check for user-set default role preference
      const pref = getDefaultRole(user.id);
      if (pref && getEffectiveRoles(user).includes(pref)) {
        startingRole = pref;
      }
    }

    _role = startingRole;
    try {
      localStorage.setItem(USER_KEY, user.id);
      localStorage.setItem(ROLE_KEY, startingRole);
    } catch { }
  } else {
    _role = null;
    try {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(ROLE_KEY);
    } catch { }
  }

  notifyAll();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === ROLE_KEY) {
      _role = readRoleFromStorage();
      notifyAll();
    }
    if (e.key === USER_KEY) {
      _user = readUserFromStorage();
      notifyAll();
    }
  });
}

export function useAuthRole() {
  const [role, setLocalRole] = useState<Role | null>(() => _role);
  const [user, setLocalUser] = useState<DemoUser | null>(() => _user);

  useEffect(() => {
    const sync = () => { setLocalRole(_role); setLocalUser(_user); };
    _listeners.add(sync);
    sync();
    return () => { _listeners.delete(sync); };
  }, []);

  return { role, user, setRole: setRoleGlobal, setUser: setUserGlobal };
}
