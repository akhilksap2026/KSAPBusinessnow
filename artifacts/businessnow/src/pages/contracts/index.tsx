import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { FileText, Plus, Search, DollarSign, Calendar, Shield } from "lucide-react";
import { useAuthRole, hasPermission } from "@/lib/auth";

const API = "/api";

function fmt(v: number) {
  if (!v) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

const billingModelConfig: Record<string, { label: string; color: string }> = {
  time_and_materials: { label: "T&M", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  milestone: { label: "Milestone", color: "bg-violet-500/10 text-violet-400 border-violet-500/30" },
  fixed_fee: { label: "Fixed Fee", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  retainer: { label: "Retainer", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  ams: { label: "AMS", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
};

const statusConfig: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  draft: "bg-zinc-500/10 text-muted-foreground border-border/30",
  expired: "bg-red-500/10 text-red-400 border-red-500/30",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

function ContractCard({ contract, onSelect }: { contract: any; onSelect: () => void }) {
  const bm = billingModelConfig[contract.billingModel] || { label: contract.billingModel, color: "bg-muted text-muted-foreground border-border" };
  const invoicedPct = contract.totalValue > 0 ? ((contract.invoicedValue || 0) / contract.totalValue) * 100 : 0;

  return (
    <Card className="bg-card border-border hover:border-border cursor-pointer transition-all" onClick={onSelect}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm leading-snug truncate">{contract.name}</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">{contract.contractNumber} · {contract.accountName || contract.projectName}</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${bm.color}`}>{bm.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig[contract.status] || "bg-muted text-muted-foreground border-border"}`}>{contract.status}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-muted-foreground/70">Total Value</p>
            <p className="text-base font-bold text-foreground">{fmt(contract.totalValue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground/70">Invoiced</p>
            <p className="text-base font-semibold text-emerald-400">{fmt(contract.invoicedValue || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground/70">Remaining</p>
            <p className="text-base font-semibold text-amber-400">{fmt(contract.remainingValue ?? contract.totalValue)}</p>
          </div>
        </div>

        {contract.totalValue > 0 && (
          <div>
            <Progress value={invoicedPct} className="h-1.5 bg-muted" />
            <p className="text-xs text-muted-foreground/70 mt-1">{invoicedPct.toFixed(0)}% invoiced</p>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground/70">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{contract.startDate} → {contract.endDate}</span>
          <span>{contract.paymentTerms} · {contract.billingCycle}</span>
        </div>

        {contract.billingMilestones?.length > 0 && (
          <div className="pt-1 border-t border-border">
            <p className="text-xs text-muted-foreground/70 mb-1.5">Billing Milestones</p>
            <div className="space-y-1">
              {contract.billingMilestones.slice(0, 3).map((m: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{m.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium">{fmt(m.amount)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${m.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground/70"}`}>{m.status}</span>
                  </div>
                </div>
              ))}
              {contract.billingMilestones.length > 3 && <p className="text-xs text-muted-foreground/60">+{contract.billingMilestones.length - 3} more</p>}
            </div>
          </div>
        )}

        {contract.slaConfig && Object.keys(contract.slaConfig).length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 pt-1 border-t border-border">
            <Shield className="h-3 w-3 text-blue-400" />
            <span className="text-blue-400">SLA configured</span>
            <span>· {Object.keys(contract.slaConfig).join(", ")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ContractsPage() {
  const { role } = useAuthRole();
  const canCreate = hasPermission(role, "createContract");
  const [contracts, setContracts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => { fetch(`${API}/contracts`).then(r => r.json()).then(setContracts); }, []);

  const filtered = contracts.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.accountName || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || c.billingModel === filter || c.status === filter;
    return matchSearch && matchFilter;
  });

  const totalValue = contracts.reduce((s, c) => s + (c.totalValue || 0), 0);
  const activeCount = contracts.filter(c => c.status === "active").length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-400" /> Contract Manager
            </h1>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Manage billing models, SLAs, and contract value</p>
          </div>
          {canCreate && (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> New Contract
            </Button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          {[
            { label: "Total TCV", value: fmt(totalValue), sub: `${contracts.length} contracts` },
            { label: "Active", value: String(activeCount), sub: "under management" },
            { label: "Invoiced", value: fmt(contracts.reduce((s, c) => s + (c.invoicedValue || 0), 0)), sub: "to date" },
            { label: "Remaining", value: fmt(contracts.reduce((s, c) => s + (c.remainingValue ?? c.totalValue ?? 0), 0)), sub: "available" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-muted rounded-lg px-3 py-2.5">
              <p className="text-xs text-muted-foreground/70">{label}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{value}</p>
              <p className="text-xs text-muted-foreground/60">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contracts…" className="pl-9 bg-card border-border text-foreground placeholder:text-muted-foreground/70" />
          </div>
          <div className="flex gap-1">
            {["all", "active", "time_and_materials", "milestone", "fixed_fee", "retainer", "ams"].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f ? "bg-border text-foreground" : "text-muted-foreground/70 hover:text-foreground hover:bg-muted"}`}>
                {f === "all" ? "All" : f === "time_and_materials" ? "T&M" : f.charAt(0).toUpperCase() + f.slice(1).replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No contracts found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Adjust your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(c => (
              <ContractCard key={c.id} contract={c} onSelect={() => setSelected(c)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
