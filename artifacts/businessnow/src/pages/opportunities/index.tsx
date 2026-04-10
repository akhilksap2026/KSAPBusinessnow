import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useListOpportunities } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { ChevronRight, AlertTriangle, TrendingUp, Users, DollarSign, Plus, GripVertical } from "lucide-react";
import { useAuthRole, hasPermission } from "@/lib/auth";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const STAGES = [
  { key: "lead",        label: "Lead",        color: "bg-slate-500" },
  { key: "qualified",   label: "Qualified",   color: "bg-blue-500" },
  { key: "discovery",   label: "Discovery",   color: "bg-indigo-500" },
  { key: "proposal",    label: "Proposal",    color: "bg-violet-500" },
  { key: "negotiation", label: "Negotiation", color: "bg-amber-500" },
  { key: "won",         label: "Won",         color: "bg-green-500" },
  { key: "lost",        label: "Lost",        color: "bg-red-400" },
  { key: "parked",      label: "Parked",      color: "bg-slate-400" },
] as const;

const TYPE_LABELS: Record<string, string> = {
  implementation: "Implementation",
  cloud_migration: "Cloud Migration",
  ams: "AMS",
  certification: "Certification",
  rate_maintenance: "Rate Maintenance",
  custom_development: "Custom Dev",
  data_services: "Data Services",
};

const STAFFING_RISK_COLOR: Record<string, string> = {
  none: "text-muted-foreground",
  low: "text-yellow-600",
  medium: "text-orange-500",
  high: "text-red-500",
};

const STAFFING_RISK_BADGE: Record<string, string> = {
  none:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  low:    "bg-yellow-50 text-yellow-700 border-yellow-200",
  medium: "bg-orange-50 text-orange-700 border-orange-200",
  high:   "bg-red-50 text-red-700 border-red-200",
};

function fmt(val: number | null | undefined) {
  if (!val) return "TBD";
  return val >= 1_000_000 ? `$${(val / 1_000_000).toFixed(1)}M` : `$${Math.round(val / 1000)}k`;
}

