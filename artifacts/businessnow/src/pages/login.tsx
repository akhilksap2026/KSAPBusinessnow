import { useState } from "react";
import { useAuthRole, DEMO_USERS, ROLE_LABELS, type DemoUser } from "@/lib/auth";
import { useLocation } from "wouter";
import {
  Truck, ShieldCheck, LineChart, Layers, FolderKanban, Briefcase,
  Users, BadgeDollarSign, Handshake, UserCheck, Building2, Search,
  TrendingUp, Clock, CheckCircle2, AlertCircle, BarChart3, Zap,
} from "lucide-react";

const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin:              <ShieldCheck className="h-3 w-3" />,
  executive:          <LineChart className="h-3 w-3" />,
  delivery_director:  <Layers className="h-3 w-3" />,
  project_manager:    <FolderKanban className="h-3 w-3" />,
  consultant:         <Briefcase className="h-3 w-3" />,
  resource_manager:   <Users className="h-3 w-3" />,
  finance_lead:       <BadgeDollarSign className="h-3 w-3" />,
  sales:              <Handshake className="h-3 w-3" />,
  account_manager:    <UserCheck className="h-3 w-3" />,
  client_stakeholder: <Building2 className="h-3 w-3" />,
};

const ROLE_COLORS: Record<string, { bg: string; badge: string; icon: string; ring: string }> = {
  admin:              { bg: "bg-violet-500/20", badge: "bg-violet-500/20 text-violet-300", icon: "text-violet-400", ring: "ring-violet-500/30" },
  executive:          { bg: "bg-amber-500/20",  badge: "bg-amber-500/20 text-amber-300",  icon: "text-amber-400",  ring: "ring-amber-500/30"  },
  delivery_director:  { bg: "bg-sky-500/20",    badge: "bg-sky-500/20 text-sky-300",      icon: "text-sky-400",    ring: "ring-sky-500/30"    },
  project_manager:    { bg: "bg-blue-500/20",   badge: "bg-blue-500/20 text-blue-300",    icon: "text-blue-400",   ring: "ring-blue-500/30"   },
  consultant:         { bg: "bg-cyan-500/20",   badge: "bg-cyan-500/20 text-cyan-300",    icon: "text-cyan-400",   ring: "ring-cyan-500/30"   },
  resource_manager:   { bg: "bg-emerald-500/20",badge: "bg-emerald-500/20 text-emerald-300",icon:"text-emerald-400",ring:"ring-emerald-500/30"},
  finance_lead:       { bg: "bg-green-500/20",  badge: "bg-green-500/20 text-green-300",  icon: "text-green-400",  ring: "ring-green-500/30"  },
  sales:              { bg: "bg-orange-500/20", badge: "bg-orange-500/20 text-orange-300",icon: "text-orange-400", ring: "ring-orange-500/30" },
  account_manager:    { bg: "bg-rose-500/20",   badge: "bg-rose-500/20 text-rose-300",    icon: "text-rose-400",   ring: "ring-rose-500/30"   },
  client_stakeholder: { bg: "bg-slate-500/20",  badge: "bg-slate-500/20 text-slate-300",  icon: "text-slate-400",  ring: "ring-slate-500/30"  },
};

/* ── Floating module cards shown on the right panel ── */
const PREVIEW_CARDS = [
  {
    id: "projects",
    label: "Projects",
    icon: <FolderKanban className="h-3.5 w-3.5 text-blue-400" />,
    color: "from-blue-500/20 to-blue-600/10",
    border: "border-blue-500/30",
    items: [
      { dot: "bg-green-400", text: "GlobalTrans Migration", sub: "78% · On track" },
      { dot: "bg-amber-400", text: "Nexus TMS Upgrade",    sub: "51% · At risk"  },
      { dot: "bg-blue-400",  text: "Apex Route Optimisation",sub:"34% · Active"  },
    ],
    rotate: "-rotate-[8deg]",
    translate: "-translate-x-10 translate-y-0",
    zIndex: "z-10",
  },
  {
    id: "timesheets",
    label: "Timesheets",
    icon: <Clock className="h-3.5 w-3.5 text-cyan-400" />,
    color: "from-cyan-500/20 to-cyan-600/10",
    border: "border-cyan-500/30",
    items: [
      { dot: "bg-emerald-400", text: "6.5h logged today",    sub: "All submitted" },
      { dot: "bg-blue-400",    text: "3 pending approvals",  sub: "Review queue"  },
      { dot: "bg-amber-400",   text: "2 ETC overruns flagged",sub: "This week"   },
    ],
    rotate: "rotate-[4deg]",
    translate: "translate-x-10 translate-y-4",
    zIndex: "z-20",
  },
  {
    id: "resources",
    label: "Resources",
    icon: <Users className="h-3.5 w-3.5 text-emerald-400" />,
    color: "from-emerald-500/20 to-emerald-600/10",
    border: "border-emerald-500/30",
    items: [
      { dot: "bg-rose-400",    text: "Alex Okafor — 112%",  sub: "Overallocated" },
      { dot: "bg-green-400",   text: "Maria Santos — 65%",  sub: "Available"     },
      { dot: "bg-amber-400",   text: "Derek Tran — 88%",    sub: "Near capacity" },
    ],
    rotate: "-rotate-[3deg]",
    translate: "translate-x-6 translate-y-10",
    zIndex: "z-30",
  },
  {
    id: "finance",
    label: "Finance",
    icon: <BarChart3 className="h-3.5 w-3.5 text-amber-400" />,
    color: "from-amber-500/20 to-amber-600/10",
    border: "border-amber-500/30",
    items: [
      { dot: "bg-green-400", text: "$280k billed this month", sub: "Revenue"      },
      { dot: "bg-blue-400",  text: "4 invoices pending",      sub: "Outstanding"  },
      { dot: "bg-amber-400", text: "WIP: $34k unbilled",      sub: "To invoice"   },
    ],
    rotate: "rotate-[6deg]",
    translate: "-translate-x-6 translate-y-16",
    zIndex: "z-20",
  },
];

