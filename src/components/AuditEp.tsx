"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Ban, CalendarClock, CheckCircle2, ChevronDown, Circle, CopyCheck, ExternalLink, FolderOpen,
  Link2, Loader2, Lock, MinusCircle, Plus, X, FileText, Folder, ChevronRight,
} from "lucide-react";
import type { AuditEpDetail, BrowseResult } from "@/lib/audit-service";
import type { MSlotView, SlotView } from "@/lib/audit";
import { Bar, Chip, cn } from "./ui";

type Slot = SlotView | MSlotView;
const fmtDate = (iso?: string) => (iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "no date");
const DATE_LABEL = { approved: "Approved", realized: "Realized", finished: "Finished" } as const;

export default function AuditEp({ initial, product }: { initial: AuditEpDetail; product: string }) {
  const [d, setD] = useState(initial);
  const [tab, setTab] = useState<"q" | "m">(initial.q ? "q" : "m");
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [deferring, setDeferring] = useState(false);
  const locked = d.submitted;

  const flash = (ok: boolean, text: string) => { setToast({ ok, text }); setTimeout(() => setToast(null), ok ? 4000 : 8000); };
  const defer = async () => {
    setDeferring(true);
    try {
      const r = await fetch("/api/audit/defer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audit: d.audit.id, product, ep: d.key }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setD(j.detail); flash(true, "Wrote “Next Quarter” into the empty cells of blocks this EP hasn't reached.");
    } catch (e) { flash(false, (e as Error).message); } finally { setDeferring(false); }
  };

  const qTotals = d.q ? { f: d.q.filled, t: d.q.total } : null;
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-4">
      <Link href={`/audit/${d.audit.id}?p=${product}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={15} />{d.audit.label}</Link>
      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{d.name}</h1>
          <Chip tone="blue">{d.window.label}</Chip>{locked && <Chip tone="green"><Lock size={11} />Locked</Chip>}
          {!d.trackerMatched && <Chip tone="amber" title="No EP with this name in the tracker, so there are no suggested files. You can still paste links.">Not found in tracker</Chip>}
        </div>
        {d.q && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            {(["approved", "realized", "finished"] as const).map((k) => <span key={k}><span className="text-slate-400">{DATE_LABEL[k]}</span> {fmtDate(d.q!.dates[k])}</span>)}
          </div>
        )}
        {qTotals && qTotals.t > 0 && <div className="mt-3 flex items-center gap-3"><Bar done={qTotals.f} total={qTotals.t} /><span className="whitespace-nowrap text-xs text-slate-500">{qTotals.f}/{qTotals.t} due now</span></div>}
      </div>
      {locked && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">This audit is submitted, so changes are disabled. Unlock it from the audit page to edit.</p>}
      {(d.errors.q || d.errors.m) && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{d.errors.q ?? d.errors.m}</p>}

      <div className="mt-5 flex gap-1.5" role="tablist">
        {([["q", "Quarterly audit", d.q], ["m", "Monthly / APD report", d.m]] as const).map(([k, label, v]) => (
          <button key={k} role="tab" aria-selected={tab === k} disabled={!v} onClick={() => setTab(k)}
            className={cn("rounded-full border px-4 py-1.5 text-sm font-medium transition disabled:opacity-40", tab === k ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>{label}</button>
        ))}
      </div>

      {tab === "q" && d.q && (
        <div className="mt-4 space-y-5">
          {!d.q.inAudit && <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">This EP has no approval, realization or finish date inside {d.window.label}, so it isn't part of this audit.</p>}
          {d.q.blocks.map((b) => (
            <BlockCard key={b.code} b={b} d={d} product={product} locked={locked} open={open} setOpen={setOpen} onDetail={(x, m) => { setD(x); flash(true, m); }} onError={(m) => flash(false, m)}
              onDefer={b.phase === "later" ? defer : undefined} deferring={deferring} />
          ))}
        </div>
      )}

      {tab === "m" && d.m && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {d.m.dates.map((x) => <Chip key={x.label} tone={x.filled ? "green" : "amber"}>{x.filled ? <CheckCircle2 size={11} /> : <CalendarClock size={11} />}{x.label}</Chip>)}
            <span className="text-xs text-slate-400">Dates are filled directly in the sheet.</span>
          </div>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {d.m.slots.map((s) => <SlotRow key={s.id} s={s} d={d} product={product} locked={locked} open={open === s.id} setOpen={(o) => setOpen(o ? s.id : null)} onDetail={(x, m) => { setD(x); flash(true, m); }} onError={(m) => flash(false, m)} />)}
          </ul>
        </div>
      )}

      {toast && <div role="status" className={cn("fixed bottom-4 right-4 z-40 flex w-[min(92vw,380px)] animate-pop items-start gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-lg", toast.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900")}>
        {toast.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <Ban size={16} className="mt-0.5 shrink-0" />}<span className="flex-1">{toast.text}</span></div>}
    </div>
  );
}

function BlockCard({ b, d, product, locked, open, setOpen, onDetail, onError, onDefer, deferring }: {
  b: NonNullable<AuditEpDetail["q"]>["blocks"][number]; d: AuditEpDetail; product: string; locked: boolean; open: string | null; setOpen: (v: string | null) => void;
  onDetail: (d: AuditEpDetail, m: string) => void; onError: (m: string) => void; onDefer?: () => void; deferring: boolean;
}) {
  const [show, setShow] = useState(b.phase === "due");
  const hasEmpty = b.slots.some((s) => s.status === "missing");
  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-white", b.phase === "due" ? "border-slate-200 shadow-sm" : "border-slate-200/70")}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button onClick={() => setShow((x) => !x)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={show}>
          <ChevronDown size={16} className={cn("shrink-0 text-slate-400 transition", show && "rotate-180")} />
          <span className="truncate font-semibold text-slate-900">{b.code}</span>
          {b.phase === "due" && <Chip tone="blue">Due now · [{b.tag}]</Chip>}
          {b.phase === "later" && <Chip>Next quarter</Chip>}
          {b.phase === "earlier" && <Chip>Covered earlier</Chip>}
          <span className="text-xs text-slate-400">{DATE_LABEL[b.dateType]} {fmtDate(b.date)}</span>
        </button>
        <span className="text-xs text-slate-500">{b.filled}/{b.total}</span>
        {onDefer && hasEmpty && !locked && (
          <button onClick={onDefer} disabled={deferring} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {deferring ? <Loader2 size={12} className="animate-spin" /> : <CalendarClock size={12} />}Write “Next Quarter”
          </button>
        )}
      </div>
      {show && (
        <>
          {b.phase !== "due" && <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">{b.phase === "later" ? "This phase hasn't happened in the window yet, so nothing is due. The sheet expects “Next Quarter”." : "This phase was dated before the window, so it belongs to an earlier audit. You can still fill it if ECB asks."}</p>}
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {b.slots.map((s) => <SlotRow key={s.id} s={s} d={d} product={product} locked={locked} open={open === s.id} setOpen={(o) => setOpen(o ? s.id : null)} onDetail={onDetail} onError={onError} />)}
          </ul>
        </>
      )}
    </section>
  );
}

function SlotRow({ s, d, product, locked, open, setOpen, onDetail, onError }: {
  s: Slot; d: AuditEpDetail; product: string; locked: boolean; open: boolean; setOpen: (o: boolean) => void;
  onDetail: (d: AuditEpDetail, m: string) => void; onError: (m: string) => void;
}) {
  const crit = "criteria" in s ? s.criteria : [];
  const fmt = "format" in s ? s.format : "";
  const Icon = s.status === "filled" ? CheckCircle2 : s.status === "partial" ? AlertTriangle : s.status === "deferred" ? MinusCircle : Circle;
  const cls = s.status === "filled" ? "text-emerald-500" : s.status === "partial" ? "text-amber-500" : s.status === "deferred" ? "text-violet-400" : "text-slate-300";
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <Icon size={20} className={cn("mt-0.5 shrink-0", cls)} aria-label={s.status} />
        <div className="min-w-0 flex-1 basis-60">
          <div className="text-sm font-medium text-slate-900">{s.label}</div>
          {"requirement" in s && s.requirement && s.requirement !== s.label && <div className="mt-0.5 text-xs text-slate-500">{s.requirement}</div>}
          {crit.length > 0 && <div className="mt-1 text-xs text-slate-400">{crit.length === 1 ? "Covers: " : `Covers ${crit.length} criteria: `}{crit.join(" · ")}</div>}
          {fmt && <div className="mt-1"><Chip tone="slate"><FileText size={11} />{fmt}</Chip></div>}
          {s.status === "partial" && <div className="mt-1 text-xs text-amber-700">Only some of the covered rows have a link. Filling again will complete them.</div>}
          {s.status === "deferred" && <div className="mt-1 text-xs text-violet-600">Marked “{s.text}” in the sheet.</div>}
          {"auditor" in s && s.auditor && <div className="mt-1 text-xs text-slate-400">Auditor: {s.auditor}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {s.link && <a href={s.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">Open <ExternalLink size={12} /></a>}
          {!locked && <button onClick={() => setOpen(!open)} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition", s.status === "filled" ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "bg-brand-600 text-white hover:bg-brand-700")} aria-expanded={open}>
            <CopyCheck size={13} />{s.status === "filled" ? "Redo" : "Fill"}</button>}
        </div>
      </div>
      {open && <FillPanel s={s} d={d} product={product} onClose={() => setOpen(false)} onDetail={onDetail} onError={onError} />}
    </li>
  );
}

function FillPanel({ s, d, product, onClose, onDetail, onError }: {
  s: Slot; d: AuditEpDetail; product: string; onClose: () => void; onDetail: (d: AuditEpDetail, m: string) => void; onError: (m: string) => void;
}) {
  const suggested = new Set(s.suggest);
  const [sel, setSel] = useState<Set<string>>(new Set(s.suggest));
  const [urls, setUrls] = useState<string[]>(s.mode === "link" && s.sharedLink ? [s.sharedLink] : []);
  const [paste, setPaste] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showAll, setShowAll] = useState(s.suggest.length === 0);

  const list = [...d.sources].sort((a, b) => Number(suggested.has(b.key)) - Number(suggested.has(a.key)));
  const shown = showAll ? list : list.filter((x) => suggested.has(x.key));
  const count = sel.size + urls.length;
  const addUrl = (u: string) => { const t = u.trim(); if (t && !urls.includes(t)) setUrls((x) => [...x, t]); setPaste(""); };

  const go = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/audit/fill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audit: d.audit.id, product, ep: d.key, slot: s.id, items: [...sel], urls }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      onDetail(j.detail, s.mode === "link" ? "Linked in the sheet." : "Copied into the audit folder and linked in the sheet."); onClose();
    } catch (e) { setErr((e as Error).message); onError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="mt-3 animate-pop rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <p className="flex items-start gap-1.5 text-xs text-slate-600"><Link2 size={13} className="mt-0.5 shrink-0" />
        {s.mode === "link" ? "This one is linked as-is (nothing is copied), because it is a shared document." : "Files are copied into the audit folder first, so later changes to the originals can't affect what you submit. The sheet then links to the copies."}</p>

      {d.sources.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between"><span className="text-xs font-semibold text-slate-700">From the QA Hub {suggested.size > 0 && <span className="font-normal text-slate-400">(suggested are pre-ticked)</span>}</span>
            {suggested.size > 0 && <button onClick={() => setShowAll((x) => !x)} className="text-xs font-medium text-brand-700 hover:underline">{showAll ? "Show suggested only" : `Show all ${d.sources.length}`}</button>}</div>
          {shown.length === 0 ? <p className="text-xs text-slate-400">No suggested files have a link yet.</p> : (
            <ul className="max-h-52 space-y-0.5 overflow-auto rounded-lg border border-slate-200 bg-white p-1">
              {shown.map((x) => (
                <li key={x.key}><label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={sel.has(x.key)} onChange={() => setSel((p) => { const n = new Set(p); n.has(x.key) ? n.delete(x.key) : n.add(x.key); return n; })} className="h-4 w-4 rounded border-slate-300" />
                  <span className="flex-1 truncate">{x.label}</span>{suggested.has(x.key) && <Chip tone="blue">suggested</Chip>}<span className="hidden text-xs text-slate-400 sm:inline">{x.stage.replace(/^\d+ /, "")}</span></label></li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => setBrowsing(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><FolderOpen size={13} />Browse this EP's Drive folder</button>
        <form className="flex min-w-[220px] flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); addUrl(paste); }}>
          <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="…or paste a Drive link" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs placeholder:text-slate-400" />
          <button type="submit" disabled={!paste.trim()} className="rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Plus size={14} /></button>
        </form>
      </div>
      {urls.length > 0 && (
        <ul className="mt-2 space-y-1">{urls.map((u) => (
          <li key={u} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-600 ring-1 ring-slate-200"><Link2 size={12} className="shrink-0 text-slate-400" /><span className="min-w-0 flex-1 truncate">{u}</span>
            <button onClick={() => setUrls((x) => x.filter((y) => y !== u))} aria-label="Remove" className="text-slate-400 hover:text-red-600"><X size={13} /></button></li>))}</ul>
      )}
      {err && <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"><Ban size={13} className="mt-0.5 shrink-0" />{err}</p>}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">Cancel</button>
        <button onClick={go} disabled={busy || count === 0} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <CopyCheck size={13} />}{busy ? "Copying…" : s.mode === "link" ? "Link it" : `Copy ${count || ""} & link`}</button>
      </div>
      {browsing && <Browser name={d.name} product={product} onClose={() => setBrowsing(false)} onPick={(u) => { addUrl(u); }} />}
    </div>
  );
}

function Browser({ name, product, onClose, onPick }: { name: string; product: string; onClose: () => void; onPick: (url: string) => void }) {
  const [r, setR] = useState<BrowseResult | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const load = async (folder?: string) => {
    setLoading(true); setErr("");
    try {
      const res = await fetch(`/api/audit/browse?p=${product}&name=${encodeURIComponent(name)}${folder ? `&folder=${folder}` : ""}`);
      const j = await res.json(); if (!res.ok) throw new Error(j.error); setR(j);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Browse Drive folder">
      <div className="flex max-h-[80vh] w-full max-w-lg animate-pop flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h3 className="font-semibold text-slate-900">{name}'s Drive folder</h3><button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        {r && <div className="flex flex-wrap items-center gap-1 px-5 pt-3 text-xs text-slate-500">{r.crumbs.map((c, i) => <span key={c.id} className="flex items-center gap-1">{i > 0 && <ChevronRight size={12} />}<button onClick={() => load(c.id)} className="hover:text-brand-700 hover:underline">{c.name}</button></span>)}</div>}
        <div className="min-h-[160px] flex-1 overflow-auto p-3">
          {loading && <div className="grid h-32 place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>}
          {err && <p className="m-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
          {!loading && r && (r.items.length === 0 ? <p className="p-6 text-center text-sm text-slate-400">This folder is empty.</p> : (
            <ul>{r.items.map((it) => (
              <li key={it.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                {it.folder ? <Folder size={16} className="shrink-0 text-amber-500" /> : <FileText size={16} className="shrink-0 text-slate-400" />}
                {it.folder ? <button onClick={() => load(it.id)} className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-800 hover:text-brand-700">{it.name}</button> : <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{it.name}</span>}
                <button onClick={() => { onPick(it.link); setPicked((p) => new Set(p).add(it.id)); }} disabled={picked.has(it.id)}
                  className={cn("shrink-0 rounded-md px-2.5 py-1 text-xs font-medium", picked.has(it.id) ? "bg-emerald-50 text-emerald-700" : "border border-slate-200 text-slate-700 hover:bg-slate-100")}>{picked.has(it.id) ? "Added" : it.folder ? "Use folder" : "Add"}</button>
              </li>))}</ul>
          ))}
        </div>
        <div className="border-t border-slate-100 px-5 py-3 text-right"><button onClick={onClose} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Done</button></div>
      </div>
    </div>
  );
}
