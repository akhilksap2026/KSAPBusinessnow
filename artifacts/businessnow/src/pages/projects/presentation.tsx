import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { format, differenceInDays } from "date-fns";
import { CheckCircle2, Circle, Users, Calendar, ChevronLeft, ExternalLink, Clock } from "lucide-react";

const API = import.meta.env.BASE_URL + "api";

interface Phase { id: number; name: string; sequence: number; startDate?: string; endDate?: string; status: string; description?: string; }
interface Milestone { id: number; name: string; status: string; phase?: string; phaseId?: number; dueDate?: string; startDate?: string; ownerName?: string; isBillable?: boolean; billableAmount?: number; clientAction?: string; sequence?: number; description?: string; }
interface Task { id: number; name: string; assignedToName?: string; dueDate?: string; isClientAction?: boolean; status: string; }

const PHASE_GRADIENTS = [
  "from-violet-600 to-violet-800",
  "from-blue-600 to-blue-800",
  "from-cyan-600 to-cyan-800",
  "from-teal-600 to-teal-800",
  "from-emerald-600 to-emerald-800",
  "from-amber-600 to-amber-800",
];

export default function ProjectPresentation() {
  const params = useParams();
  const [, navigate] = useLocation();
  const projectId = Number(params.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    fetch(`${API}/projects/${projectId}/presentation`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") setSlide(s => Math.min(s + 1, totalSlides - 1));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") setSlide(s => Math.max(s - 1, 0));
      if (e.key === "Escape") navigate(`/projects/${projectId}`);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [projectId]);

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-foreground text-xl animate-pulse">Loading presentation...</div>
    </div>
  );
  if (!data) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-foreground">Project not found.</div>
  );

  const { project, phases, milestones, clientActions, generatedAt } = data;

  const typeLabel: Record<string, string> = {
    implementation: "OTM Implementation", cloud_migration: "Cloud Migration", ams: "AMS Managed Services",
    release_cert: "Release Certification", rate_maintenance: "Rate Maintenance", data_migration: "Data Migration",
    custom_dev: "Custom Development",
  };

  // Build slides: cover + overview + one per phase + client actions + closing
  const slides = [
    { type: "cover" },
    { type: "overview" },
    ...phases.map((ph: Phase, i: number) => ({ type: "phase", phase: ph, index: i })),
    ...(clientActions.length > 0 ? [{ type: "client_actions" }] : []),
    { type: "closing" },
  ];
  const totalSlides = slides.length;
  const currentSlide = slides[slide];

  const startStr = project.startDate || project.baselineStartDate;
  const endStr = project.endDate || project.goLiveDate;
  const duration = startStr && endStr ? `${differenceInDays(new Date(endStr), new Date(startStr))} days` : "TBD";

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/40 border-b border-white/10 flex-shrink-0">
        <button onClick={() => navigate(`/projects/${projectId}`)}
          className="flex items-center gap-2 text-foreground/60 hover:text-foreground text-sm transition-colors">
          <ChevronLeft size={16} />Back to project
        </button>
        <div className="flex items-center gap-3">
          <span className="text-foreground/40 text-xs">CONFIDENTIAL</span>
          <div className="flex gap-1">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setSlide(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === slide ? "bg-white scale-125" : "bg-white/30 hover:bg-white/60"}`} />
            ))}
          </div>
          <span className="text-foreground/40 text-xs">{slide + 1} / {totalSlides}</span>
        </div>
        <div className="text-foreground/40 text-xs">← → to navigate · ESC to exit</div>
      </div>

      {/* Slide area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-5xl mx-auto">

          {/* Cover slide */}
          {currentSlide.type === "cover" && (
            <div className="text-center space-y-8">
              <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 text-sm font-medium mb-4">
                {typeLabel[project.type] || project.type}
              </div>
              <h1 className="text-6xl font-black text-foreground tracking-tight leading-tight">{project.name}</h1>
              <p className="text-2xl text-foreground/60 font-light">{project.accountName}</p>
              <div className="flex items-center justify-center gap-8 mt-12">
                {project.pmName && (
                  <div className="text-center">
                    <p className="text-foreground/40 text-xs uppercase tracking-wider mb-1">Project Manager</p>
                    <p className="text-foreground text-lg font-semibold">{project.pmName}</p>
                  </div>
                )}
                {startStr && (
                  <div className="text-center">
                    <p className="text-foreground/40 text-xs uppercase tracking-wider mb-1">Start Date</p>
                    <p className="text-foreground text-lg font-semibold">{format(new Date(startStr), "MMMM d, yyyy")}</p>
                  </div>
                )}
                {project.goLiveDate && (
                  <div className="text-center">
                    <p className="text-foreground/40 text-xs uppercase tracking-wider mb-1">Go Live</p>
                    <p className="text-emerald-400 text-lg font-bold">{format(new Date(project.goLiveDate), "MMMM d, yyyy")}</p>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-foreground/40 text-xs uppercase tracking-wider mb-1">Duration</p>
                  <p className="text-foreground text-lg font-semibold">{duration}</p>
                </div>
              </div>
              <div className="mt-16 text-foreground/20 text-xs">Prepared {format(new Date(generatedAt), "MMMM d, yyyy")}</div>
            </div>
          )}

          {/* Overview slide */}
          {currentSlide.type === "overview" && (
            <div className="space-y-8">
              <div>
                <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">Engagement Overview</p>
                <h2 className="text-4xl font-bold text-foreground">{project.name}</h2>
              </div>
              {project.description && (
                <p className="text-foreground/70 text-lg leading-relaxed max-w-3xl">{project.description}</p>
              )}
              <div className="grid grid-cols-3 gap-4 mt-8">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                  <p className="text-4xl font-black text-foreground mb-2">{phases.length}</p>
                  <p className="text-foreground/50 text-sm">Delivery Phases</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                  <p className="text-4xl font-black text-foreground mb-2">{milestones.length}</p>
                  <p className="text-foreground/50 text-sm">Key Milestones</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                  <p className="text-4xl font-black text-emerald-400 mb-2">{project.completionPct || 0}%</p>
                  <p className="text-foreground/50 text-sm">Complete</p>
                </div>
              </div>
              {phases.length > 0 && (
                <div className="mt-8">
                  <p className="text-foreground/40 text-xs uppercase tracking-wider mb-4">Phase Overview</p>
                  <div className="flex gap-3">
                    {phases.map((ph: Phase, i: number) => (
                      <div key={ph.id} className={`flex-1 rounded-xl p-4 bg-gradient-to-br ${PHASE_GRADIENTS[i % PHASE_GRADIENTS.length]}`}>
                        <p className="text-foreground font-bold text-sm">{ph.name}</p>
                        {ph.startDate && ph.endDate && (
                          <p className="text-foreground/60 text-xs mt-1">
                            {format(new Date(ph.startDate), "MMM d")} – {format(new Date(ph.endDate), "MMM d")}
                          </p>
                        )}
                        <div className={`mt-2 text-xs font-medium ${ph.status === "completed" ? "text-emerald-300" : ph.status === "in_progress" ? "text-blue-200" : "text-foreground/50"}`}>
                          {ph.status.replace(/_/g, " ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Phase slides */}
          {currentSlide.type === "phase" && (() => {
            const ph: Phase = (currentSlide as any).phase;
            const phIdx: number = (currentSlide as any).index;
            const phaseMilestones = milestones.filter((m: Milestone) => m.phaseId === ph.id || m.phase === ph.name);
            const grad = PHASE_GRADIENTS[phIdx % PHASE_GRADIENTS.length];
            const done = phaseMilestones.filter((m: Milestone) => m.status === "completed").length;
            const total = phaseMilestones.length;
            return (
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`inline-block px-3 py-1 rounded-full text-foreground text-xs font-semibold bg-gradient-to-r ${grad} mb-3`}>
                      Phase {phIdx + 1} of {phases.length}
                    </div>
                    <h2 className="text-4xl font-bold text-foreground">{ph.name}</h2>
                    {ph.description && <p className="text-foreground/60 text-lg mt-2">{ph.description}</p>}
                  </div>
                  {(ph.startDate || ph.endDate) && (
                    <div className="text-right">
                      {ph.startDate && <p className="text-foreground/40 text-sm">{format(new Date(ph.startDate), "MMMM d, yyyy")}</p>}
                      {ph.endDate && <p className="text-foreground text-sm font-medium">→ {format(new Date(ph.endDate), "MMMM d, yyyy")}</p>}
                    </div>
                  )}
                </div>

                {total > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-foreground/40 text-xs uppercase tracking-wider">Milestone Progress</p>
                      <span className="text-foreground/60 text-sm">{done}/{total}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className={`h-2 rounded-full bg-gradient-to-r ${grad}`} style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
                    </div>
                  </div>
                )}

                <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: `repeat(${Math.min(phaseMilestones.length, 2)}, 1fr)` }}>
                  {phaseMilestones.map((ms: Milestone) => {
                    const isDone = ms.status === "completed";
                    const today = new Date().toISOString().split("T")[0];
                    const isOverdue = ms.dueDate && ms.dueDate < today && !isDone;
                    return (
                      <div key={ms.id} className={`rounded-xl border p-4 ${isDone ? "bg-emerald-500/10 border-emerald-500/30" : isOverdue ? "bg-red-500/10 border-red-500/30" : "bg-white/5 border-white/10"}`}>
                        <div className="flex items-start gap-3">
                          {isDone ? <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" /> : <Circle size={18} className="text-foreground/30 flex-shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold ${isDone ? "text-emerald-300" : "text-foreground"}`}>{ms.name}</p>
                            {ms.description && <p className="text-foreground/50 text-sm mt-1">{ms.description}</p>}
                            <div className="flex items-center gap-3 mt-2">
                              {ms.ownerName && <span className="text-foreground/40 text-xs flex items-center gap-1"><Users size={10} />{ms.ownerName}</span>}
                              {ms.dueDate && <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-400" : "text-foreground/40"}`}><Calendar size={10} />{format(new Date(ms.dueDate), "MMM d, yyyy")}</span>}
                              {ms.isBillable && ms.billableAmount && <span className="text-emerald-400 text-xs font-bold">${(ms.billableAmount / 1000).toFixed(0)}k</span>}
                            </div>
                            {ms.clientAction && (
                              <div className="mt-2 flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-2 py-1">
                                <Users size={11} className="text-orange-400" />
                                <p className="text-orange-300 text-xs">{ms.clientAction}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {phaseMilestones.length === 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-foreground/40">No milestones defined for this phase.</div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Client actions slide */}
          {currentSlide.type === "client_actions" && (
            <div className="space-y-6">
              <div>
                <p className="text-orange-400 text-sm font-semibold uppercase tracking-widest mb-3">Your Responsibilities</p>
                <h2 className="text-4xl font-bold text-foreground">Client Actions Required</h2>
                <p className="text-foreground/50 text-lg mt-2">The following items require action from {project.accountName}.</p>
              </div>
              <div className="grid gap-3">
                {clientActions.map((t: Task) => {
                  const today = new Date().toISOString().split("T")[0];
                  const isOverdue = t.dueDate && t.dueDate < today && t.status !== "done";
                  const isDone = t.status === "done";
                  return (
                    <div key={t.id} className={`flex items-center gap-4 rounded-xl border p-4 ${isDone ? "bg-emerald-500/10 border-emerald-500/30" : isOverdue ? "bg-red-500/10 border-red-500/30" : "bg-orange-500/10 border-orange-500/20"}`}>
                      {isDone ? <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0" /> : <Clock size={20} className="text-orange-400 flex-shrink-0" />}
                      <div className="flex-1">
                        <p className={`font-semibold ${isDone ? "text-emerald-300 line-through" : "text-foreground"}`}>{t.name}</p>
                        {t.assignedToName && <p className="text-foreground/50 text-sm">{t.assignedToName}</p>}
                      </div>
                      {t.dueDate && (
                        <div className="text-right">
                          <p className={`text-sm font-medium ${isOverdue ? "text-red-400" : "text-foreground/60"}`}>{format(new Date(t.dueDate), "MMM d, yyyy")}</p>
                          {isOverdue && <p className="text-red-400 text-xs">Overdue</p>}
                        </div>
                      )}
                      <div className={`text-xs px-2 py-1 rounded-full font-medium ${isDone ? "bg-emerald-500/20 text-emerald-300" : isOverdue ? "bg-red-500/20 text-red-300" : "bg-orange-500/20 text-orange-300"}`}>
                        {isDone ? "Complete" : isOverdue ? "Overdue" : "Pending"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Closing slide */}
          {currentSlide.type === "closing" && (
            <div className="text-center space-y-8">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} className="text-emerald-400" />
              </div>
              <h2 className="text-5xl font-black text-foreground">Questions?</h2>
              <p className="text-foreground/50 text-xl max-w-xl mx-auto">Thank you for your time. Let's align on next steps and milestones.</p>
              {project.pmName && (
                <div className="mt-12 inline-block bg-white/5 border border-white/10 rounded-2xl px-8 py-6">
                  <p className="text-foreground/40 text-xs uppercase tracking-wider mb-2">Your Point of Contact</p>
                  <p className="text-foreground text-2xl font-bold">{project.pmName}</p>
                  <p className="text-foreground/50 mt-1">{project.accountName} · BUSINESSNow Consulting</p>
                </div>
              )}
              <div className="mt-8 text-foreground/20 text-xs">This presentation is confidential and intended for {project.accountName} only.</div>
            </div>
          )}
        </div>
      </div>

      {/* Nav arrows */}
      <div className="flex justify-between px-6 py-4 flex-shrink-0">
        <button onClick={() => setSlide(s => Math.max(s - 1, 0))} disabled={slide === 0}
          className="flex items-center gap-2 text-foreground/50 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-sm">
          <ChevronLeft size={16} />Previous
        </button>
        <button onClick={() => setSlide(s => Math.min(s + 1, totalSlides - 1))} disabled={slide === totalSlides - 1}
          className="flex items-center gap-2 text-foreground/50 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-sm">
          Next<ExternalLink size={14} className="rotate-90" />
        </button>
      </div>
    </div>
  );
}