export default function Login() {
  const { setUser } = useAuthRole();
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<DemoUser | null>(null);
  const [search, setSearch] = useState("");
  const [entering, setEntering] = useState(false);

  const filtered = DEMO_USERS.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.title.toLowerCase().includes(q) ||
      ROLE_LABELS[u.role].toLowerCase().includes(q)
    );
  });

  const handleContinue = () => {
    if (!selected) return;
    setEntering(true);
    setTimeout(() => {
      setUser(selected);
      setLocation("/");
    }, 220);
  };

  return (
    <div
      className="min-h-[100dvh] flex"
      style={{ background: "linear-gradient(135deg, #060d1a 0%, #0a1829 50%, #091525 100%)" }}
    >

      {/* ═══════════════════════════════════════════════════════
          LEFT — Form panel (glass card)
      ═══════════════════════════════════════════════════════ */}
      <div className="relative flex flex-col justify-center w-full lg:w-[44%] xl:w-[40%] shrink-0 px-8 py-12 lg:px-12">

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, #60a5fa 1px, transparent 1px)", backgroundSize: "32px 32px" }}
        />

        {/* Glow orbs */}
        <div className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 65%)" }} />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 65%)" }} />

        <div className="relative z-10 w-full max-w-sm mx-auto">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div
              className="p-2.5 rounded-xl shadow-lg shadow-blue-500/20"
              style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)" }}
            >
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-white text-lg font-bold tracking-tight">BUSINESSNow</span>
              <p className="text-blue-400/60 text-[10px] font-medium tracking-widest uppercase -mt-0.5">Delivery Platform</p>
            </div>
          </div>

          {/* Glass card */}
          <div
            className="rounded-2xl border border-white/10 p-7 shadow-2xl shadow-black/40"
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <h1 className="text-xl font-bold text-white mb-1 tracking-tight">
              Sign in to your workspace
            </h1>
            <p className="text-sm text-blue-200/50 mb-6">
              Select a team member to continue as
            </p>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-300/40" />
              <input
                type="text"
                placeholder="Search by name or role…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
                onFocus={e => { e.currentTarget.style.border = "1px solid rgba(59,130,246,0.50)"; e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
                onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.10)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              />
            </div>

            {/* User list */}
            <div className="space-y-1 mb-4 max-h-[300px] overflow-y-auto pr-0.5 custom-scroll">
              {filtered.length === 0 && (
                <p className="text-sm text-blue-200/40 text-center py-6">No results for "{search}"</p>
              )}
              {filtered.map((user) => {
                const c = ROLE_COLORS[user.role];
                const isSel = selected?.id === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => setSelected(user)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 group"
                    style={{
                      background: isSel
                        ? "rgba(59,130,246,0.18)"
                        : "transparent",
                      border: isSel
                        ? "1px solid rgba(59,130,246,0.40)"
                        : "1px solid transparent",
                    }}
                    onMouseEnter={e => {
                      if (!isSel) {
                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                        (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,255,255,0.10)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSel) {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                        (e.currentTarget as HTMLElement).style.border = "1px solid transparent";
                      }
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ring-1 ${c.ring} ${isSel ? "bg-blue-500" : c.bg}`}
                    >
                      <span className={isSel ? "text-white" : "text-white/80"}>{user.initials}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-tight truncate ${isSel ? "text-blue-300" : "text-white/85"}`}>
                        {user.name}
                      </p>
                      <p className="text-[11px] text-white/35 mt-0.5 truncate">{user.title}</p>
                    </div>

                    {/* Role badge */}
                    <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${c.badge}`}>
                      <span className={c.icon}>{ROLE_ICONS[user.role]}</span>
                      <span className="hidden sm:inline">{ROLE_LABELS[user.role]}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="h-px mb-4" style={{ background: "rgba(255,255,255,0.07)" }} />

            {/* Selected preview */}
            {selected ? (
              <div
                className="mb-4 p-3 rounded-xl flex items-center gap-2.5"
                style={{ background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.25)" }}
              >
                <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {selected.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">{selected.name}</p>
                  <p className="text-[10px] text-blue-300/60">{selected.title} · {ROLE_LABELS[selected.role]}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-white/30 hover:text-white/70 transition-colors text-sm leading-none"
                >✕</button>
              </div>
            ) : (
              <div
                className="mb-4 p-3 rounded-xl flex items-center gap-2 text-xs text-white/30"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.08)" }}
              >
                <span className="text-blue-400/40">↑</span>
                Select a person from the list above
              </div>
            )}

            {/* Continue button */}
            <button
              onClick={handleContinue}
              disabled={!selected || entering}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 relative overflow-hidden"
              style={
                selected && !entering
                  ? {
                      background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
                      boxShadow: "0 4px 20px rgba(37,99,235,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
                      color: "white",
                      cursor: "pointer",
                    }
                  : {
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.25)",
                      cursor: "not-allowed",
                    }
              }
            >
              {entering
                ? <span className="flex items-center justify-center gap-2"><Zap className="h-3.5 w-3.5 animate-pulse" />Signing in…</span>
                : selected
                  ? `Continue as ${selected.name.split(" ")[0]}`
                  : "Select a person to continue"}
            </button>

            <p className="text-center text-[10px] text-white/20 mt-5">
              Demo Environment · {DEMO_USERS.length} users · All data is synthetic
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          RIGHT — Visual panel (hidden on mobile)
      ═══════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden">

        {/* Background layers */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #060d1a 0%, #091525 100%)" }} />

        {/* Large glow ring */}
        <div
          className="absolute w-[700px] h-[700px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, rgba(6,182,212,0.06) 40%, transparent 70%)",
            top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          }}
        />

        {/* Outer ring stroke */}
        <div
          className="absolute w-[580px] h-[580px] rounded-full"
          style={{
            border: "1px solid rgba(59,130,246,0.10)",
            top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          }}
        />
        <div
          className="absolute w-[440px] h-[440px] rounded-full"
          style={{
            border: "1px solid rgba(59,130,246,0.07)",
            top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          }}
        />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle, #60a5fa 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        />

        {/* ── Floating module cards ── */}
        <div className="relative w-[500px] h-[520px]">
          {PREVIEW_CARDS.map((card, i) => (
            <div
              key={card.id}
              className={`absolute rounded-2xl overflow-hidden shadow-2xl shadow-black/60 ${card.rotate} ${card.translate} ${card.zIndex}`}
              style={{
                width: "260px",
                background: "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.10)",
                top: `${i * 100}px`,
                left: `${i % 2 === 0 ? 30 : 120}px`,
              }}
            >
              {/* Card header */}
              <div
                className={`px-4 py-3 flex items-center gap-2.5 border-b bg-gradient-to-r ${card.color} ${card.border}`}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div
                  className="p-1.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  {card.icon}
                </div>
                <span className="text-white/85 text-xs font-semibold tracking-wide">{card.label}</span>
                <div className="ml-auto flex gap-1">
                  {[0,1,2].map(d => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
                  ))}
                </div>
              </div>

              {/* Card rows */}
              <div className="px-4 py-3 space-y-2.5">
                {card.items.map((item, j) => (
                  <div key={j} className="flex items-start gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${item.dot}`} />
                    <div className="min-w-0">
                      <p className="text-white/75 text-[11px] font-medium leading-tight truncate">{item.text}</p>
                      <p className="text-white/30 text-[10px] mt-0.5">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress bar accent */}
              <div className="mx-4 mb-3 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${[72, 58, 81, 65][i]}%`,
                    background: ["rgba(59,130,246,0.7)", "rgba(6,182,212,0.7)", "rgba(16,185,129,0.7)", "rgba(245,158,11,0.7)"][i],
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom label */}
        <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-px w-12" style={{ background: "rgba(255,255,255,0.10)" }} />
            <span className="text-white/25 text-[10px] font-medium tracking-widest uppercase">Professional Services Automation</span>
            <div className="h-px w-12" style={{ background: "rgba(255,255,255,0.10)" }} />
          </div>
          <div className="flex items-center gap-5">
            {[
              { icon: <TrendingUp className="h-3 w-3" />, label: "Project Health" },
              { icon: <Clock className="h-3 w-3" />, label: "Time Tracking" },
              { icon: <CheckCircle2 className="h-3 w-3" />, label: "Milestones" },
              { icon: <AlertCircle className="h-3 w-3" />, label: "RAID Log" },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-1.5 text-white/25 text-[10px]">
                <span className="text-blue-400/40">{f.icon}</span>
                {f.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollbar styling */}
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 2px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
      `}</style>
    </div>
  );
}