function OppCardContent({ opp, ghost = false }: { opp: any; ghost?: boolean }) {
  const [, setLocation] = useLocation();
  const prob = opp.probability ?? 0;
  const probColor = prob >= 70 ? "text-emerald-600" : prob >= 40 ? "text-amber-600" : "text-muted-foreground";

  return (
    <Card className={`group bg-card ${ghost ? "shadow-xl rotate-1 opacity-95 ring-2 ring-primary/30" : "hover:shadow-md hover:border-primary/40 transition-all"}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-1.5">
          <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5 cursor-grab" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-1">
              <p className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                {opp.name}
              </p>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
            </div>
          </div>
        </div>

        {opp.accountId ? (
          <p className="text-xs text-muted-foreground truncate pl-6">
            {opp.accountName ?? `Account #${opp.accountId}`}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground pl-6">No account</p>
        )}

        <div className="flex items-center justify-between gap-1 pl-6">
          <span className="text-xs text-muted-foreground">
            {TYPE_LABELS[opp.type] ?? opp.type ?? "—"}
          </span>
          <span className={`text-xs font-bold ${probColor}`}>{prob}%</span>
        </div>

        {opp.value ? (
          <p className="text-xs font-semibold text-foreground pl-6">{fmt(opp.value)}</p>
        ) : null}

        <div className="flex items-center justify-between pl-6">
          {opp.closeDate ? (
            <p className="text-[10px] text-muted-foreground">
              Close: {format(parseISO(opp.closeDate), "MMM d, yyyy")}
            </p>
          ) : <span />}
          {opp.staffingRisk ? (
            <span className={`text-[10px] font-semibold flex items-center gap-0.5 border rounded-full px-1.5 py-0.5 ${STAFFING_RISK_BADGE[opp.staffingRisk] ?? STAFFING_RISK_BADGE.none}`}>
              {opp.staffingRisk !== "none" && <AlertTriangle className="h-2.5 w-2.5" />}
              {opp.staffingRisk === "none" ? "✓ Staffed" : `${opp.staffingRisk} risk`}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function DraggableOppCard({ opp }: { opp: any }) {
  const [, setLocation] = useLocation();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: opp.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="touch-none cursor-grab active:cursor-grabbing"
      onClick={() => { if (!isDragging) setLocation(`/opportunities/${opp.id}`); }}
    >
      <OppCardContent opp={opp} />
    </div>
  );
}

function DroppableStageColumn({
  stage,
  cards,
  stageValue,
}: {
  stage: typeof STAGES[number];
  cards: any[];
  stageValue: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  return (
    <div className="flex-shrink-0 w-[220px] space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${stage.color}`} />
          <span className="text-sm font-semibold">{stage.label}</span>
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5">{cards.length}</span>
        </div>
        <span className="text-[10px] text-muted-foreground font-medium">{fmt(stageValue)}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[100px] rounded-lg p-1 transition-all ${isOver ? "bg-primary/5 ring-2 ring-primary/20" : ""}`}
      >
        {cards.map(opp => <DraggableOppCard key={opp.id} opp={opp} />)}
        {cards.length === 0 && (
          <div className={`border-2 border-dashed rounded-lg h-20 flex items-center justify-center transition-colors ${isOver ? "border-primary/40 bg-primary/5" : "border-muted"}`}>
            <span className="text-[10px] text-muted-foreground">{isOver ? `→ ${stage.label}` : "Empty"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OpportunitiesPipeline() {
  const { data: oppsData, isLoading, refetch } = useListOpportunities();
  const { role } = useAuthRole();
  const canCreate = hasPermission(role, "createOpportunity");
  const [filter, setFilter] = useState<"all" | "active" | "won">("active");
  const [localOpps, setLocalOpps] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    if (oppsData) setLocalOpps(oppsData);
  }, [oppsData]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleStageChange = async (id: number, stage: string) => {
    setLocalOpps(prev => prev.map(o => o.id === id ? { ...o, stage } : o));
    try {
      await fetch(`/api/opportunities/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      refetch();
    } catch {
      if (oppsData) setLocalOpps(oppsData);
    }
  };

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as number);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const opp = localOpps.find(o => o.id === active.id);
    if (opp && opp.stage !== over.id) {
      handleStageChange(opp.id, over.id as string);
    }
  }

  const activeOpp = localOpps.find(o => o.id === activeId);

  const filtered = localOpps.filter(o => {
    if (filter === "all") return true;
    if (filter === "active") return !["won", "lost", "parked"].includes(o.stage);
    if (filter === "won") return o.stage === "won";
    return true;
  });

  const stagesShown = filter === "won"
    ? STAGES.filter(s => s.key === "won")
    : filter === "active"
      ? STAGES.filter(s => !["won", "lost", "parked"].includes(s.key))
      : STAGES;

  const totalPipeline = filtered.reduce((s, o) => s + (o.value || 0) * (o.probability || 0) / 100, 0);
  const totalValue = filtered.reduce((s, o) => s + (o.value || 0), 0);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[500px] w-56" />)}
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="p-6 space-y-5 max-w-[1800px] mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Opportunity Pipeline</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filtered.length} opportunities · Weighted pipeline: <strong>{fmt(totalPipeline)}</strong> · Total value: <strong>{fmt(totalValue)}</strong>
              <span className="ml-2 text-xs text-muted-foreground/70">· drag cards to advance stages</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border p-0.5 gap-0.5">
              {(["active", "all", "won"] as const).map(f => (
                <Button key={f} size="sm" variant={filter === f ? "secondary" : "ghost"} className="h-7 px-3 text-xs capitalize"
                  onClick={() => setFilter(f)}>
                  {f === "active" ? "Active" : f === "all" ? "All" : "Won"}
                </Button>
              ))}
            </div>
            {canCreate && (
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New Opportunity
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Active Deals",        value: localOpps.filter(o => !["won","lost","parked"].includes(o.stage)).length,                             icon: TrendingUp,   color: "text-blue-500" },
            { label: "Proposals Out",       value: localOpps.filter(o => o.stage === "proposal").length,                                                 icon: DollarSign,   color: "text-violet-500" },
            { label: "Staffing Risk",       value: localOpps.filter(o => o.staffingRisk && o.staffingRisk !== "none").length + " flagged",               icon: AlertTriangle,color: "text-orange-500" },
            { label: "High Probability (≥70%)", value: localOpps.filter(o => !["won","lost","parked"].includes(o.stage) && (o.probability||0) >= 70).length, icon: Users,    color: "text-green-500" },
          ].map(kpi => (
            <Card key={kpi.label} className="p-3">
              <div className="flex items-center gap-2">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-xl font-bold mt-1">{kpi.value}</p>
            </Card>
          ))}
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4">
          {stagesShown.map(stage => {
            const cards = filtered.filter(o => o.stage === stage.key);
            const stageValue = cards.reduce((s, o) => s + (o.value || 0), 0);
            return (
              <DroppableStageColumn key={stage.key} stage={stage} cards={cards} stageValue={stageValue} />
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeOpp ? (
          <div className="w-[220px] pointer-events-none">
            <OppCardContent opp={activeOpp} ghost />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
