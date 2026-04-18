import { useState } from "react";
import {
  DEMO_USERS, ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_PRIORITY,
  getEffectiveRoles, setUserRoles, type Role, type DemoUser,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/layout/app-layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, User, Search, Plus, X, Shield, ChevronRight } from "lucide-react";
import { useAuthRole } from "@/lib/auth";
import { AccessDenied } from "@/components/access-denied";

const ROLE_COLORS: Record<string, string> = {
  admin:              "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-800",
  executive:          "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  delivery_director:  "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800",
  project_manager:    "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800",
  consultant:         "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800",
  resource_manager:   "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  finance_lead:       "bg-green-500/10 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800",
  sales:              "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800",
  account_manager:    "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800",
  client_stakeholder: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-800",
  external:           "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-800",
};

const ALL_ELEVATED_ROLES: Role[] = (ROLES as readonly Role[]).filter(r => r !== "consultant" && r !== "external");

interface EditDialogProps {
  user: DemoUser;
  onClose: () => void;
  onSaved: () => void;
}

function RoleEditDialog({ user, onClose, onSaved }: EditDialogProps) {
  const { toast } = useToast();
  const currentRoles = getEffectiveRoles(user);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(currentRoles);

  const toggleRole = (r: Role) => {
    if (r === "consultant") return; // Cannot remove base role
    setSelectedRoles(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    );
  };

  const save = () => {
    // Ensure consultant (base) is always included
    const finalRoles = selectedRoles.includes("consultant")
      ? selectedRoles
      : [...selectedRoles, "consultant"];
    const sorted = [...finalRoles].sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b]);
    setUserRoles(user.id, sorted);
    toast({ title: `Roles updated for ${user.name}` });
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            Edit Roles — {user.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Base role — always active, locked */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-cyan-300 dark:border-cyan-800 bg-cyan-500/5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 shrink-0">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground">Employee (Self)</p>
              <p className="text-[10px] text-muted-foreground">Self-scoped — base role, cannot be removed</p>
            </div>
            <Badge variant="secondary" className="text-[9px] shrink-0">System</Badge>
          </div>

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Elevated Roles</p>

          {ALL_ELEVATED_ROLES.map(r => {
            const isSelected = selectedRoles.includes(r);
            return (
              <button
                key={r}
                onClick={() => toggleRole(r)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-border hover:bg-muted/30"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${ROLE_COLORS[r] ?? "bg-muted border-border"}`}>
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{ROLE_LABELS[r]}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{ROLE_DESCRIPTIONS[r]}</p>
                </div>
                <div className={`w-4 h-4 rounded border-2 shrink-0 transition-colors flex items-center justify-center ${
                  isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                }`}>
                  {isSelected && <div className="w-2 h-2 rounded-sm bg-white" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-[10px] text-muted-foreground bg-muted/50 rounded-lg p-3">
          Changes apply to this browser session. The user can switch to any assigned role from the top bar.
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserManagementContent() {
  const { role } = useAuthRole();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<DemoUser | null>(null);
  const [version, setVersion] = useState(0); // force re-render after save

  if (role !== "admin") {
    return <AccessDenied />;
  }

  const filtered = DEMO_USERS.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    ROLE_LABELS[u.role].toLowerCase().includes(search.toLowerCase()) ||
    u.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleReset = (u: DemoUser) => {
    setUserRoles(u.id, u.availableRoles);
    setVersion(v => v + 1);
    toast({ title: `Roles reset to default for ${u.name}` });
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">User Management</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Assign or revoke elevated roles for any user. The Employee base role is always present and cannot be removed.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users, roles, titles…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* RBAC Rule Notice */}
      <div className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
        <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">RBAC Guardrail Active</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Users can switch between their assigned roles from the top bar. Self-approval is blocked under all roles.
            Delegations require an explicit expiry date and are fully auditable.
          </p>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Base Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Elevated Roles</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const effectiveRoles = getEffectiveRoles(u);
              const elevatedRoles = effectiveRoles.filter(r => r !== "consultant");
              const isCustomized = JSON.stringify([...effectiveRoles].sort()) !== JSON.stringify([...u.availableRoles].sort());
              return (
                <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                        {u.initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{u.name}</p>
                        <p className="text-[10px] text-muted-foreground">{u.title}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                      <span className="text-xs text-muted-foreground">Employee (Self)</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {elevatedRoles.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">None</span>
                      ) : elevatedRoles.sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b]).map(r => (
                        <Badge key={r} variant="outline" className={`text-[10px] font-medium ${ROLE_COLORS[r] ?? ""}`}>
                          {ROLE_LABELS[r]}
                        </Badge>
                      ))}
                      {isCustomized && (
                        <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-600 dark:text-amber-400">
                          Modified
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isCustomized && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground gap-1" onClick={() => handleReset(u)}>
                          Reset
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => setEditingUser(u)}
                      >
                        <Plus className="h-3 w-3" /> Edit Roles
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">No users match your search.</p>
          </div>
        )}
      </div>

      {editingUser && (
        <RoleEditDialog
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => setVersion(v => v + 1)}
        />
      )}
    </div>
  );
}

export default function UserManagementPage() {
  return (
    <AppLayout>
      <UserManagementContent />
    </AppLayout>
  );
}
