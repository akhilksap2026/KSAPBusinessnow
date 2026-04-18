import { useState, useEffect } from "react";
import { useAuthRole, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_PRIORITY, getEffectiveRoles, getDefaultRole, setDefaultRole, getRememberRole, setRememberRole, DEMO_USERS, type Role } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, User, Plus, Trash2, Clock, RefreshCw, ArrowUpDown, Shield } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

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
};

interface Delegation {
  id: number;
  delegatorId: number;
  delegateId: number;
  delegatorName: string;
  delegateName: string;
  startDate: string;
  endDate: string;
  scope: string;
  isActive: boolean;
}

function ProfileContent() {
  const { user, role } = useAuthRole();
  const { toast } = useToast();

  const [defaultRole, setDefaultRoleState] = useState<Role | null>(null);
  const [rememberRole, setRememberRoleState] = useState(false);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loadingDelegations, setLoadingDelegations] = useState(true);

  // New delegation form
  const [addOpen, setAddOpen] = useState(false);
  const [delegateTo, setDelegateTo] = useState("");
  const [delegateRole, setDelegateRole] = useState<Role>("project_manager");
  const [delegateStart, setDelegateStart] = useState("");
  const [delegateEnd, setDelegateEnd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setDefaultRoleState(getDefaultRole(user.id));
      setRememberRoleState(getRememberRole());
    }
  }, [user]);

  const loadDelegations = async () => {
    if (!user) return;
    setLoadingDelegations(true);
    try {
      // We need the user's DB ID — look them up by email
      const ctx = await fetch(`${API}/me/context?email=${encodeURIComponent(`${user.id}@businessnow.com`)}`).then(r => r.json());
      const dbUserId = ctx?.self?.id;
      if (!dbUserId) { setLoadingDelegations(false); return; }
      const rows = await fetch(`${API}/delegations/mine?contextUserId=${dbUserId}`).then(r => r.json());
      setDelegations(Array.isArray(rows) ? rows : []);
    } catch {
      setDelegations([]);
    } finally {
      setLoadingDelegations(false);
    }
  };

  useEffect(() => { loadDelegations(); }, [user]);

  const handleDefaultRoleChange = (r: Role) => {
    if (!user) return;
    setDefaultRoleState(r);
    setDefaultRole(user.id, r);
    toast({ title: "Default login role saved" });
  };

  const handleRememberToggle = (val: boolean) => {
    setRememberRoleState(val);
    setRememberRole(val);
    toast({ title: val ? "Last role will be remembered on login" : "Will use default role on login" });
  };

  const handleAddDelegation = async () => {
    if (!user || !delegateTo || !delegateStart || !delegateEnd) {
      toast({ title: "Please fill all fields", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const ctx = await fetch(`${API}/me/context?email=${encodeURIComponent(`${user.id}@businessnow.com`)}`).then(r => r.json());
      const dbUserId = ctx?.self?.id;
      if (!dbUserId) throw new Error("Could not resolve user");

      // Find the delegate's DB user ID
      const targetEmail = DEMO_USERS.find(u => u.name === delegateTo)?.id;
      if (!targetEmail) throw new Error("User not found");
      const targetCtx = await fetch(`${API}/me/context?email=${encodeURIComponent(`${targetEmail}@businessnow.com`)}`).then(r => r.json());
      const targetDbId = targetCtx?.self?.id;
      if (!targetDbId) throw new Error("Delegate user not found in system");

      await fetch(`${API}/delegations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delegatorId: dbUserId,
          delegateId: targetDbId,
          startDate: delegateStart,
          endDate: delegateEnd,
          scope: delegateRole,
        }),
      });
      toast({ title: "Delegation created", description: `${delegateTo} can act as your ${ROLE_LABELS[delegateRole]} until ${delegateEnd}` });
      setAddOpen(false);
      setDelegateTo("");
      setDelegateStart("");
      setDelegateEnd("");
      loadDelegations();
    } catch (e: any) {
      toast({ title: "Failed to create delegation", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      await fetch(`${API}/delegations/${id}`, { method: "DELETE" });
      toast({ title: "Delegation revoked" });
      loadDelegations();
    } catch {
      toast({ title: "Failed to revoke", variant: "destructive" });
    }
  };

  if (!user || !role) {
    return <div className="p-8 text-center text-muted-foreground">Please sign in to view your profile.</div>;
  }

  const availableRoles = [...getEffectiveRoles(user)].sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b]);
  const elevatedRoles = availableRoles.filter(r => r !== "consultant");
  const delegatableUsers = DEMO_USERS.filter(u => u.id !== user.id);

  const myDelegationsGiven = delegations.filter(d => d.delegatorName === user.name || d.delegatorId !== d.delegateId);
  const myDelegationsReceived = delegations.filter(d => d.delegateName === user.name);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary border border-primary/20">
          {user.initials}
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.title}</p>
          <Badge variant="secondary" className={`text-[10px] font-semibold mt-1.5 border ${ROLE_COLORS[role] ?? ""}`}>
            {ROLE_LABELS[role]}
          </Badge>
        </div>
      </div>

      {/* Role Assignment */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Assigned Roles</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          The base Employee role is always assigned. Elevated roles grant additional permissions and can be switched from the top bar.
        </p>
        <div className="space-y-2">
          {availableRoles.map(r => {
            const isBase = r === "consultant";
            const isActive = r === role;
            return (
              <div key={r} className={`flex items-center gap-3 p-3 rounded-lg border ${isActive ? "border-primary/30 bg-primary/5" : "border-border bg-background"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${ROLE_COLORS[r] ?? "bg-muted border-border"}`}>
                  {isBase ? <User className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground">{isBase ? "Employee (Self)" : ROLE_LABELS[r]}</p>
                    {isBase && <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">Base — always active</span>}
                    {isActive && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">Currently active</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {isBase ? "Self-scoped — view and submit your own data only" : ROLE_DESCRIPTIONS[r]}
                  </p>
                </div>
                {isBase && <span className="text-[9px] font-medium text-muted-foreground shrink-0 italic">System</span>}
              </div>
            );
          })}
        </div>
        {elevatedRoles.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No elevated roles assigned. Contact your System Admin to request elevated access.</p>
        )}
      </div>

      {/* Login Preferences */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Login Preferences</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Default Login Role</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Which role context to start in when you log in</p>
            </div>
            <Select
              value={defaultRole ?? user.role}
              onValueChange={(v) => handleDefaultRoleChange(v as Role)}
            >
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map(r => (
                  <SelectItem key={r} value={r} className="text-xs">
                    {r === "consultant" ? "Employee (Self)" : ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium" htmlFor="remember-toggle">Remember Last Active Role</Label>
              <p className="text-xs text-muted-foreground mt-0.5">If on, login restores the role you had at last logout</p>
            </div>
            <Switch
              id="remember-toggle"
              checked={rememberRole}
              onCheckedChange={handleRememberToggle}
            />
          </div>
        </div>
      </div>

      {/* Delegation Settings */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Delegation Settings</h2>
          </div>
          {elevatedRoles.length > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-3 w-3" /> Delegate a Role
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Temporarily grant one of your elevated roles to a colleague — for example, during leave. Delegations are time-boxed and fully auditable.
        </p>

        {/* Delegations I've Given */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Delegations I've Given</h3>
          {loadingDelegations ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : myDelegationsGiven.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">No active outgoing delegations.</div>
          ) : (
            <div className="space-y-2">
              {myDelegationsGiven.map(d => {
                const isExpired = d.endDate < today;
                return (
                  <div key={d.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isExpired ? "border-border opacity-50" : "border-border"}`}>
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        {d.delegateName} · <span className="text-muted-foreground">{ROLE_LABELS[d.scope as Role] ?? d.scope}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">{d.startDate} → {d.endDate}</p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] shrink-0 ${isExpired ? "text-muted-foreground" : "text-primary border-primary/30"}`}>
                      {isExpired ? "Expired" : "Active"}
                    </Badge>
                    {!isExpired && (
                      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => handleRevoke(d.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delegations I've Received */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Delegations I've Received</h3>
          {loadingDelegations ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : myDelegationsReceived.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">No incoming delegations.</div>
          ) : (
            <div className="space-y-2">
              {myDelegationsReceived.map(d => {
                const isExpired = d.endDate < today;
                return (
                  <div key={d.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isExpired ? "border-border opacity-50" : "border-primary/20 bg-primary/5"}`}>
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        {ROLE_LABELS[d.scope as Role] ?? d.scope} <span className="text-muted-foreground">from</span> {d.delegatorName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{d.startDate} → {d.endDate}</p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] shrink-0 ${isExpired ? "text-muted-foreground" : "text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-800"}`}>
                      {isExpired ? "Expired" : "Active"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {elevatedRoles.length === 0 && (
          <p className="text-xs text-muted-foreground italic">You need at least one elevated role to create delegations.</p>
        )}
      </div>

      {/* Add Delegation Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Delegate a Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Role to Delegate</Label>
              <Select value={delegateRole} onValueChange={v => setDelegateRole(v as Role)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {elevatedRoles.map(r => (
                    <SelectItem key={r} value={r} className="text-sm">{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Delegate To</Label>
              <Select value={delegateTo} onValueChange={setDelegateTo}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select a colleague…" />
                </SelectTrigger>
                <SelectContent>
                  {delegatableUsers.map(u => (
                    <SelectItem key={u.id} value={u.name} className="text-sm">
                      {u.name} · <span className="text-muted-foreground">{ROLE_LABELS[u.role]}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={delegateStart} onChange={e => setDelegateStart(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date <span className="text-muted-foreground">(required)</span></Label>
                <Input type="date" value={delegateEnd} onChange={e => setDelegateEnd(e.target.value)} className="h-9 text-sm" min={delegateStart} />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded p-2.5">
              Delegations are time-boxed — an end date is mandatory. The delegate gains your role during this window; your original access is unchanged. All actions are fully audited.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddDelegation} disabled={saving}>
              {saving ? "Saving…" : "Create Delegation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AppLayout>
      <ProfileContent />
    </AppLayout>
  );
}
