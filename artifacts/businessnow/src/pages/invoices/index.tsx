import { useState, useMemo } from "react";
import { useListInvoices } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format, startOfMonth, subMonths, endOfMonth } from "date-fns";
import { LayoutGrid, List, FileText, DollarSign, Search, X, Zap, Loader2, CheckCircle2, ChevronRight, Rocket } from "lucide-react";
import { Link } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const COLUMNS = [
  { id: "draft",   label: "Draft",   color: "border-t-zinc-500",    dot: "bg-zinc-400",    cardBorder: "border-border" },
  { id: "sent",    label: "Sent",    color: "border-t-blue-500",    dot: "bg-blue-500",    cardBorder: "border-blue-500/20" },
  { id: "overdue", label: "Overdue", color: "border-t-red-500",     dot: "bg-red-500",     cardBorder: "border-red-500/30" },
  { id: "paid",    label: "Paid",    color: "border-t-emerald-500", dot: "bg-emerald-500", cardBorder: "border-emerald-500/20" },
];

function fmt(v: number) {
  if (!v || isNaN(v)) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtFull(v: number) {
  if (!v || isNaN(v)) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(v);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d + "T12:00:00"), "MMM d, yyyy"); } catch { return d; }
}

function fmtDateShort(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d + "T12:00:00"), "MMM d"); } catch { return d; }
}

