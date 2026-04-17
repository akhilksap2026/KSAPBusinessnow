import React, { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { format } from "date-fns";
import { ChevronLeft, MapPin, Clock, Briefcase, Star, CheckCircle2, AlertTriangle, Calendar, TrendingUp, Pencil, Plus, Trash2, Save, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useAuthRole, useCanSee } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL + "api";

const PRACTICE_LABELS: Record<string, string> = {
  implementation: "Implementation", cloud_migration: "Cloud Migration", ams: "AMS",
  qa: "QA / Certification", data_migration: "Data Migration", custom_dev: "Custom Dev",
  rate_maintenance: "Rate Maintenance", solution_architect: "Solution Architecture",
  integration: "Integration", management: "Management",
};

function UtilBar({ pct, target }: { pct: number; target: number }) {
  const color = pct > 110 ? "bg-red-500" : pct > target ? "bg-amber-400" : pct > target - 20 ? "bg-blue-500" : "bg-emerald-400";
  return (
    <div className="w-full bg-muted rounded-full h-3 relative">
      <div className={`h-3 rounded-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      <div className="absolute top-0 bottom-0 w-0.5 bg-slate-400" style={{ left: `${target}%` }} title={`Target: ${target}%`} />
    </div>
  );
}

type SkillYear = { skill: string; years: number };

function SkillsMatrix({ resourceId, initial, skills }: { resourceId: number; initial: SkillYear[]; skills: string[] }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Array<{ skill: string; years: string }>>(
    (initial && initial.length > 0)
      ? initial.map(s => ({ skill: s.skill, years: String(s.years) }))
      : skills.map(s => ({ skill: s, years: "" }))
  );
  const [saving, setSaving] = useState(false);

  const addRow = () => setRows(r => [...r, { skill: "", years: "" }]);
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));
  const setField = (i: number, f: "skill" | "years", v: string) =>
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [f]: v } : row));

  const save = async () => {
    setSaving(true);
    try {
      const payload = rows.filter(r => r.skill.trim()).map(r => ({ skill: r.skill.trim(), years: parseFloat(r.years) || 0 }));
      const res = await fetch(`${API}/resources/${resourceId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillsWithYears: payload }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "Skills updated" });
      setEditing(false);
    } catch { toast({ title: "Error", description: "Could not save skills", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const displayRows = (initial && initial.length > 0) ? initial : skills.map(s => ({ skill: s, years: 0 }));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Skills & Experience</p>
        {!editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Pencil size={11} /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        displayRows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No skills recorded.</p>
        ) : (
          <table className="w-full text-xs border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Skill</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Experience</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((s, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-1.5">{s.skill}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">
                    {s.years > 0 ? `${s.years} yr${s.years !== 1 ? "s" : ""}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : (
        <div className="space-y-2 border rounded-xl p-3">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input placeholder="Skill name" value={row.skill} onChange={e => setField(i, "skill", e.target.value)}
                className="flex-1 h-7 text-xs border rounded px-2 bg-background" />
              <input type="number" min="0" max="40" placeholder="Yrs" value={row.years}
                onChange={e => setField(i, "years", e.target.value)}
                className="w-16 h-7 text-xs border rounded px-2 bg-background" />
              <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-destructive">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={addRow} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Plus size={10} /> Add skill
            </button>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setEditing(false)} className="h-6 px-2 text-xs rounded bg-muted text-muted-foreground flex items-center gap-1">
                <X size={10} /> Cancel
              </button>
              <button onClick={save} disabled={saving} className="h-6 px-2 text-xs rounded bg-primary text-primary-foreground flex items-center gap-1 disabled:opacity-50">
                <Save size={10} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResourceDetail() {
  const params = useParams();
  const [, navigate] = useLocation();
  const resourceId = Number(params.id);
  const { role } = useAuthRole();
  const canSeeCost = useCanSee("resource_costs");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "allocations" | "workload" | "history">("overview");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (role) headers["x-user-role"] = role;
      const r = await fetch(`${API}/resources/${resourceId}/full`, { headers });
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [resourceId, role]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="p-6 space-y-4">
      <div className="h-32 bg-muted rounded-xl animate-pulse" />
      <div className="h-64 bg-muted rounded-xl animate-pulse" />
    </div>
  );
  if (!data) return <div className="p-8 text-center text-muted-foreground">Resource not found.</div>;

  const { resource, activeAllocations, softAllocations, pastAllocations, weeklyLoad, utilizationTrend, currentUtilization } = data;

  const initials = resource.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2);
  const target = resource.utilizationTarget || 80;
  const isOver = currentUtilization > 100;
  const isBench = currentUtilization < 20;
  const band = currentUtilization === 0 ? "bench" : currentUtilization < 20 ? "bench" : currentUtilization <= target ? "available" : currentUtilization <= target + 15 ? "optimal" : currentUtilization <= 110 ? "booked" : "overbooked";
  const bandColor: Record<string, string> = { bench: "text-slate-500", available: "text-emerald-600", optimal: "text-blue-600", booked: "text-amber-600", overbooked: "text-red-600" };
  const empColors: Record<string, string> = { employee: "bg-slate-100 text-slate-700", contractor: "bg-purple-100 text-purple-700", partner: "bg-amber-100 text-amber-700" };

  const updateEmploymentType = async (value: string) => {
    await fetch(`${API}/resources/${resourceId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employmentType: value }),
    });
    load();
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <button onClick={() => navigate("/resources")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ChevronLeft size={14} />Back to Resources
        </button>
        <div className="flex items-start gap-5">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0 ${isOver ? "bg-red-100 text-red-700" : isBench ? "bg-slate-100 text-slate-500" : "bg-blue-100 text-blue-700"}`}>
            {initials}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{resource.name}</h1>
              <select
                value={resource.employmentType || "employee"}
                onChange={e => updateEmploymentType(e.target.value)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring ${empColors[resource.employmentType] || empColors.employee}`}
                title="Employment type — click to change"
              >
                <option value="employee">employee</option>
                <option value="contractor">contractor</option>
                <option value="partner">partner</option>
              </select>
              {isOver && <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertTriangle size={12} />Over-allocated</span>}
            </div>
            <p className="text-muted-foreground">{resource.title}</p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="text-sm font-medium">{PRACTICE_LABELS[resource.practiceArea] || resource.practiceArea}</span>
              {resource.location && <span className="text-sm text-muted-foreground flex items-center gap-1"><MapPin size={12} />{resource.location}</span>}
              {resource.timezone && <span className="text-sm text-muted-foreground flex items-center gap-1"><Clock size={12} />{resource.timezone}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`text-3xl font-black ${bandColor[band]}`}>{currentUtilization}%</div>
            <p className="text-xs text-muted-foreground capitalize">{band}</p>
            <div className="w-32 mt-2"><UtilBar pct={currentUtilization} target={target} /></div>
            <p className="text-xs text-muted-foreground mt-1">Target: {target}%</p>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{activeAllocations.length}</p>
          <p className="text-xs text-muted-foreground">Active Projects</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{softAllocations.length}</p>
          <p className="text-xs text-muted-foreground">Soft Allocations</p>
        </div>
        {resource.hourlyRate && (
          <div className="bg-muted/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">${resource.hourlyRate}</p>
            <p className="text-xs text-muted-foreground">Bill Rate/hr</p>
          </div>
        )}
        {resource.costRate && canSeeCost && (
          <div className="bg-muted/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{resource.hourlyRate ? Math.round(((resource.hourlyRate - resource.costRate) / resource.hourlyRate) * 100) : "—"}%</p>
            <p className="text-xs text-muted-foreground">Margin</p>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {(["overview", "allocations", "workload", "history"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "overview" ? "Profile" : t === "allocations" ? `Allocations (${activeAllocations.length})` : t === "workload" ? "12-Week Load" : "History"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            {resource.bio && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">About</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{resource.bio}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">OTM Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {(resource.skills || []).map((s: string) => (
                  <span key={s} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg">{s}</span>
                ))}
                {(resource.skills || []).length === 0 && <p className="text-xs text-muted-foreground">No skills listed.</p>}
              </div>
            </div>
            {/* Skills matrix with years */}
            <SkillsMatrix
              resourceId={resourceId}
              initial={resource.skillsWithYears || []}
              skills={resource.skills || []}
            />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">OTM Specializations</p>
              <div className="flex flex-wrap gap-1.5">
                {(resource.specialties || []).map((s: string) => (
                  <span key={s} className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2 py-1 rounded-lg"><Star size={9} className="inline mr-1" />{s}</span>
                ))}
                {(resource.specialties || []).length === 0 && <p className="text-xs text-muted-foreground">No specializations listed.</p>}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Certifications</p>
              {(resource.certifications || []).map((c: string) => (
                <div key={c} className="flex items-center gap-2 py-1"><CheckCircle2 size={13} className="text-emerald-500" /><span className="text-sm">{c}</span></div>
              ))}
              {(resource.certifications || []).length === 0 && <p className="text-xs text-muted-foreground">No certifications on record.</p>}
            </div>
            <Separator />
            <div className="space-y-2">
              {resource.availableFrom && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Available from</span>
                  <span className="font-medium">{format(new Date(resource.availableFrom), "MMM d, yyyy")}</span>
                </div>
              )}
              {resource.hourlyRate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Bill rate</span>
                  <span className="font-medium">${resource.hourlyRate}/hr</span>
                </div>
              )}
              {resource.costRate && canSeeCost && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cost rate</span>
                  <span className="font-medium">${resource.costRate}/hr</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "allocations" && (
        <div className="space-y-3">
          {activeAllocations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Active (Hard) Allocations</p>
              {activeAllocations.map((a: any) => (
                <div key={a.id} className="border rounded-xl p-4 mb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{a.projectName}</p>
                      <p className="text-sm text-muted-foreground">{a.role}</p>
                      {(a.startDate || a.endDate) && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Calendar size={10} />{a.startDate ? format(new Date(a.startDate), "MMM d") : "?"} → {a.endDate ? format(new Date(a.endDate), "MMM d, yyyy") : "Ongoing"}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-blue-600">{a.allocationPct}%</p>
                      {a.hoursPerWeek && <p className="text-xs text-muted-foreground">{a.hoursPerWeek}h/wk</p>}
                    </div>
                  </div>
                  <div className="mt-2"><Progress value={a.allocationPct} className="h-1.5" /></div>
                </div>
              ))}
            </div>
          )}
          {softAllocations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Soft Allocations (Pipeline / Tentative)</p>
              {softAllocations.map((a: any) => (
                <div key={a.id} className="border border-dashed rounded-xl p-4 mb-2 bg-muted/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{a.projectName}</p>
                      <p className="text-sm text-muted-foreground">{a.role}</p>
                      {a.notes && <p className="text-xs text-amber-600 mt-1">{a.notes}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-amber-500">{a.allocationPct}%</p>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">soft</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeAllocations.length === 0 && softAllocations.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No current allocations.</p>
          )}
        </div>
      )}

      {tab === "workload" && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Weekly Load — Next 12 Weeks</p>
          <div className="grid grid-cols-6 gap-2">
            {weeklyLoad.map((w: any) => {
              const bar = Math.min(w.hard, 100);
              const softBar = Math.min(w.softLoad || 0, 100 - bar);
              const isFull = w.hard >= (resource.utilizationTarget || 80);
              return (
                <div key={w.week} className="text-center">
                  <div className="h-20 bg-muted rounded-lg flex flex-col-reverse overflow-hidden mb-1">
                    {bar > 0 && <div className={`${isFull ? "bg-amber-400" : "bg-blue-400"} transition-all`} style={{ height: `${bar}%` }} />}
                    {softBar > 0 && <div className="bg-amber-200" style={{ height: `${softBar}%` }} />}
                  </div>
                  <p className="text-xs font-bold">{w.hard}%</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(w.week), "MMM d")}</p>
                  {w.available > 0 && <p className="text-xs text-emerald-600">+{w.available}% free</p>}
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-400" /><span className="text-muted-foreground">Hard allocation</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-200" /><span className="text-muted-foreground">Soft allocation</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-400" /><span className="text-muted-foreground">At capacity</span></div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Timesheet Trend</p>
          {utilizationTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground">No timesheet history.</p>
          ) : (
            <div className="space-y-2">
              {utilizationTrend.map((t: any) => (
                <div key={t.week} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20">{format(new Date(t.week), "MMM d")}</span>
                  <div className="flex-1 bg-muted rounded-full h-5 relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 bg-blue-400 rounded-full flex items-center justify-end pr-2" style={{ width: `${Math.min((t.billable / 40) * 100, 100)}%` }}>
                      <span className="text-xs text-foreground font-bold">{t.billable}h</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-right">{t.hours}h total</span>
                </div>
              ))}
            </div>
          )}
          {pastAllocations.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Past Projects</p>
              {pastAllocations.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                  <span className="text-muted-foreground">{a.projectName}</span>
                  <span className="text-xs text-muted-foreground">{a.role} · {a.endDate ? format(new Date(a.endDate), "MMM yyyy") : "ongoing"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
