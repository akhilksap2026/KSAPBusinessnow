import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Plus, Search, Star, Send, CheckCircle, Eye } from "lucide-react";
import { useAuthRole, hasPermission } from "@/lib/auth";

const API = "/api";

const FORM_TYPES: Record<string, { label: string; color: string; icon: string }> = {
  csat: { label: "CSAT Survey", color: "text-amber-400 bg-amber-500/10 border-amber-500/30", icon: "⭐" },
  kickoff_checklist: { label: "Kickoff Checklist", color: "text-blue-400 bg-blue-500/10 border-blue-500/30", icon: "🚀" },
  change_request: { label: "Change Request", color: "text-violet-400 bg-violet-500/10 border-violet-500/30", icon: "🔄" },
  handover: { label: "Handover Form", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: "🤝" },
  go_live_readiness: { label: "Go-Live Readiness", color: "text-orange-400 bg-orange-500/10 border-orange-500/30", icon: "✅" },
  milestone_sign_off: { label: "Milestone Sign-Off", color: "text-pink-400 bg-pink-500/10 border-pink-500/30", icon: "✍️" },
  resource_onboarding: { label: "Resource Onboarding", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30", icon: "👤" },
};

function FormCard({ form, onRespond, onView }: { form: any; onRespond: () => void; onView: () => void }) {
  const type = FORM_TYPES[form.type] || { label: form.type, color: "text-muted-foreground bg-muted border-border", icon: "📋" };
  return (
    <Card className="bg-card border-border hover:border-border transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{type.icon}</span>
            <div>
              <p className="font-semibold text-foreground text-sm">{form.name}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${type.color} mt-0.5 inline-block`}>{type.label}</span>
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${form.status === "active" ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-border text-muted-foreground/70 bg-muted"}`}>{form.status}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {form.description && <p className="text-xs text-muted-foreground/70">{form.description}</p>}
        <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
          <span>{(form.fields || []).length} fields</span>
          {(form.triggers || []).length > 0 && <span>· {form.triggers.length} trigger{form.triggers.length !== 1 ? "s" : ""}</span>}
        </div>
        <div className="flex gap-2 pt-1 border-t border-border">
          <Button size="sm" variant="ghost" onClick={onView} className="flex-1 h-7 text-xs text-muted-foreground hover:text-foreground">
            <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
          </Button>
          <Button size="sm" onClick={onRespond} className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
            <Send className="h-3.5 w-3.5 mr-1.5" /> Respond
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResponseViewer({ responses }: { responses: any[] }) {
  if (responses.length === 0) return <p className="text-muted-foreground/70 text-sm text-center py-6">No responses yet</p>;
  return (
    <div className="space-y-3">
      {responses.map(r => (
        <Card key={r.id} className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-foreground">{r.respondentName || "Anonymous"}</p>
                <p className="text-xs text-muted-foreground/70">{new Date(r.submittedAt).toLocaleDateString()}</p>
              </div>
              {r.csatScore && (
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(s => <Star key={s} className={`h-4 w-4 ${s <= r.csatScore ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />)}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              {Object.entries(r.responses || {}).map(([key, value]) => (
                <div key={key} className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-muted-foreground/70 capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="text-foreground/80">{Array.isArray(value) ? value.join(", ") : String(value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FormResponder({ form, onClose }: { form: any; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");

  const fields: any[] = form.fields || [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API}/forms/${form.id}/submit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responses: values, respondentName: name || "Anonymous", csatScore: values.overall_rating ? parseInt(String(values.overall_rating)) : undefined }),
    });
    setSubmitted(true);
    setTimeout(onClose, 2000);
  };

  const setValue = (id: string, value: any) => setValues(prev => ({ ...prev, [id]: value }));

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <Card className="bg-card border-border w-full max-w-md text-center p-8">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-foreground font-semibold text-lg">Response submitted!</p>
          <p className="text-muted-foreground/70 text-sm mt-1">Thank you for your input</p>
        </Card>
      </div>
    );
  }

  const isVisible = (field: any) => {
    if (!field.conditionalOn) return true;
    return String(values[field.conditionalOn.fieldId] || "") === field.conditionalOn.value;
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground">{form.name}</h2>
            {form.description && <p className="text-xs text-muted-foreground/70 mt-0.5">{form.description}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground/70 hover:text-foreground text-lg">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Your name (optional)</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" className="bg-muted border-border text-foreground" />
          </div>

          {fields.filter(isVisible).map((field: any) => (
            <div key={field.id}>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                {field.label} {field.required && <span className="text-red-400">*</span>}
              </label>
              {field.helpText && <p className="text-xs text-muted-foreground/60 mb-1">{field.helpText}</p>}

              {field.type === "text" && (
                <Input value={values[field.id] || ""} onChange={e => setValue(field.id, e.target.value)} placeholder={field.placeholder} required={field.required} className="bg-muted border-border text-foreground" />
              )}
              {field.type === "textarea" && (
                <textarea value={values[field.id] || ""} onChange={e => setValue(field.id, e.target.value)} placeholder={field.placeholder} required={field.required} rows={3}
                  className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground text-sm resize-none" />
              )}
              {field.type === "select" && (
                <select value={values[field.id] || ""} onChange={e => setValue(field.id, e.target.value)} required={field.required} className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground text-sm">
                  <option value="">Select…</option>
                  {(field.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
              {field.type === "radio" && (
                <div className="space-y-1.5">
                  {(field.options || []).map((o: string) => (
                    <label key={o} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name={field.id} value={o} checked={values[field.id] === o} onChange={() => setValue(field.id, o)} required={field.required} className="text-blue-500" />
                      <span className="text-sm text-foreground/70">{o}</span>
                    </label>
                  ))}
                </div>
              )}
              {field.type === "checkbox" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!values[field.id]} onChange={e => setValue(field.id, e.target.checked)} className="text-blue-500" />
                  <span className="text-sm text-foreground/70">{field.placeholder || field.label}</span>
                </label>
              )}
              {field.type === "rating" && (
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setValue(field.id, n)}
                      className={`w-10 h-10 rounded-full text-sm font-bold border transition-all ${parseInt(values[field.id]) >= n ? "bg-amber-500 border-amber-500 text-white" : "border-border text-muted-foreground hover:border-amber-500"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {field.type === "number" && (
                <Input type="number" value={values[field.id] || ""} onChange={e => setValue(field.id, e.target.value)} placeholder={field.placeholder} required={field.required} className="bg-muted border-border text-foreground" />
              )}
              {field.type === "date" && (
                <Input type="date" value={values[field.id] || ""} onChange={e => setValue(field.id, e.target.value)} required={field.required} className="bg-muted border-border text-foreground" />
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 text-muted-foreground">Cancel</Button>
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
              <Send className="h-4 w-4 mr-2" /> Submit Response
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FormsPage() {
  const { role } = useAuthRole();
  const canCreate = hasPermission(role, "createForm");
  const [forms, setForms] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [respondTo, setRespondTo] = useState<any>(null);
  const [viewForm, setViewForm] = useState<any>(null);
  const [viewResponses, setViewResponses] = useState<any[]>([]);

  const load = useCallback(() => {
    fetch(`${API}/forms`).then(r => r.json()).then(setForms);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleView = async (form: any) => {
    const res = await fetch(`${API}/forms/${form.id}`);
    const d = await res.json();
    setViewForm(d.form);
    setViewResponses(d.responses);
  };

  const filtered = forms.filter(f => {
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || f.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {respondTo && <FormResponder form={respondTo} onClose={() => { setRespondTo(null); }} />}

      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-400" /> Forms Engine
            </h1>
            <p className="text-xs text-muted-foreground/70 mt-0.5">CSAT · Kickoff checklists · Sign-offs · Readiness gates</p>
          </div>
          {canCreate && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> New Form
            </Button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          {[
            { label: "Total Forms", value: String(forms.length) },
            { label: "Active", value: String(forms.filter(f => f.status === "active").length) },
            { label: "Form Types", value: String(new Set(forms.map(f => f.type)).size) },
            { label: "CSAT Forms", value: String(forms.filter(f => f.type === "csat").length) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-muted/50 rounded-lg px-3 py-2.5">
              <p className="text-xs text-muted-foreground/70">{label}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {viewForm ? (
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <button onClick={() => setViewForm(null)} className="text-xs text-muted-foreground/70 hover:text-foreground/70 mb-2">← Back to forms</button>
              <h2 className="text-lg font-semibold text-foreground">{viewForm.name}</h2>
            </div>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setRespondTo(viewForm)}>
              <Send className="h-4 w-4 mr-2" /> Respond
            </Button>
          </div>
          <Tabs defaultValue="responses">
            <TabsList className="bg-card border border-border mb-4">
              <TabsTrigger value="responses" className="data-[state=active]:bg-muted">Responses ({viewResponses.length})</TabsTrigger>
              <TabsTrigger value="fields" className="data-[state=active]:bg-muted">Fields ({(viewForm.fields || []).length})</TabsTrigger>
            </TabsList>
            <TabsContent value="responses"><ResponseViewer responses={viewResponses} /></TabsContent>
            <TabsContent value="fields">
              <div className="space-y-2">
                {(viewForm.fields || []).map((f: any, i: number) => (
                  <Card key={f.id} className="bg-card border-border">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground/60 font-mono w-5">{i + 1}</span>
                          <p className="text-sm text-foreground">{f.label}</p>
                          {f.required && <span className="text-[10px] text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded">required</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {f.conditionalOn && <span className="text-[10px] text-amber-400">conditional</span>}
                          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{f.type}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search forms…" className="pl-9 bg-card border-border text-foreground placeholder:text-muted-foreground/70" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {["all", ...Object.keys(FORM_TYPES)].map(t => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${typeFilter === t ? "bg-border text-foreground" : "text-muted-foreground/70 hover:text-foreground/70 hover:bg-muted"}`}>
                  {t === "all" ? "All" : FORM_TYPES[t]?.label || t}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No forms found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your search or create a new form</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(f => (
                <FormCard key={f.id} form={f} onRespond={() => setRespondTo(f)} onView={() => handleView(f)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
