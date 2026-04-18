import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Clock, ChevronRight, Package, Zap, Shield, BarChart3, Database, Code2, RefreshCw } from "lucide-react";
import { useAuthRole, hasPermission } from "@/lib/auth";

const API = import.meta.env.BASE_URL + "api";

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  implementation: Package,
  cloud_migration: Zap,
  ams: Shield,
  release_cert: BarChart3,
  rate_maintenance: RefreshCw,
  data_migration: Database,
  custom_dev: Code2,
};

const TEMPLATE_COLORS: Record<string, string> = {
  implementation: "from-violet-600 to-violet-800 border-violet-500/30",
  cloud_migration: "from-blue-600 to-blue-800 border-blue-500/30",
  ams: "from-teal-600 to-teal-800 border-teal-500/30",
  release_cert: "from-emerald-600 to-emerald-800 border-emerald-500/30",
  rate_maintenance: "from-amber-600 to-amber-800 border-amber-500/30",
  data_migration: "from-cyan-600 to-cyan-800 border-cyan-500/30",
  custom_dev: "from-indigo-600 to-indigo-800 border-indigo-500/30",
};

const TYPE_LABELS: Record<string, string> = {
  implementation: "OTM Implementation",
  cloud_migration: "Cloud Migration",
  ams: "AMS Managed Services",
  release_cert: "Release Certification",
  rate_maintenance: "Rate Maintenance",
  data_migration: "Data Migration",
  custom_dev: "Custom Development",
};

interface TemplatePhase {
  name: string; sequence: number; description?: string; durationWeeks: number;
  milestones?: { name: string; durationWeeks: number; isBillable?: boolean; clientAction?: string; tasks?: { name: string; estimatedHours?: number; isClientAction?: boolean; }[]; }[];
  conditions?: string[];
}

interface Template {
  id: number; name: string; type: string; description?: string;
  phases?: TemplatePhase[]; conditions?: Record<string, boolean>;
}

function countTotals(template: Template) {
  const phases = template.phases || [];
  let milestones = 0;
  let tasks = 0;
  let weeks = 0;
  phases.forEach(ph => {
    weeks += ph.durationWeeks || 0;
    (ph.milestones || []).forEach(ms => {
      milestones++;
      tasks += (ms.tasks || []).length;
    });
  });
  return { phases: phases.length, milestones, tasks, weeks };
}

