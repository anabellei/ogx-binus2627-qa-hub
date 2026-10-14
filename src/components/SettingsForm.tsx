"use client";
import { useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Plus, Save, Trash2, XCircle } from "lucide-react";
import type { AppConfig, AuditCfg, ProductCfg } from "@/lib/appconfig";
import { cn } from "./ui";

type Check = { state: "idle" | "busy" | "ok" | "bad"; text?: string };

function LinkField({ label, value, onChange, kind, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; kind: "sheet" | "folder"; placeholder: string; hint?: string;
}) {
  const [c, setC] = useState<Check>({ state: "idle" });
  const check = async () => {
    if (!value.trim()) return;
    setC({ state: "busy" });
    const r = await fetch("/api/config/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: value, kind }) });
    const j = await r.json();
    setC(j.ok ? { state: "ok", text: j.title } : { state: "bad", text: j.message });
  };
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1 flex gap-2">
        <input value={value} onChange={(e) => { onChange(e.target.value); setC({ state: "idle" }); }} placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400" />
        <button type="button" onClick={check} disabled={!value.trim() || c.state === "busy"} className="shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          {c.state === "busy" ? <Loader2 size={14} className="animate-spin" /> : "Check"}
        </button>
      </div>
      {c.state === "ok" && <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 size={13} />Opens fine: {c.text}</p>}
      {c.state === "bad" && <p className="mt-1 flex items-start gap-1 text-xs text-red-700"><XCircle size={13} className="mt-0.5 shrink-0" />{c.text}</p>}
      {hint && c.state === "idle" && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </label>
  );
}

const Text = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <label className="block">
    <span className="text-xs font-medium text-slate-600">{label}</span>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400" />
  </label>
);

export default function SettingsForm({ initial, demo }: { initial: AppConfig; demo: boolean }) {
  const [cfg, setCfg] = useState<AppConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const setP = (i: number, patch: Partial<ProductCfg>) => setCfg((c) => ({ ...c, products: c.products.map((p, k) => (k === i ? { ...p, ...patch } : p)) }));
  const setA = (i: number, patch: Partial<AuditCfg>) => setCfg((c) => ({ ...c, audits: c.audits.map((a, k) => (k === i ? { ...a, ...patch } : a)) }));

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setCfg(j); setMsg({ ok: true, text: "Saved." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Paste links here instead of editing code. Everything is saved in your Drive root folder, so it survives redeploys.</p>
      {demo && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Demo mode: changes live in memory only.</p>}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <div><h2 className="text-lg font-semibold text-slate-900">Products</h2><p className="text-sm text-slate-500">One per tracker (e.g. GV, GTa). Each has its own sheet and Drive folder.</p></div>
          <button onClick={() => setCfg((c) => ({ ...c, products: [...c.products, { key: "", label: "", sheetUrl: "", folderUrl: "", realPrefix: "3.0", prepPrefix: "2.1", auditTab: "" }] }))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><Plus size={14} />Add product</button>
        </div>
        <div className="mt-3 space-y-4">
          {cfg.products.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No products yet. Add GV to get started.</p>}
          {cfg.products.map((p, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="grid flex-1 gap-3">
                  <Text label="Name" value={p.label} onChange={(v) => setP(i, { label: v })} placeholder="GV" />
                  <LinkField label="Tracker sheet link" kind="sheet" value={p.sheetUrl} onChange={(v) => setP(i, { sheetUrl: v })} placeholder="https://docs.google.com/spreadsheets/d/…" />
                  <LinkField label="Drive folder with the EP folders" kind="folder" value={p.folderUrl} onChange={(v) => setP(i, { folderUrl: v })} placeholder="https://drive.google.com/drive/folders/…  (the GV folder)" hint="Leave empty to use a sub-folder named like the product inside the main folder." />
                </div>
                <button onClick={() => setCfg((c) => ({ ...c, products: c.products.filter((_, k) => k !== i) }))} aria-label="Remove product" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
              <details className="group mt-3">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-slate-500"><ChevronDown size={14} className="transition group-open:rotate-180" />Advanced: tab names</summary>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <Text label="Realization tab starts with" value={p.realPrefix} onChange={(v) => setP(i, { realPrefix: v })} />
                  <Text label="Preparation tab starts with" value={p.prepPrefix} onChange={(v) => setP(i, { prepPrefix: v })} />
                  <Text label="Tab in the quarterly audit sheet" value={p.auditTab} onChange={(v) => setP(i, { auditTab: v })} placeholder="OGV" />
                </div>
              </details>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div><h2 className="text-lg font-semibold text-slate-900">Audits</h2><p className="text-sm text-slate-500">One per audit round. Paste the links to your copies of the audit sheets.</p></div>
          <button onClick={() => setCfg((c) => ({ ...c, audits: [...c.audits, { id: "", label: "", quarterlyUrl: "", monthlyUrl: "", month: new Date().toISOString().slice(0, 7), ecbEmails: [] }] }))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><Plus size={14} />Add audit</button>
        </div>
        <div className="mt-3 space-y-4">
          {cfg.audits.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No audits yet.</p>}
          {cfg.audits.map((a, i) => (
            <div key={i} className={cn("rounded-2xl border bg-white p-4 shadow-sm", a.submitted ? "border-emerald-200" : "border-slate-200")}>
              <div className="flex items-start gap-3">
                <div className="grid flex-1 gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Text label="Name" value={a.label} onChange={(v) => setA(i, { label: v })} placeholder="Q3 2026 audit" />
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">Audit month</span>
                      <input type="month" value={a.month} onChange={(e) => setA(i, { month: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
                      <span className="mt-1 block text-xs text-slate-400">Covers this month and the 2 before it (October → Aug, Sep, Oct).</span>
                    </label>
                  </div>
                  <LinkField label="Quarterly audit sheet (your copy)" kind="sheet" value={a.quarterlyUrl} onChange={(v) => setA(i, { quarterlyUrl: v })} placeholder="https://docs.google.com/spreadsheets/d/…" />
                  <LinkField label="Monthly & APD control report (your copy)" kind="sheet" value={a.monthlyUrl} onChange={(v) => setA(i, { monthlyUrl: v })} placeholder="https://docs.google.com/spreadsheets/d/…" />
                  <Text label="ECB emails that must have access (comma separated)" value={a.ecbEmails.join(", ")} onChange={(v) => setA(i, { ecbEmails: v.split(",").map((x) => x.trim()) })} placeholder="ecb.idn@aiesec.net, ecbidn.ac@aiesec.net" />
                  {a.submitted && <p className="text-xs font-medium text-emerald-700">Submitted and locked. Unlock it from the audit page if needed.</p>}
                </div>
                <button onClick={() => setCfg((c) => ({ ...c, audits: c.audits.filter((_, k) => k !== i) }))} aria-label="Remove audit" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <p className={cn("text-sm", msg ? (msg.ok ? "text-emerald-700" : "text-red-700") : "text-slate-400")} role="status">{msg?.text ?? "Unsaved changes are lost if you leave."}</p>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
