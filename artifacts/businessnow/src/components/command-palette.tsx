import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, Briefcase, Building2, Users, Target } from "lucide-react";

const API = "/api";

type Result = { id: number; name: string; sub?: string };
type Results = { projects: Result[]; accounts: Result[]; resources: Result[]; opportunities: Result[]; query: string };

const EMPTY: Results = { projects: [], accounts: [], resources: [], opportunities: [], query: "" };

const SECTIONS: { key: keyof Omit<Results, "query">; label: string; icon: any; href: (id: number) => string; color: string }[] = [
  { key: "projects", label: "Projects", icon: Briefcase, href: (id) => `/projects/${id}`, color: "text-blue-400" },
  { key: "accounts", label: "Accounts", icon: Building2, href: (id) => `/accounts/${id}`, color: "text-emerald-400" },
  { key: "resources", label: "Resources", icon: Users, href: (id) => `/resources/${id}`, color: "text-violet-400" },
  { key: "opportunities", label: "Opportunities", icon: Target, href: (id) => `/opportunities/${id}`, color: "text-amber-400" },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(EMPTY);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query || query.length < 2) { setResults(EMPTY); return; }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`${API}/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(d => { setResults(d); setLoading(false); setSelectedIdx(0); });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const allItems = SECTIONS.flatMap(s =>
    (results[s.key] as any[]).map((item: any) => ({ ...item, section: s.key, href: s.href(item.id) }))
  );

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, allItems.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && allItems[selectedIdx]) {
      navigate(allItems[selectedIdx].href);
      onClose();
    }
  }, [allItems, selectedIdx, navigate, onClose]);

  if (!open) return null;

  const hasResults = SECTIONS.some(s => (results[s.key] as any[]).length > 0);
  let globalIdx = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[600px] mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className={`h-4 w-4 ${loading ? "text-blue-400 animate-pulse" : "text-muted-foreground/70"}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects, accounts, resources…"
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none text-sm"
          />
          <kbd className="text-[10px] bg-muted text-muted-foreground/70 px-1.5 py-0.5 rounded border border-border">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {!query || query.length < 2 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-muted-foreground/70 text-sm">Type to search across the platform</p>
              <p className="text-muted-foreground text-xs mt-1">Projects · Accounts · Resources · Opportunities</p>
            </div>
          ) : !hasResults && !loading ? (
            <div className="px-4 py-8 text-center">
              <p className="text-muted-foreground/70 text-sm">No results for "<span className="text-foreground/70">{query}</span>"</p>
            </div>
          ) : (
            SECTIONS.map(({ key, label, icon: Icon, href, color }) => {
              const items = results[key] as any[];
              if (items.length === 0) return null;
              return (
                <div key={key}>
                  <div className="px-4 py-1.5 flex items-center gap-2">
                    <Icon className={`h-3 w-3 ${color}`} />
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{label}</p>
                  </div>
                  {items.map(item => {
                    const idx = globalIdx++;
                    const isSelected = idx === selectedIdx;
                    return (
                      <button
                        key={item.id}
                        className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${isSelected ? "bg-muted text-foreground" : "text-foreground/70 hover:bg-muted/50"}`}
                        onClick={() => { navigate(href(item.id)); onClose(); }}
                        onMouseEnter={() => setSelectedIdx(idx)}
                      >
                        <Icon className={`h-4 w-4 ${color} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          {(item.accountName || item.industry || item.title || item.stage) && (
                            <p className="text-xs text-muted-foreground/70 truncate">{item.accountName || item.industry || item.title}</p>
                          )}
                        </div>
                        {item.healthScore !== undefined && (
                          <span className={`text-xs font-bold shrink-0 ${item.healthScore >= 80 ? "text-emerald-400" : item.healthScore >= 65 ? "text-amber-400" : "text-red-400"}`}>
                            {item.healthScore}
                          </span>
                        )}
                        {item.stage && <span className="text-xs text-muted-foreground/70 shrink-0">{item.stage}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2 flex gap-4">
          {[["↑↓", "navigate"], ["↵", "select"], ["esc", "close"]].map(([key, hint]) => (
            <div key={key} className="flex items-center gap-1.5">
              <kbd className="text-[10px] bg-muted text-muted-foreground/70 px-1.5 py-0.5 rounded border border-border">{key}</kbd>
              <span className="text-[10px] text-muted-foreground/60">{hint}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