function CreateProjectModal({ template, onClose, onCreated }: { template: Template; onClose: () => void; onCreated: (id: number) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [form, setForm] = useState({ name: `${template.name} — New Project`, accountId: "", pmName: "", startDate: new Date().toISOString().split("T")[0] });
  // roleAssignments: role → { resourceId, resourceName } or null for skipped
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loadingStep2, setLoadingStep2] = useState(false);

  useEffect(() => {
    fetch(`${API}/accounts`).then(r => r.json()).then(setAccounts).catch(() => {});
  }, []);

  const goToStep2 = async () => {
    if (!form.name.trim() || !form.accountId) { setError("Project name and account are required"); return; }
    setError("");
    setLoadingStep2(true);
    try {
      const [roleData, resourceData] = await Promise.all([
        fetch(`${API}/templates/${template.id}/roles`).then(r => r.json()),
        fetch(`${API}/resources`).then(r => r.json()),
      ]);
      setRoles(Array.isArray(roleData) ? roleData : []);
      setResources(Array.isArray(resourceData) ? resourceData.filter((r: any) => r.status !== "unavailable") : []);
      // Skip step 2 if no roles found — go straight to create
      if (!Array.isArray(roleData) || roleData.length === 0) {
        await createProject({});
        return;
      }
      setStep(2);
    } catch { setError("Failed to load role data. Please try again."); }
    finally { setLoadingStep2(false); }
  };

  const createProject = async (assignments: Record<string, string>) => {
    setSubmitting(true);
    setError("");
    try {
      // Build roleAssignments payload: role → { resourceId, resourceName }
      const resolvedAssignments: Record<string, { resourceId: number; resourceName: string }> = {};
      for (const [role, resId] of Object.entries(assignments)) {
        if (!resId) continue; // skipped
        const resource = resources.find((r: any) => String(r.id) === resId);
        if (resource) {
          resolvedAssignments[role] = { resourceId: resource.id, resourceName: resource.name };
        }
      }

      const res = await fetch(`${API}/templates/${template.id}/create-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          accountId: Number(form.accountId),
          roleAssignments: resolvedAssignments,
        }),
      });
      const data = await res.json();
      if (data.projectId) onCreated(data.projectId);
      else setError(data.error || "Failed to create project. Please try again.");
    } catch { setError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  };

  const handleCreate = () => createProject(roleAssignments);

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-bold text-gray-900 text-lg">Create project from template</h3>
            <span className="ml-auto text-xs font-medium text-gray-400">Step {step} of {roles.length > 0 || step === 2 ? 2 : 1}</span>
          </div>
          <p className="text-sm text-gray-500">Using: {template.name}</p>
          {/* Step indicator */}
          <div className="flex gap-2 mt-3">
            {[1, 2].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? "bg-blue-500" : "bg-gray-200"}`} />
            ))}
          </div>
        </div>

        {/* Step 1: Project details */}
        {step === 1 && (
          <>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project name <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account <span className="text-red-500">*</span></label>
                <select value={form.accountId} onChange={e => setForm(p => ({ ...p, accountId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select account…</option>
                  {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Manager</label>
                <input type="text" value={form.pmName} onChange={e => setForm(p => ({ ...p, pmName: e.target.value }))}
                  placeholder="e.g. Sarah Chen"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
              <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">Cancel</button>
              <button onClick={goToStep2} disabled={loadingStep2}
                className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50">
                {loadingStep2 ? "Loading…" : "Next →"}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Role assignment */}
        {step === 2 && (
          <>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Assign team members to each role used in this template. All roles are optional — leave blank to assign later.
              </p>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {roles.map(role => (
                  <div key={role} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{role}</p>
                    </div>
                    <select
                      value={roleAssignments[role] ?? ""}
                      onChange={e => setRoleAssignments(prev => ({ ...prev, [role]: e.target.value }))}
                      className="w-52 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-shrink-0"
                    >
                      <option value="">— Skip / assign later —</option>
                      {resources.map((r: any) => (
                        <option key={r.id} value={String(r.id)}>
                          {r.name}{r.title ? ` · ${r.title}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{error}</p>}
            </div>
            <div className="p-4 border-t flex justify-between gap-2 bg-gray-50 rounded-b-2xl">
              <button onClick={() => { setStep(1); setError(""); }}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">
                ← Back
              </button>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">Cancel</button>
                <button onClick={handleCreate} disabled={submitting}
                  className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50">
                  {submitting ? "Creating…" : "Create Project"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TemplateDetail({ template, onClose }: { template: Template; onClose: () => void }) {
  const [, navigate] = useLocation();
  const { role } = useAuthRole();
  const canUse = hasPermission(role, "useTemplate");
  const [showCreate, setShowCreate] = useState(false);
  const totals = countTotals(template);
  const Icon = TEMPLATE_ICONS[template.type] || Package;
  const colorClass = TEMPLATE_COLORS[template.type] || TEMPLATE_COLORS.implementation;
  const phases = template.phases || [];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`bg-gradient-to-r ${colorClass.split(" ")[0]} ${colorClass.split(" ")[1]} p-6 text-foreground`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Icon size={24} className="text-foreground" />
              </div>
              <div>
                <p className="text-foreground/60 text-sm mb-1">{TYPE_LABELS[template.type] || template.type}</p>
                <h2 className="text-2xl font-bold">{template.name}</h2>
                {template.description && <p className="text-foreground/70 mt-1 text-sm">{template.description}</p>}
              </div>
            </div>
            <button onClick={onClose} className="text-foreground/50 hover:text-foreground text-lg font-bold">✕</button>
          </div>
          <div className="flex gap-6 mt-5">
            {[
              { val: totals.phases, label: "Phases" },
              { val: totals.milestones, label: "Milestones" },
              { val: totals.tasks, label: "Tasks" },
              { val: `${totals.weeks}w`, label: "Est. Duration" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl font-black">{s.val}</p>
                <p className="text-foreground/50 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {phases.length === 0 && <p className="text-muted-foreground text-center py-8">No phase structure defined.</p>}
          {phases.sort((a, b) => a.sequence - b.sequence).map((ph, phIdx) => (
            <div key={phIdx} className="border rounded-xl overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">Phase {ph.sequence}</span>
                    <h3 className="font-semibold">{ph.name}</h3>
                  </div>
                  {ph.description && <p className="text-xs text-muted-foreground mt-0.5">{ph.description}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold">{ph.durationWeeks}w</p>
                  <p className="text-xs text-muted-foreground">{(ph.milestones || []).length} milestones</p>
                </div>
              </div>
              {ph.conditions && ph.conditions.length > 0 && (
                <div className="px-4 py-2 bg-amber-50 border-b flex flex-wrap gap-2">
                  <span className="text-xs text-amber-600 font-medium">Conditional:</span>
                  {ph.conditions.map((c, i) => (
                    <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{c}</span>
                  ))}
                </div>
              )}
              <div className="divide-y">
                {(ph.milestones || []).map((ms, msIdx) => (
                  <div key={msIdx} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{ms.name}</p>
                          {ms.clientAction && <p className="text-xs text-orange-600 mt-0.5">{ms.clientAction}</p>}
                          {(ms.tasks || []).length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {(ms.tasks || []).slice(0, 4).map((t, ti) => (
                                <div key={ti} className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <div className="w-1 h-1 rounded-full bg-slate-300 flex-shrink-0" />
                                  {t.name}
                                  {t.estimatedHours && <span className="text-slate-400">({t.estimatedHours}h)</span>}
                                  {t.isClientAction && <span className="text-orange-500 text-xs">CLIENT</span>}
                                </div>
                              ))}
                              {(ms.tasks || []).length > 4 && <p className="text-xs text-muted-foreground pl-3">+{(ms.tasks || []).length - 4} more tasks</p>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground">{ms.durationWeeks}w</p>
                        {ms.isBillable && <span className="text-xs text-emerald-600 font-medium">Billable</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {template.conditions && Object.keys(template.conditions).length > 0 && (
            <div className="border rounded-xl p-4 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Conditional Toggles</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(template.conditions).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    {v ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Clock size={14} className="text-muted-foreground" />}
                    <span className="text-muted-foreground">{k.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-muted/20 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors">Close</button>
          {canUse && (
            <button onClick={() => setShowCreate(true)}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium">
              Use Template
            </button>
          )}
        </div>
      </div>
      {showCreate && (
        <CreateProjectModal
          template={template}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { onClose(); navigate(`/projects/${id}`); }}
        />
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const { role } = useAuthRole();
  const canUse = hasPermission(role, "useTemplate");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Template | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    fetch(`${API}/templates`)
      .then(r => r.json())
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  const types = ["all", ...Array.from(new Set(templates.map(t => t.type)))];
  const filtered = typeFilter === "all" ? templates : templates.filter(t => t.type === typeFilter);

  if (loading) return (
    <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1,2,3,4,5,6].map(i=><div key={i} className="h-48 bg-muted rounded-xl animate-pulse"/>)}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {selected && <TemplateDetail template={selected} onClose={() => setSelected(null)} />}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Project Blueprints</h1>
        <p className="text-muted-foreground mt-1">Pre-built delivery frameworks for OTM engagements. Select a blueprint to preview its phase, milestone, and task structure, then launch a new project from it.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {types.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${typeFilter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {t === "all" ? "All Templates" : TYPE_LABELS[t] || t}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(template => {
          const totals = countTotals(template);
          const Icon = TEMPLATE_ICONS[template.type] || Package;
          const colorClass = TEMPLATE_COLORS[template.type] || TEMPLATE_COLORS.implementation;
          return (
            <button key={template.id} onClick={() => setSelected(template)}
              className="text-left rounded-2xl border overflow-hidden hover:shadow-lg transition-all group hover:-translate-y-0.5">
              <div className={`bg-gradient-to-br ${colorClass.split(" ").slice(0,2).join(" ")} p-5`}>
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon size={20} className="text-foreground" />
                  </div>
                  <ChevronRight size={16} className="text-foreground/40 group-hover:text-foreground/80 transition-colors" />
                </div>
                <h3 className="text-foreground font-bold text-lg mt-3 leading-tight">{template.name}</h3>
                <p className="text-foreground/60 text-xs mt-1">{TYPE_LABELS[template.type] || template.type}</p>
              </div>
              <div className="p-4 bg-white">
                {template.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{template.description}</p>}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    {val:totals.phases,label:"Phases"},
                    {val:totals.milestones,label:"Milestones"},
                    {val:totals.tasks,label:"Tasks"},
                    {val:`${totals.weeks}w`,label:"Duration"},
                  ].map((s,i)=>(
                    <div key={i} className="text-center">
                      <p className="text-base font-bold">{s.val}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
                {(template.phases||[]).length > 0 && (
                  <div className="flex gap-1 mt-3 flex-wrap">
                    {(template.phases||[]).slice(0,4).map((ph,i)=>(
                      <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{ph.name}</span>
                    ))}
                    {(template.phases||[]).length>4 && <span className="text-xs text-muted-foreground">+{(template.phases||[]).length-4} more</span>}
                  </div>
                )}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16 text-muted-foreground">
            <Package size={32} className="mx-auto mb-3 opacity-30" />
            <p>No templates match the selected filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
