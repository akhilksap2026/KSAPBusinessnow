import { useState, useEffect } from "react";
import { useAuthRole, ROLE_LABELS, type DemoUser } from "@/lib/auth";
import { setActiveContext, type ActiveContext } from "@/lib/context";
import { Users, ChevronRight, ArrowRight } from "lucide-react";

const API = "/api";

interface ContextUser {
  id: number;
  name: string;
  role: string;
  title: string | null;
  resourceId: number | null;
}

interface ContextData {
  self: ContextUser;
  reportsTo: ContextUser | null;
  directReports: ContextUser[];
  availableContexts: ContextUser[];
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const ROLE_COLORS: Record<string, string> = {
  admin:              "bg-violet-500/20 text-violet-300",
  executive:          "bg-amber-500/20 text-amber-300",
  delivery_director:  "bg-sky-500/20 text-sky-300",
  project_manager:    "bg-blue-500/20 text-blue-300",
  consultant:         "bg-cyan-500/20 text-cyan-300",
  resource_manager:   "bg-emerald-500/20 text-emerald-300",
  finance_lead:       "bg-green-500/20 text-green-300",
  sales:              "bg-orange-500/20 text-orange-300",
  account_manager:    "bg-rose-500/20 text-rose-300",
  client_stakeholder: "bg-slate-500/20 text-slate-300",
};

const AVATAR_COLORS: Record<string, string> = {
  admin:              "bg-violet-500/30 text-violet-200",
  executive:          "bg-amber-500/30 text-amber-200",
  delivery_director:  "bg-sky-500/30 text-sky-200",
  project_manager:    "bg-blue-500/30 text-blue-200",
  consultant:         "bg-cyan-500/30 text-cyan-200",
  resource_manager:   "bg-emerald-500/30 text-emerald-200",
  finance_lead:       "bg-green-500/30 text-green-200",
  sales:              "bg-orange-500/30 text-orange-200",
  account_manager:    "bg-rose-500/30 text-rose-200",
  client_stakeholder: "bg-slate-500/30 text-slate-200",
};

interface Props {
  open: boolean;
  onClose: () => void;
  demoUser: DemoUser;
}

export function ContextSelector({ open, onClose, demoUser }: Props) {
  const [data, setData] = useState<ContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const email = encodeURIComponent(`${demoUser.id}@businessnow.com`);
    fetch(`${API}/me/context?email=${email}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [open, demoUser]);

  const select = async (ctx: ContextUser) => {
    setSelecting(ctx.id);
    try {
      await fetch(`${API}/session/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data?.self.id, contextUserId: ctx.id }),
      });
    } catch { }

    const active: ActiveContext = {
      userId: ctx.id,
      name: ctx.name,
      role: ctx.role,
      resourceId: ctx.resourceId,
    };
    setActiveContext(active);
    setSelecting(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Select your view</h2>
          </div>
          <p className="text-xs text-muted-foreground ml-11">
            You have team members reporting to you. Choose whose workspace to open.
          </p>
        </div>

        {/* Context cards */}
        <div className="p-4 space-y-2 max-h-[440px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data ? (
            <p className="text-sm text-muted-foreground text-center py-8">Unable to load context data.</p>
          ) : (
            data.availableContexts.map((ctx, i) => {
              const isSelf = i === 0;
              const isSelecting = selecting === ctx.id;
              const roleLabel = (ROLE_LABELS as Record<string, string>)[ctx.role] ?? ctx.role;
              const avatarColor = AVATAR_COLORS[ctx.role] ?? "bg-muted text-foreground";
              const badgeColor = ROLE_COLORS[ctx.role] ?? "bg-muted text-muted-foreground";

              return (
                <button
                  key={ctx.id}
                  onClick={() => select(ctx)}
                  disabled={isSelecting}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:bg-muted hover:border-primary/30 transition-all group text-left disabled:opacity-60"
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor}`}>
                    {initials(ctx.name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">{ctx.name}</p>
                      {isSelf && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{ctx.title ?? roleLabel}</p>
                    <span className={`inline-block mt-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${badgeColor}`}>
                      {roleLabel}
                    </span>
                  </div>

                  {/* Arrow */}
                  <div className="shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors">
                    {isSelecting
                      ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      : <ChevronRight className="h-4 w-4" />
                    }
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            You can switch context anytime from the top bar.
          </p>
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Skip <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
