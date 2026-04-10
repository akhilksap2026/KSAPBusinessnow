import { ShieldOff } from "lucide-react";
import { useLocation } from "wouter";
import { useAuthRole, ROLE_LABELS } from "@/lib/auth";
import type { Role } from "@/lib/auth";

interface AccessDeniedProps {
  allowedRoles?: readonly Role[];
}

export function AccessDenied({ allowedRoles }: AccessDeniedProps) {
  const { role } = useAuthRole();
  const [, setLocation] = useLocation();

  const homeMap: Partial<Record<Role, string>> = {
    executive:          "/portfolio",
    delivery_director:  "/portfolio",
    project_manager:    "/dashboard/pm",
    resource_manager:   "/resources",
    finance_lead:       "/finance",
    sales:              "/dashboard/sales",
    account_manager:    "/dashboard/am",
    client_stakeholder: "/portal",
    admin:              "/dashboard/admin",
    consultant:         "/dashboard/pm",
  };

  const home = role ? (homeMap[role] ?? "/") : "/login";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
        <ShieldOff className="h-7 w-7 text-destructive" />
      </div>

      <h2 className="text-xl font-bold text-foreground mb-2">Access Restricted</h2>

      <p className="text-sm text-muted-foreground max-w-xs mb-1">
        Your <span className="font-medium text-foreground">{role ? ROLE_LABELS[role] : "current"}</span> role doesn't have permission to view this page.
      </p>

      {allowedRoles && allowedRoles.length > 0 && (
        <p className="text-xs text-muted-foreground/60 mb-6">
          Available to: {allowedRoles.map(r => ROLE_LABELS[r]).join(", ")}
        </p>
      )}

      <div className="flex gap-3 mt-2">
        <button
          onClick={() => setLocation(home)}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Go to my dashboard
        </button>
        <button
          onClick={() => history.back()}
          className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          Go back
        </button>
      </div>
    </div>
  );
}
