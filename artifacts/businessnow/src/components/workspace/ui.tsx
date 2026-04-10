import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// ─── StatCard ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  iconColor?: string;
  delta?: { value: string; up: boolean | null };
  subtext?: string;
  className?: string;
  onClick?: () => void;
}
export function StatCard({ label, value, icon: Icon, iconColor = "text-primary", delta, subtext, className, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-xl p-4 flex flex-col gap-2",
        onClick && "cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        {Icon && (
          <div className={cn("p-1.5 rounded-lg bg-muted", iconColor)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
      {(delta || subtext) && (
        <div className="flex items-center gap-1.5 mt-0.5">
          {delta && (
            <span className={cn("flex items-center gap-0.5 text-xs font-medium",
              delta.up === true ? "text-emerald-600" : delta.up === false ? "text-red-600" : "text-muted-foreground"
            )}>
              {delta.up === true ? <TrendingUp className="h-3 w-3" /> : delta.up === false ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {delta.value}
            </span>
          )}
          {subtext && <span className="text-xs text-muted-foreground">{subtext}</span>}
        </div>
      )}
    </div>
  );
}

// ─── PageHeader ──────────────────────────────────────────────────────────────
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}
export function PageHeader({ title, description, actions, meta, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-foreground tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        {meta && <div className="mt-2">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// ─── SectionCard ─────────────────────────────────────────────────────────────
interface SectionCardProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
}
export function SectionCard({ title, description, actions, children, className, contentClassName, noPadding }: SectionCardProps) {
  return (
    <div className={cn("bg-card border border-border rounded-xl overflow-hidden", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(!noPadding && "p-4", contentClassName)}>
        {children}
      </div>
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  active:      "bg-blue-50 text-blue-700 border-blue-200",
  at_risk:     "bg-red-50 text-red-700 border-red-200",
  completed:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  on_hold:     "bg-gray-50 text-gray-600 border-gray-200",
  pending:     "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  overdue:     "bg-red-50 text-red-700 border-red-200",
  draft:       "bg-gray-50 text-gray-600 border-gray-200",
  sent:        "bg-blue-50 text-blue-700 border-blue-200",
  paid:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  open:        "bg-blue-50 text-blue-700 border-blue-200",
  won:         "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost:        "bg-red-50 text-red-700 border-red-200",
  blocked:     "bg-red-50 text-red-700 border-red-200",
  todo:        "bg-gray-50 text-gray-600 border-gray-200",
  done:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  high:        "bg-orange-50 text-orange-700 border-orange-200",
  critical:    "bg-red-50 text-red-700 border-red-200",
  medium:      "bg-amber-50 text-amber-700 border-amber-200",
  low:         "bg-gray-50 text-gray-600 border-gray-200",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? "bg-gray-50 text-gray-600 border-gray-200";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium capitalize", style, className)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── HealthBar ───────────────────────────────────────────────────────────────
export function HealthBar({ score, showLabel = true }: { score: number; showLabel?: boolean }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 65 ? "bg-amber-500" : "bg-red-500";
  const textColor = score >= 80 ? "text-emerald-600" : score >= 65 ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
        <div className={cn("h-1.5 rounded-full transition-all", color)} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      {showLabel && <span className={cn("text-xs font-semibold w-6 text-right", textColor)}>{score}</span>}
    </div>
  );
}

// ─── FilterBar ───────────────────────────────────────────────────────────────
interface FilterBarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}
export function FilterBar({ left, right, className }: FilterBarProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3 mb-4", className)}>
      <div className="flex items-center gap-2 flex-1 min-w-0">{left}</div>
      <div className="flex items-center gap-2 shrink-0">{right}</div>
    </div>
  );
}

// ─── RightDetailPanel ────────────────────────────────────────────────────────
interface RightDetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}
export function RightDetailPanel({ open, onClose, title, subtitle, children }: RightDetailPanelProps) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-30" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-[400px] bg-card border-l border-border shadow-xl z-40 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground text-sm">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
      </aside>
    </>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="p-3 rounded-xl bg-muted mb-4">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── FormSectionCard ─────────────────────────────────────────────────────────
interface FormSectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}
export function FormSectionCard({ title, description, children, className }: FormSectionCardProps) {
  return (
    <div className={cn("bg-card border border-border rounded-xl overflow-hidden", className)}>
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
