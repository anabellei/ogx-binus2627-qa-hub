"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Lock, LockOpen, Search, Share2, X, Loader2, CheckCircle2 } from "lucide-react";
import type { AuditOverview as Data } from "@/lib/audit-service";
import { Bar, Chip, cn, pctOf } from "./ui";

const PHASE_TONE = { due: "blue", later: "slate", earlier: "slate" } as const;

export default function AuditOverview({ data, product }: { data: Data; product: string }) {
  const router = useRouter();
  const [onlyIn, setOnlyIn] = useState(true);
  const [q, setQ] = useState("");
  const [dlg, setDlg] = useState<null | "share" | "lock">(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; text: string; list?: string[] } | null>(null);
  const a = data.audit;

  const rows = useMemo(() => data.rows.filter((r) => (!onlyIn || r.q?.inAudit || (!r.q && r.m)) && (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()))), [data.rows, onlyIn, q]);
  const hiddenCount = data.rows.length - data.rows.filter((r) => r.q?.inAudit || (!r.q && r.m)).length;

  const call = async (url: string, body: object) => {
    setBusy(true); setRes(null);
    try { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }
    catch (e) { setRes({ ok: false, text: (e as Error).message }); return null; } finally { setBusy(false); }
  };
  const share = async () => {
    const j = await call("/api/audit/share", { audit: a.id });
    if (j) setRes({ ok: !j.failed.length, text: j.failed.length ? "Some people couldn't be added:" : "Shared. They can now view everything in the audit folder.", list: j.failed.length ? j.failed : j.emails });
  };
  const lock = async () => { if (await call("/api/audit/submit", { audit: a.id, submitted: !a.submitted })) { setDlg(null); router.refresh(); } };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-4">
      <Link href="/audit" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={15} />All audits</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{a.label}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{data.window.label}</span>
            {data.window.tags.map((t) => <Chip key={t} tone="blue">[{t}]</Chip>)}
            {a.submitted && <Chip tone="green"><Lock size={11} />Submitted · locked</Chip>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setRes(null); setDlg("share"); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><Share2 size={14} />Share with ECB</button>
          <button onClick={() => { setRes(null); setDlg("lock"); }} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium", a.submitted ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "bg-slate-900 text-white hover:bg-slate-800")}>
            {a.submitted ? <><LockOpen size={14} />Unlock</> : <><Lock size={14} />Mark as submitted</>}
          </button>
        </div>
      </div>

      {(data.errors.q || data.errors.m) && (
        <div className="mt-4 space-y-2">
          {data.errors.q && <Problem title="Quarterly audit sheet" text={data.errors.q} />}
          {data.errors.m && <Problem title="Monthly report sheet" text={data.errors.m} />}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><span className="sr-only">Search EPs</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an EP…" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400" />
        </label>
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={onlyIn} onChange={(e) => setOnlyIn(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Only EPs in this audit window{hiddenCount > 0 && onlyIn && <span className="text-slate-400">({hiddenCount} hidden)</span>}
        </label>
      </div>

      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.key}>
            <Link href={`/audit/${a.id}/${r.key}?p=${product}`} className="group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-slate-900 group-hover:text-brand-700">{r.name}</div>
                {r.q && !r.q.inAudit && <Chip>No APD / RE / FI in this window</Chip>}
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {r.q ? (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500"><span>Quarterly audit</span><span>{r.q.filled}/{r.q.total} documents</span></div>
                    <Bar done={r.q.filled} total={r.q.total} className="h-1.5" />
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.q.blocks.map((b) => (
                        <Chip key={b.code} tone={PHASE_TONE[b.phase as keyof typeof PHASE_TONE]} title={b.phase === "due" ? "Due in this audit" : b.phase === "later" ? "Not reached yet → Next Quarter" : "Covered in an earlier audit"}>
                          {b.code.replace(/^OGX\d+-?|^ELD\d+-?/i, (m) => m.replace("-", "")) || b.code}{b.phase === "due" ? ` · [${b.tag}] ${b.filled}/${b.total}` : b.phase === "later" ? " · next qtr" : " · earlier"}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ) : <div className="text-xs text-slate-400">Not listed in the quarterly sheet.</div>}
                {r.m ? (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500"><span>Monthly / APD report</span><span>{r.m.filled}/{r.m.total} documents · {r.m.datesFilled}/{r.m.datesTotal} dates</span></div>
                    <Bar done={r.m.filled} total={r.m.total} className="h-1.5" />
                    <div className="mt-2 text-xs text-slate-400">{pctOf(r.m.filled, r.m.total)}% of document cells filled</div>
                  </div>
                ) : <div className="text-xs text-slate-400">Not listed in the monthly report.</div>}
              </div>
            </Link>
          </li>
        ))}
        {rows.length === 0 && !data.errors.q && !data.errors.m && <li className="py-10 text-center text-sm text-slate-500">No EPs to show.</li>}
      </ul>

      {dlg && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md animate-pop rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between"><h2 className="text-lg font-semibold text-slate-900">{dlg === "share" ? "Share the audit folder?" : a.submitted ? "Unlock this audit?" : "Mark as submitted?"}</h2>
              <button onClick={() => setDlg(null)} aria-label="Close" className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
            {dlg === "share" ? (
              <>
                <p className="mt-2 text-sm text-slate-600">This gives <b>view access</b> to the whole folder <span className="font-mono text-xs">Audit / {a.label}</span> (every file copied for this audit) to:</p>
                <ul className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{a.ecbEmails.length ? a.ecbEmails.map((e) => <li key={e}>{e}</li>) : <li className="text-red-600">No ECB emails set. Add them in Settings.</li>}</ul>
                <p className="mt-2 text-xs text-slate-500">No notification email is sent. Only do this once the documents are final.</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-600">{a.submitted ? "Editing will be possible again." : "Filling, copying and writing to the sheet will be disabled in this app for this audit. This is a safety lock inside the app; it doesn't change Drive or the sheet permissions."}</p>
            )}
            {res && <div className={cn("mt-3 rounded-lg p-3 text-sm", res.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")}><p className="flex items-start gap-1.5">{res.ok && <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}{res.text}</p>{res.list && <ul className="mt-1 list-disc pl-6 text-xs">{res.list.map((x) => <li key={x}>{x}</li>)}</ul>}</div>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDlg(null)} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">{res?.ok ? "Close" : "Cancel"}</button>
              {!res?.ok && <button onClick={dlg === "share" ? share : lock} disabled={busy || (dlg === "share" && !a.ecbEmails.length)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                {busy && <Loader2 size={14} className="animate-spin" />}{dlg === "share" ? "Share" : a.submitted ? "Unlock" : "Lock it"}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Problem({ title, text }: { title: string; text: string }) {
  return <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><div><b>{title}:</b> {text} <Link href="/settings" className="font-medium underline">Open Settings</Link></div></div>;
}
