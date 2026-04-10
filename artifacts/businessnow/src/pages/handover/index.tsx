import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useAuthRole, hasPermission } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Circle, ExternalLink, FileText, Users, AlertTriangle, Save, Printer } from "lucide-react";

const API = "/api";

type Contact = { name: string; role: string; email?: string; phone?: string; type: "client" | "internal" | "ams" };

function EditableText({ value, onChange, placeholder, multiline }: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  if (multiline) {
    return (
      <textarea
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary min-h-[80px]"
      />
    );
  }
  return (
    <input
      type="text"
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
    />
  );
}

function ContactTypeColor(type: string) {
  return type === "client" ? "text-blue-600 bg-blue-500/10 border-blue-500/30"
    : type === "internal" ? "text-violet-600 bg-violet-500/10 border-violet-500/30"
    : "text-emerald-600 bg-emerald-500/10 border-emerald-500/30";
}

export default function HandoverPage() {
  const params = useParams();
  const projectId = Number(params.id);
  const { role } = useAuthRole();
  const canEdit    = hasPermission(role, "editHandover");
  const canSignOff = hasPermission(role, "signOffHandover");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [edits, setEdits] = useState<Record<string, any>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/handover/${projectId}`)
      .then(r => r.json())
      .then(d => { setData(d); setEdits(d.handover); setLoading(false); });
  }, [projectId]);

  useEffect(() => { if (projectId) load(); }, [load, projectId]);

  const save = async () => {
    setSaving(true);
    await fetch(`${API}/handover/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edits),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (key: string, value: any) => setEdits(e => ({ ...e, [key]: value }));

  if (loading || !data) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const { handover, context } = data;
  const { project, milestones, changeRequests, team } = context;
  const contacts: Contact[] = edits.keyContacts || [];

  const addContact = () => {
    set("keyContacts", [...contacts, { name: "", role: "", type: "internal" }]);
  };

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    in_review: "bg-blue-500/20 text-blue-600",
    signed_off: "bg-emerald-500/20 text-emerald-600",
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card px-6 py-4 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/projects" className="hover:text-foreground">Projects</Link>
            <span>/</span>
            <Link href={`/projects/${projectId}`} className="hover:text-foreground">{project.name}</Link>
            <span>/</span>
            <span className="text-foreground">Handover Summary</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${statusColors[edits.status] || statusColors.draft}`}>
              {(edits.status || "draft").replace("_", " ")}
            </Badge>
            {canEdit && edits.status === "draft" && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => set("status", "in_review")}>
                Mark In Review
              </Button>
            )}
            {canSignOff && edits.status === "in_review" && (
              <Button size="sm" variant="outline" className="border-emerald-500 text-emerald-600 h-7 text-xs" onClick={() => set("status", "signed_off")}>
                Sign Off
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => window.print()} className="text-muted-foreground h-7">
              <Printer className="h-4 w-4 mr-1" />Print
            </Button>
            {canEdit && (
              <Button size="sm" onClick={save} disabled={saving} className="h-7">
                <Save className="h-4 w-4 mr-1" />
                {saving ? "Saving…" : saved ? "Saved!" : "Save"}
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3">
          <h1 className="text-xl font-bold text-foreground">{project.name} — Handover Summary</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {project.accountName} · PM: {project.pmName || "—"} · Go-live: {project.goLiveDate || "—"}
          </p>
        </div>
      </div>

      <div className="p-6 max-w-[1200px] mx-auto">
        <Tabs defaultValue="scope">
          <TabsList className="bg-card border border-border mb-6 print:hidden">
            <TabsTrigger value="scope">Scope & Delivery</TabsTrigger>
            <TabsTrigger value="milestones">Milestones ({milestones.length})</TabsTrigger>
            <TabsTrigger value="changes">Change Orders ({changeRequests.length})</TabsTrigger>
            <TabsTrigger value="contacts">Key Contacts ({contacts.length})</TabsTrigger>
            <TabsTrigger value="support">Support & Renewal</TabsTrigger>
          </TabsList>

          {/* Scope Tab */}
          <TabsContent value="scope" className="space-y-5">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Scope Delivered</CardTitle></CardHeader>
              <CardContent>
                <EditableText value={edits.scopeDelivered} onChange={v => set("scopeDelivered", v)} placeholder="Describe what was delivered to the client…" multiline />
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Open Risks & Issues</CardTitle></CardHeader>
              <CardContent>
                <EditableText value={edits.openRisks} onChange={v => set("openRisks", v)} placeholder="Describe any known risks, workarounds, or outstanding issues…" multiline />
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Unresolved Items</CardTitle></CardHeader>
              <CardContent>
                <EditableText value={edits.unresolvedItems} onChange={v => set("unresolvedItems", v)} placeholder="List any items deferred to AMS, phase 2, or pending decision…" multiline />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Milestones Tab */}
          <TabsContent value="milestones">
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left p-4">Milestone</th>
                    <th className="text-center p-4">Status</th>
                    <th className="text-right p-4">Date</th>
                    <th className="text-center p-4">Billable</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {milestones.map((m: any) => (
                      <tr key={m.id} className="hover:bg-muted">
                        <td className="p-4 text-foreground">{m.name}</td>
                        <td className="p-4 text-center">
                          {m.status === "completed"
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" />
                            : <Circle className="h-4 w-4 text-muted-foreground inline" />}
                        </td>
                        <td className="p-4 text-right text-muted-foreground text-xs">{m.dueDate || "—"}</td>
                        <td className="p-4 text-center">{m.isBillable ? <span className="text-xs text-emerald-600">Yes</span> : <span className="text-xs text-muted-foreground">No</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Changes Tab */}
          <TabsContent value="changes">
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                {changeRequests.length === 0 ? (
                  <p className="text-muted-foreground text-sm p-6">No change orders for this project</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left p-4">Change Order</th>
                      <th className="text-center p-4">Status</th>
                      <th className="text-right p-4">Cost Impact</th>
                      <th className="text-right p-4">Hours</th>
                    </tr></thead>
                    <tbody className="divide-y divide-border">
                      {changeRequests.map((cr: any) => (
                        <tr key={cr.id} className="hover:bg-muted">
                          <td className="p-4 text-foreground">{cr.title}</td>
                          <td className="p-4 text-center"><Badge variant="secondary" className="text-xs capitalize">{cr.status.replace(/_/g, " ")}</Badge></td>
                          <td className="p-4 text-right text-foreground">{cr.impactCost > 0 ? `$${(cr.impactCost / 1000).toFixed(0)}K` : "—"}</td>
                          <td className="p-4 text-right text-muted-foreground">{cr.impactHours > 0 ? `${cr.impactHours}h` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{contacts.length} contact{contacts.length !== 1 ? "s" : ""} defined</p>
              <Button size="sm" onClick={addContact} variant="outline" className="h-7 text-xs">+ Add Contact</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contacts.map((c: Contact, i: number) => (
                <Card key={i} className={`border ${ContactTypeColor(c.type)}`}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={c.type}
                        onChange={e => { const nc = [...contacts]; nc[i] = { ...nc[i], type: e.target.value as any }; set("keyContacts", nc); }}
                        className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
                      >
                        <option value="client">Client</option>
                        <option value="internal">Internal</option>
                        <option value="ams">AMS</option>
                      </select>
                      <button onClick={() => { const nc = [...contacts]; nc.splice(i, 1); set("keyContacts", nc); }} className="ml-auto text-muted-foreground hover:text-destructive text-xs">Remove</button>
                    </div>
                    {(["name", "role", "email", "phone"] as const).map(field => (
                      <EditableText key={field} value={(c as any)[field]} placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                        onChange={v => { const nc = [...contacts]; nc[i] = { ...nc[i], [field]: v }; set("keyContacts", nc); }} />
                    ))}
                  </CardContent>
                </Card>
              ))}
              {contacts.length === 0 && (
                <div className="col-span-2 text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p>No contacts defined yet</p>
                  <Button size="sm" onClick={addContact} variant="ghost" className="mt-2 text-muted-foreground">+ Add First Contact</Button>
                </div>
              )}
            </div>

            {/* Team */}
            {team.length > 0 && (
              <Card className="bg-card border-border mt-4">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Delivery Team</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {team.map((t: any, i: number) => (
                      <div key={i} className="text-sm flex justify-between py-1.5 border-b border-border last:border-0">
                        <span className="text-foreground font-medium">{t.resourceName}</span>
                        <span className="text-muted-foreground text-xs">{t.role} · {t.allocationType}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Support & Renewal Tab */}
          <TabsContent value="support" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Support & AMS Expectations</CardTitle></CardHeader>
              <CardContent>
                <EditableText value={edits.supportExpectations} onChange={v => set("supportExpectations", v)} placeholder="Describe SLA tiers, support contacts, escalation paths…" multiline />
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Renewal & Expansion Notes</CardTitle></CardHeader>
              <CardContent>
                <EditableText value={edits.renewalNotes} onChange={v => set("renewalNotes", v)} placeholder="Upcoming renewals, expansion opportunities, Phase 2 scope…" multiline />
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Upsell Opportunities</CardTitle></CardHeader>
              <CardContent>
                <EditableText value={edits.upsellNotes} onChange={v => set("upsellNotes", v)} placeholder="Potential upsell paths, identified expansion modules…" multiline />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
