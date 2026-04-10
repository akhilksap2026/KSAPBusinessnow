import { useState, useMemo } from "react";
import { useListAccounts } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import {
  Search, Building2, TrendingUp, AlertTriangle, DollarSign,
  Cloud, Server, Calendar, CheckCircle2,
} from "lucide-react";

const SEGMENTS = ["enterprise", "mid_market", "smb", "strategic"];
const STATUSES = ["active", "at_risk", "inactive", "churned", "prospect"];

function HealthBar({ score }: { score: number | null }) {
  if (score == null || score === 0) return <span className="text-muted-foreground text-xs">—</span>;
  const color = score >= 80 ? "bg-emerald-500" : score >= 65 ? "bg-amber-500" : "bg-red-500";
  const textColor = score >= 80 ? "text-emerald-600 dark:text-emerald-400" : score >= 65 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${textColor}`}>{score}</span>
    </div>
  );
}

function RenewalBadge({ date }: { date: string | null | undefined }) {
  if (!date) return <span className="text-muted-foreground text-xs">—</span>;
  const d = new Date(date);
  const now = new Date();
  const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (daysLeft < 0) return <span className="text-xs text-muted-foreground">{label}</span>;
  if (daysLeft <= 60)  return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400"><AlertTriangle className="h-3 w-3" />{label}</span>;
  if (daysLeft <= 120) return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400"><Calendar className="h-3 w-3" />{label}</span>;
  return <span className="text-xs text-muted-foreground">{label}</span>;
}

function KpiCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AccountsList() {
  const { data: accounts, isLoading } = useListAccounts();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSegment, setFilterSegment] = useState("all");

  const filtered = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter(a => {
      if (filterStatus !== "all" && a.status !== filterStatus) return false;
      if (filterSegment !== "all" && a.segment !== filterSegment) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!a.name.toLowerCase().includes(s) &&
            !(a.industry || "").toLowerCase().includes(s) &&
            !(a.region || "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [accounts, filterStatus, filterSegment, search]);

  const kpis = useMemo(() => {
    const all = accounts || [];
    const active    = all.filter(a => a.status === "active").length;
    const atRisk    = all.filter(a => a.status === "at_risk").length;
    const totalACV  = all.filter(a => a.status !== "churned" && a.status !== "prospect")
                        .reduce((s, a) => s + (a.annualContractValue || 0), 0);
    const avgHealth = (() => {
      const scored = all.filter(a => a.healthScore && a.healthScore > 0);
      return scored.length ? Math.round(scored.reduce((s, a) => s + (a.healthScore || 0), 0) / scored.length) : 0;
    })();
    return { total: all.length, active, atRisk, totalACV, avgHealth };
  }, [accounts]);

  const statusConfig: Record<string, { label: string; className: string }> = {
    active:   { label: "Active",   className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
    at_risk:  { label: "At Risk",  className: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" },
    prospect: { label: "Prospect", className: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300" },
    inactive: { label: "Inactive", className: "bg-muted text-muted-foreground" },
    churned:  { label: "Churned",  className: "bg-muted text-muted-foreground" },
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {kpis.total} accounts · {kpis.active} active · ${kpis.totalACV.toLocaleString()} total ACV
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Accounts" value={kpis.total}  sub={`${kpis.active} active`}             icon={Building2}    accent="bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400" />
        <KpiCard label="Total ACV"      value={`$${(kpis.totalACV / 1000).toFixed(0)}K`} sub="active &amp; AMS accounts" icon={DollarSign}   accent="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" />
        <KpiCard label="At Risk"        value={kpis.atRisk}  sub="need attention"                     icon={AlertTriangle} accent="bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400" />
        <KpiCard label="Avg Health"     value={kpis.avgHealth} sub="across scored accounts"           icon={TrendingUp}   accent="bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, industry, region…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSegment} onValueChange={setFilterSegment}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Segment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Segments</SelectItem>
            {SEGMENTS.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        {(filterStatus !== "all" || filterSegment !== "all" || search) && (
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground"
            onClick={() => { setFilterStatus("all"); setFilterSegment("all"); setSearch(""); }}>
            Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[180px]">Account</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="min-w-[120px]">Health</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>OTM Version</TableHead>
              <TableHead>Renewal</TableHead>
              <TableHead className="text-right">ACV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((account) => {
              const sc = statusConfig[account.status] ?? { label: account.status, className: "bg-muted text-muted-foreground" };
              return (
                <TableRow key={account.id} className="hover:bg-muted/30 cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/accounts/${account.id}`} className="hover:underline text-primary font-semibold">
                      {account.name}
                    </Link>
                    {(account as any).region && (
                      <p className="text-xs text-muted-foreground font-normal">{(account as any).region}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{account.industry || "—"}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground capitalize">{account.segment?.replace("_", " ") || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.className}`}>
                      {sc.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <HealthBar score={account.healthScore ?? null} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(account as any).region || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {(account as any).cloudDeployment
                        ? <Cloud className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                        : <Server className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      }
                      <span className="text-xs text-muted-foreground">
                        {(account as any).otmVersion || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RenewalBadge date={(account as any).renewalDate} />
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold text-sm">
                      {account.annualContractValue && Number(account.annualContractValue) > 0
                        ? `$${Number(account.annualContractValue).toLocaleString()}`
                        : <span className="text-muted-foreground font-normal">—</span>}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                  No accounts match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5"><Cloud className="h-3.5 w-3.5 text-blue-500" /> Cloud deployment</span>
        <span className="flex items-center gap-1.5"><Server className="h-3.5 w-3.5" /> On-premise</span>
        <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Renewal within 60 days</span>
        <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-amber-500" /> Renewal within 120 days</span>
        <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Health ≥ 80</span>
      </div>
    </div>
  );
}