interface TMLineItem {
  description: string;
  resource: string;
  task: string;
  serviceDate: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface TMPreviewData {
  invoiceId: number;
  periodStart: string;
  periodEnd: string;
  lines: TMLineItem[];
  resourceSubtotals: Record<string, number>;
  grandTotal: number;
  totalHours: number;
}

function prevMonthStart() {
  return format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
}
function prevMonthEnd() {
  return format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
}

function TMPreviewPanel({
  invoice,
  open,
  onClose,
  onApplied,
}: {
  invoice: any;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [periodStart, setPeriodStart] = useState(prevMonthStart);
  const [periodEnd, setPeriodEnd] = useState(prevMonthEnd);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [data, setData] = useState<TMPreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setData(null);
    setApplied(false);
    try {
      const res = await fetch(
        `${API_BASE}/invoices/${invoice.id}/tm-lines?periodStart=${periodStart}&periodEnd=${periodEnd}`,
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to generate lines");
      }
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!data) return;
    setApplying(true);
    try {
      const res = await fetch(`${API_BASE}/invoices/${invoice.id}/apply-tm-lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          lines: data.lines,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to apply");
      }
      setApplied(true);
      onApplied();
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setApplying(false);
    }
  }

  const resourceGroups = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, TMLineItem[]>();
    for (const line of data.lines) {
      if (!map.has(line.resource)) map.set(line.resource, []);
      map.get(line.resource)!.push(line);
    }
    return Array.from(map.entries()).map(([resource, lines]) => ({
      resource,
      lines,
      subtotal: lines.reduce((s, l) => s + l.amount, 0),
      hours: lines.reduce((s, l) => s + l.quantity, 0),
    }));
  }, [data]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl flex flex-col p-0 overflow-hidden"
      >
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-base leading-tight">
                Generate T&amp;M Lines — {invoice.invoiceNumber}
              </SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {invoice.projectName ?? "—"} · {invoice.accountName ?? "—"}
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Period selector */}
          <div className="px-6 py-4 border-b bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Billing Period</p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">From</label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground mt-5 shrink-0" />
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">To</label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <Button
                onClick={handleGenerate}
                disabled={loading || !periodStart || !periodEnd}
                className="mt-5 shrink-0 h-8"
                size="sm"
              >
                {loading ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Generating…</>
                ) : (
                  <><Zap className="h-3.5 w-3.5 mr-1.5" /> Generate</>
                )}
              </Button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Empty state */}
          {data && data.lines.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No approved billable entries</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                No approved, billable timesheet entries found for this project in the selected period.
              </p>
            </div>
          )}

          {/* Line items table */}
          {data && data.lines.length > 0 && (
            <div className="px-6 py-4 space-y-4">
              {/* Summary bar */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Hours", value: `${data.totalHours.toFixed(1)} hrs` },
                  { label: "Line Items", value: `${data.lines.length}` },
                  { label: "Grand Total", value: fmtFull(data.grandTotal), highlight: true },
                ].map((k) => (
                  <div key={k.label} className={`rounded-lg border p-3 text-center ${k.highlight ? "border-primary/30 bg-primary/5" : "bg-muted/30"}`}>
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${k.highlight ? "text-primary" : ""}`}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Resource groups */}
              <div className="space-y-4">
                {resourceGroups.map((group) => (
                  <div key={group.resource} className="rounded-lg border overflow-hidden">
                    {/* Resource header */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-sm font-semibold">{group.resource}</span>
                        <span className="text-xs text-muted-foreground">· {group.hours.toFixed(1)} hrs</span>
                      </div>
                      <span className="text-sm font-bold">{fmtFull(group.subtotal)}</span>
                    </div>
                    {/* Lines for this resource */}
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[10px] py-1.5 h-auto">Date</TableHead>
                          <TableHead className="text-[10px] py-1.5 h-auto">Task / Description</TableHead>
                          <TableHead className="text-[10px] py-1.5 h-auto text-right">Hrs</TableHead>
                          <TableHead className="text-[10px] py-1.5 h-auto text-right">Rate</TableHead>
                          <TableHead className="text-[10px] py-1.5 h-auto text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.lines.map((line, i) => (
                          <TableRow key={i} className="hover:bg-muted/20">
                            <TableCell className="py-2 text-xs font-mono text-muted-foreground whitespace-nowrap">
                              {fmtDateShort(line.serviceDate)}
                            </TableCell>
                            <TableCell className="py-2 text-xs max-w-[240px]">
                              <span className="font-medium">{line.task}</span>
                              {line.description.includes(" — ") &&
                                line.description.split(" — ").length > 2 && (
                                  <span className="block text-muted-foreground truncate text-[10px] mt-0.5">
                                    {line.description.split(" — ").slice(2).join(" — ")}
                                  </span>
                                )}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-right">{line.quantity.toFixed(1)}</TableCell>
                            <TableCell className="py-2 text-xs text-right text-muted-foreground">
                              {line.unitPrice > 0 ? `$${line.unitPrice.toFixed(0)}/hr` : "—"}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-right font-medium">
                              {line.amount > 0 ? fmtFull(line.amount) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Resource subtotal */}
                        <TableRow className="bg-muted/30 hover:bg-muted/30 border-t">
                          <TableCell colSpan={2} className="py-2 text-xs font-semibold text-right">
                            Subtotal — {group.resource}
                          </TableCell>
                          <TableCell className="py-2 text-xs font-semibold text-right">{group.hours.toFixed(1)}</TableCell>
                          <TableCell />
                          <TableCell className="py-2 text-xs font-bold text-right">{fmtFull(group.subtotal)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ))}

                {/* Grand total */}
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">Grand Total</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDateShort(data.periodStart)} – {fmtDateShort(data.periodEnd)} · {data.totalHours.toFixed(1)} hrs · {data.lines.length} line items
                    </p>
                  </div>
                  <p className="text-lg font-bold text-primary">{fmtFull(data.grandTotal)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Applied success */}
          {applied && (
            <div className="mx-6 mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Invoice updated — {data?.lines.length} line items applied, amount set to {fmtFull(data?.grandTotal ?? 0)}.
            </div>
          )}
        </div>

        {/* Footer actions */}
        {data && data.lines.length > 0 && (
          <div className="px-6 py-4 border-t bg-background shrink-0 flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {applied ? (
              <Button size="sm" onClick={onClose} className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Done
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleApply}
                disabled={applying}
              >
                {applying ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Applying…</>
                ) : (
                  <>Apply {data.lines.length} lines to Invoice</>
                )}
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InvoiceKanban({
  invoices,
  onGenerateTM,
}: {
  invoices: any[];
  onGenerateTM: (inv: any) => void;
}) {
  const totalByCol = (id: string) =>
    invoices.filter(i => i.status === id).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {COLUMNS.map(col => {
          const items = invoices.filter(i => i.status === col.id);
          const total = totalByCol(col.id);
          return (
            <div key={col.id} className="w-72 shrink-0">
              <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${col.color.replace("border-t-", "border-b-")}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-xs font-semibold">{col.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {total > 0 && <span className="text-xs font-medium text-muted-foreground">{fmt(total)}</span>}
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
              </div>
              <div className="space-y-2">
                {items.map(inv => (
                  <div key={inv.id} className={`rounded-lg border p-3 space-y-2 bg-card ${col.cardBorder}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-mono font-semibold truncate">{inv.invoiceNumber}</span>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${col.id === "overdue" ? "text-red-500" : col.id === "paid" ? "text-emerald-500" : ""}`}>
                        {fmt(parseFloat(inv.amount))}
                      </span>
                    </div>
                    <div>
                      {inv.accountId ? (
                        <Link href={`/customers/${inv.accountId}`} onClick={e => e.stopPropagation()}
                          className="text-xs font-medium truncate hover:text-primary underline-offset-2 hover:underline block">
                          {inv.accountName || "—"}
                        </Link>
                      ) : <p className="text-xs font-medium truncate">{inv.accountName || "—"}</p>}
                      {inv.projectId ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Link href={`/projects/${inv.projectId}`} onClick={e => e.stopPropagation()}
                            className="text-xs text-muted-foreground truncate hover:text-primary underline-offset-2 hover:underline">
                            {inv.projectName || "—"}
                          </Link>
                          <Link href={`/projects/${inv.projectId}/command`} onClick={e => e.stopPropagation()}
                            className="text-muted-foreground/50 hover:text-primary flex-shrink-0" title="Command Center">
                            <Rocket className="h-2.5 w-2.5" />
                          </Link>
                        </div>
                      ) : <p className="text-xs text-muted-foreground truncate">{inv.projectName || "—"}</p>}
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className={col.id === "overdue" ? "text-red-500 font-medium" : ""}>
                          Due {fmtDate(inv.dueDate)}
                        </span>
                      </div>
                      {col.id === "draft" && (
                        <button
                          onClick={() => onGenerateTM(inv)}
                          className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
                          title="Generate T&M Lines"
                        >
                          <Zap className="h-3 w-3" /> T&amp;M Lines
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="border-2 border-dashed border-border rounded-lg p-5 text-center">
                    <p className="text-xs text-muted-foreground">No invoices</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaxBreakdown({ inv }: { inv: any }) {
  const base = parseFloat(inv.taxableAmount || inv.amount || "0");
  const tax = parseFloat(inv.cgstAmount || "0") + parseFloat(inv.sgstAmount || "0") + parseFloat(inv.igstAmount || "0");
  const total = parseFloat(inv.totalWithTax || inv.amount || "0");
  if (tax <= 0) return null;
  const taxRate = base > 0 ? ((tax / base) * 100).toFixed(2) : "";
  return (
    <div className="mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground space-y-0.5">
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{fmt(base)}</span>
      </div>
      <div className="flex justify-between">
        <span>Sales Tax{taxRate ? ` (${taxRate}%)` : ""}</span>
        <span>{fmt(tax)}</span>
      </div>
      <div className="flex justify-between font-semibold text-foreground pt-0.5 border-t border-border/50">
        <span>Total (incl. Tax)</span>
        <span>{fmt(total)}</span>
      </div>
    </div>
  );
}

function InvoiceTable({
  invoices,
  onGenerateTM,
}: {
  invoices: any[];
  onGenerateTM: (inv: any) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const hasTaxData = invoices.some(i =>
    parseFloat(i.cgstAmount || "0") > 0 || parseFloat(i.sgstAmount || "0") > 0 || parseFloat(i.igstAmount || "0") > 0
  );

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Base Amount</TableHead>
              {hasTaxData && <><TableHead>Sales Tax</TableHead><TableHead>Total (incl. Tax)</TableHead></>}
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const tax = parseFloat(invoice.cgstAmount || "0") + parseFloat(invoice.sgstAmount || "0") + parseFloat(invoice.igstAmount || "0");
              const totalWithTax = parseFloat(invoice.totalWithTax || invoice.amount || "0");
              return (
                <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setExpanded(expanded === invoice.id ? null : invoice.id)}>
                  <TableCell className="font-medium font-mono">{invoice.invoiceNumber}</TableCell>
                  <TableCell>
                    {invoice.accountId ? (
                      <Link href={`/customers/${invoice.accountId}`} onClick={e => e.stopPropagation()}
                        className="hover:text-primary underline-offset-2 hover:underline">
                        {invoice.accountName}
                      </Link>
                    ) : invoice.accountName}
                  </TableCell>
                  <TableCell>
                    {invoice.projectId ? (
                      <div className="flex items-center gap-1.5">
                        <Link href={`/projects/${invoice.projectId}`} onClick={e => e.stopPropagation()}
                          className="hover:text-primary underline-offset-2 hover:underline truncate max-w-[160px]">
                          {invoice.projectName}
                        </Link>
                        <Link href={`/projects/${invoice.projectId}/command`} onClick={e => e.stopPropagation()}
                          className="text-muted-foreground/50 hover:text-primary flex-shrink-0" title="Command Center">
                          <Rocket className="h-3 w-3" />
                        </Link>
                      </div>
                    ) : invoice.projectName}
                  </TableCell>
                  <TableCell className="font-medium">{fmt(parseFloat(invoice.taxableAmount || invoice.amount))}</TableCell>
                  {hasTaxData && (
                    <>
                      <TableCell className="text-muted-foreground">{tax > 0 ? fmt(tax) : "—"}</TableCell>
                      <TableCell className="font-semibold text-foreground">{totalWithTax > 0 ? fmt(totalWithTax) : fmt(parseFloat(invoice.amount))}</TableCell>
                    </>
                  )}
                  <TableCell>
                    <Badge variant={
                      invoice.status === "paid" ? "default" :
                      invoice.status === "overdue" ? "destructive" :
                      invoice.status === "sent" ? "secondary" : "outline"
                    } className="capitalize">
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{fmtDate(invoice.dueDate)}</TableCell>
                  <TableCell>
                    {invoice.status === "draft" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onGenerateTM(invoice); }}
                        className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 whitespace-nowrap transition-colors"
                        title="Generate T&M Lines"
                      >
                        <Zap className="h-3 w-3" /> T&amp;M Lines
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={hasTaxData ? 9 : 7} className="text-center h-24 text-muted-foreground">No invoices found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TaxSummary({ invoices }: { invoices: any[] }) {
  const totals = invoices.reduce((acc, inv) => ({
    subtotal: acc.subtotal + parseFloat(inv.taxableAmount || inv.amount || "0"),
    tax: acc.tax + parseFloat(inv.cgstAmount || "0") + parseFloat(inv.sgstAmount || "0") + parseFloat(inv.igstAmount || "0"),
    total: acc.total + parseFloat(inv.totalWithTax || inv.amount || "0"),
  }), { subtotal: 0, tax: 0, total: 0 });

  if (totals.tax <= 0) return null;

  return (
    <div className="bg-muted/30 border rounded-lg p-4 mt-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Tax Summary</p>
      <div className="grid grid-cols-3 gap-4 text-center">
        {[
          { label: "Subtotal", value: totals.subtotal },
          { label: "Total Sales Tax", value: totals.tax },
          { label: "Total (incl. Tax)", value: totals.total },
        ].map(item => (
          <div key={item.label}>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-bold mt-0.5">{item.value > 0 ? fmt(item.value) : "—"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_PILLS = [
  { id: "all",     label: "All" },
  { id: "draft",   label: "Draft",   dot: "bg-zinc-400" },
  { id: "sent",    label: "Sent",    dot: "bg-blue-500" },
  { id: "overdue", label: "Overdue", dot: "bg-red-500" },
  { id: "paid",    label: "Paid",    dot: "bg-emerald-500" },
];

export default function InvoicesList() {
  const { data: invoices, isLoading, refetch } = useListInvoices();
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [tmInvoice, setTmInvoice] = useState<any | null>(null);

  const data = invoices ?? [];

  const filtered = useMemo(() => {
    return data.filter(i => {
      if (filterStatus !== "all" && i.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(i.invoiceNumber || "").toLowerCase().includes(q) &&
            !(i.accountName || "").toLowerCase().includes(q) &&
            !(i.projectName || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [data, filterStatus, search]);

  const kpis = useMemo(() => ({
    outstanding: (data as any[]).filter((i: any) => i.status === "sent" || i.status === "overdue")
      .reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0),
    overdue: (data as any[]).filter((i: any) => i.status === "overdue")
      .reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0),
    overdueCount: (data as any[]).filter((i: any) => i.status === "overdue").length,
    paid: (data as any[]).filter((i: any) => i.status === "paid")
      .reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0),
    draft: (data as any[]).filter((i: any) => i.status === "draft").length,
  }), [data]);

  const counts = useMemo(() => ({
    all: data.length, draft: (data as any[]).filter((i: any) => i.status === "draft").length,
    sent: (data as any[]).filter((i: any) => i.status === "sent").length,
    overdue: (data as any[]).filter((i: any) => i.status === "overdue").length,
    paid: (data as any[]).filter((i: any) => i.status === "paid").length,
  }), [data]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  const hasFilters = filterStatus !== "all" || search !== "";

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length}{filtered.length !== data.length ? ` of ${data.length}` : ""} invoices
            {kpis.overdueCount > 0 && <span className="ml-2 text-red-600 font-medium">· {kpis.overdueCount} overdue</span>}
            {kpis.draft > 0 && <span className="ml-2 text-muted-foreground">· {kpis.draft} draft</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 shrink-0">
          <Button variant={view === "kanban" ? "default" : "ghost"} size="sm" onClick={() => setView("kanban")} className="h-7 px-2.5">
            <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Kanban
          </Button>
          <Button variant={view === "table" ? "default" : "ghost"} size="sm" onClick={() => setView("table")} className="h-7 px-2.5">
            <List className="h-3.5 w-3.5 mr-1.5" /> Table
          </Button>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Outstanding", value: fmt(kpis.outstanding), sub: "sent + overdue", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
          { label: "Overdue",     value: fmt(kpis.overdue),     sub: `${kpis.overdueCount} invoice${kpis.overdueCount !== 1 ? "s" : ""}`, color: "text-red-600", bg: kpis.overdue > 0 ? "bg-red-50 border-red-200" : "bg-muted border-border" },
          { label: "Paid",        value: fmt(kpis.paid),        sub: "collected",      color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
        ].map(k => (
          <div key={k.label} className={`border rounded-xl p-4 ${k.bg}`}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search invoice #, account, project…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 w-[260px] text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_PILLS.map(pill => {
            const count = counts[pill.id as keyof typeof counts];
            const isActive = filterStatus === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setFilterStatus(pill.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {pill.dot && <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />}
                {pill.label}
                {count !== undefined && (
                  <span className={`ml-0.5 ${isActive ? "text-background/70" : "text-muted-foreground/70"}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setFilterStatus("all"); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {view === "kanban"
        ? <InvoiceKanban invoices={filtered} onGenerateTM={setTmInvoice} />
        : <InvoiceTable invoices={filtered} onGenerateTM={setTmInvoice} />
      }
      <TaxSummary invoices={filtered} />

      {tmInvoice && (
        <TMPreviewPanel
          invoice={tmInvoice}
          open={!!tmInvoice}
          onClose={() => setTmInvoice(null)}
          onApplied={() => refetch?.()}
        />
      )}
    </div>
  );
}
