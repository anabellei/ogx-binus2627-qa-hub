"use client";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Circle, ExternalLink, FileUp, Layers, Link2,
  Loader2, MinusCircle, RefreshCw, Search, Undo2, UploadCloud, X, Check, Ban, PauseCircle, CircleDashed,
} from "lucide-react";
import type { EpView, ItemDef, ItemState, StageKey } from "@/lib/types";
import { MAX_FILE_BYTES, STAGE_LABEL, STAGE_ORDER } from "@/lib/types";
import { uploadFile } from "@/lib/upload-client";
import { Avatar, Bar, Chip, Ring, cn, pctOf } from "./ui";

interface Busy { name: string; pct: number; phase: "upload" | "save" }
interface Toast { id: number; kind: "ok" | "err"; text: string }

export default function EpChecklist({ initial, items, sheetUrl, product }: { initial: EpView; items: ItemDef[]; sheetUrl: string; product: string }) {
  const [ep, setEp] = useState(initial);
  const [busy, setBusy] = useState<Record<string, Busy>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [stage, setStage] = useState<StageKey | "all">("all");
  const [missingOnly, setMissingOnly] = useState(false);
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const tid = useRef(0);

  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++tid.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 8000 : 4500);
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await fetch(`/api/tracker?ep=${ep.key}&p=${product}`); const j = await r.json();
      if (!r.ok) throw new Error(j.error); setEp(j.ep); toast("ok", "Synced with the tracker sheet.");
    } catch (e) { toast("err", (e as Error).message); } finally { setRefreshing(false); }
  };

  const runUpload = async (item: ItemDef, files: File[]) => {
    if (!files.length) return;
    if (!item.multi && files.length > 1) { toast("err", `"${item.label}" takes one file. You selected ${files.length}.`); return; }
    const big = files.find((f) => f.size > MAX_FILE_BYTES);
    if (big) { toast("err", `${big.name} is over 250 MB.`); return; }
    const ids: string[] = []; const names: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setBusy((b) => ({ ...b, [item.key]: { name: files[i].name, pct: i / files.length, phase: "upload" } }));
        const r = await uploadFile(product, ep.key, item.key, files[i], (f) =>
          setBusy((b) => ({ ...b, [item.key]: { name: files[i].name, pct: (i + f) / files.length, phase: "upload" } })));
        ids.push(r.fileId); names.push(r.name);
      }
      setBusy((b) => ({ ...b, [item.key]: { name: "", pct: 1, phase: "save" } }));
      const res = await fetch("/api/upload/finish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, ep: ep.key, item: item.key, fileIds: ids }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Saved the file but couldn't update the sheet.");
      setEp(j.ep);
      toast("ok", `${names.length > 1 ? `${names.length} files` : names[0]} saved${item.mirrorsPrep && ep.hasPrep ? " · Realization + Preparation tabs updated" : " · sheet updated"}.`);
    } catch (e) { toast("err", (e as Error).message); }
    finally { setBusy((b) => { const n = { ...b }; delete n[item.key]; return n; }); }
  };

  const mark = async (item: ItemDef, action: "nodiff" | "reset" | "tick" | "sync") => {
    setBusy((b) => ({ ...b, [item.key]: { name: "", pct: 1, phase: "save" } }));
    try {
      const res = await fetch("/api/mark", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product, ep: ep.key, item: item.key, action }) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error);
      setEp(j.ep);
      toast("ok", action === "nodiff" ? "Marked “No difference”." : action === "reset" ? "Reset to pending." : action === "tick" ? "Ticked in the sheet." : "Preparation tab updated.");
    } catch (e) { toast("err", (e as Error).message); }
    finally { setBusy((b) => { const n = { ...b }; delete n[item.key]; return n; }); }
  };

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter((i) => {
      const s = ep.states[i.key]; if (!s) return false;
      if (stage !== "all" && i.stage !== stage) return false;
      if (missingOnly && (s.status === "done" || s.status === "nodiff" || (!i.required && s.status === "missing"))) return false;
      if (t && !`${i.label} ${i.standard}`.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [items, ep.states, stage, missingOnly, q]);

  const groups = useMemo(() => {
    const out: { stage: StageKey; standard: string; items: ItemDef[] }[] = [];
    for (const s of STAGE_ORDER) {
      const inStage = visible.filter((i) => i.stage === s);
      for (const std of Array.from(new Set(inStage.map((i) => i.standard)))) out.push({ stage: s, standard: std, items: inStage.filter((i) => i.standard === std) });
    }
    return out;
  }, [visible]);

  const pct = pctOf(ep.done, ep.total);
  const stageTabs: { key: StageKey | "all"; label: string; done: number; total: number }[] = [
    { key: "all", label: "All", done: ep.done, total: ep.total },
    ...STAGE_ORDER.filter((s) => ep.stages[s].total > 0).map((s) => ({ key: s, label: STAGE_LABEL[s], ...ep.stages[s] })),
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-5">
      <Link href={`/?p=${product}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={15} /> All EPs</Link>

      <div className="mt-3 flex flex-wrap items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {ep.onBreak
          ? <div className="grid h-[84px] w-[84px] shrink-0 place-items-center rounded-full bg-violet-50 text-violet-500" title="On break"><PauseCircle size={34} /></div>
          : <Ring pct={pct} />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{ep.name}</h1>
            {ep.breakTag && <Chip tone="violet">{ep.breakTag}</Chip>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            {ep.hostLC && <span>{ep.hostLC}</span>}{ep.program && <span>· {ep.program}</span>}
            <span className="flex items-center gap-1.5">· <Avatar name={ep.responsible} size={18} />{ep.responsible}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Chip tone="green"><Check size={11} />{ep.done} done</Chip>
            {ep.onBreak ? <Chip tone="violet">On break · documents don't count</Chip> : <>
              <Chip>{ep.total - ep.done - ep.attention} missing</Chip>
              {ep.attention > 0 && <Chip tone="amber"><AlertTriangle size={11} />{ep.attention} need attention</Chip>}</>}
            {!ep.hasPrep && <Chip tone="amber" title="No matching column on the Preparation tab">No Preparation-tab column</Chip>}
          </div>
        </div>
        <div className="flex gap-2 self-start">
          <button onClick={refresh} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60" title="Re-read the tracker sheet">
            <RefreshCw size={14} className={cn(refreshing && "animate-spin")} /> Sync
          </button>
          <a href={sheetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Sheet <ExternalLink size={13} /></a>
        </div>
      </div>

      {ep.onBreak && <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800">This EP is on break ({ep.breakTag}), so their documents aren't counted as missing and don't affect the totals. You can still upload if you need to.</p>}

      <div className="sticky top-14 z-20 -mx-4 mt-4 border-b border-slate-200 bg-slate-50/90 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Stage">
            {stageTabs.map((t) => (
              <button key={t.key} role="tab" aria-selected={stage === t.key} onClick={() => setStage(t.key)}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", stage === t.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100")}>
                {t.label} <span className={cn("ml-1", stage === t.key ? "text-slate-300" : "text-slate-400")}>{t.done}/{t.total}</span>
              </button>
            ))}
          </div>
          <label className="ml-auto flex cursor-pointer select-none items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} className="h-4 w-4 rounded border-slate-300" /> Missing only
          </label>
          <label className="relative w-full sm:w-52">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <span className="sr-only">Search items</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an item…" className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-sm placeholder:text-slate-400" />
          </label>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="mt-12 text-center text-sm text-slate-500">
          <CheckCircle2 className="mx-auto mb-2 text-emerald-500" />{missingOnly ? "Nothing missing here. Nice work." : "No items match."}
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {groups.map((g) => {
            const req = g.items.filter((i) => i.required);
            const d = req.filter((i) => ["done", "nodiff"].includes(ep.states[i.key].status)).length;
            return (
              <section key={g.stage + g.standard} aria-labelledby={`h-${g.stage}-${g.standard}`}>
                <div className="mb-2 flex items-center gap-3 px-1">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{STAGE_LABEL[g.stage]}</div>
                    <h2 id={`h-${g.stage}-${g.standard}`} className="truncate text-sm font-semibold text-slate-800">{g.standard.replace(/^0/, "#")}</h2>
                  </div>
                  {req.length > 0 ? <div className="ml-auto flex w-28 items-center gap-2"><Bar done={d} total={req.length} className="h-1.5" /><span className="text-xs text-slate-500">{d}/{req.length}</span></div> : <span className="ml-auto text-xs text-slate-400">optional</span>}
                </div>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {g.items.map((i) => (
                    <ItemRow key={i.key} item={i} state={ep.states[i.key]} ep={ep} busy={busy[i.key]}
                      onFiles={(f) => runUpload(i, f)} onMark={(a) => mark(i, a)} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={cn("pointer-events-auto flex animate-pop items-start gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-lg",
            t.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900")}>
            {t.kind === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <Ban size={16} className="mt-0.5 shrink-0" />}
            <span className="flex-1">{t.text}</span>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss"><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemRow({ item, state, ep, busy, onFiles, onMark }: {
  item: ItemDef; state: ItemState; ep: EpView; busy?: Busy;
  onFiles: (f: File[]) => void; onMark: (a: "nodiff" | "reset" | "tick" | "sync") => void;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const done = state.status === "done", nodiff = state.status === "nodiff", att = state.status === "attention";
  const optionalMissing = !item.required && state.status === "missing";
  const Icon = done ? CheckCircle2 : nodiff ? MinusCircle : att ? AlertTriangle : optionalMissing ? CircleDashed : Circle;
  const iconCls = done ? "text-emerald-500" : nodiff ? "text-violet-400" : att ? "text-amber-500" : "text-slate-300";
  const canUpload = !nodiff;
  const verb = item.multi ? (state.link ? "Add files" : "Upload") : state.link ? "Replace" : "Upload";

  return (
    <li
      onDragOver={(e) => { if (canUpload && !busy) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (canUpload && !busy) onFiles(Array.from(e.dataTransfer.files)); }}
      className={cn("relative flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 transition sm:px-4", over && "bg-brand-50 ring-2 ring-inset ring-brand-500")}
    >
      <Icon size={20} className={cn("shrink-0", iconCls)} aria-label={state.status} />
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("text-sm font-medium", done || nodiff ? "text-slate-700" : "text-slate-900")}>{item.label.trim()}</span>
          {item.owner && <Chip tone={item.owner === "Home" ? "blue" : "slate"}>{item.owner}</Chip>}
          {item.multi && <Chip tone="slate" title="Accepts several files, stored in their own folder"><Layers size={11} />Multiple</Chip>}
          {item.mirrorsPrep && ep.hasPrep && (
            state.prepSynced === false && (done || att)
              ? <Chip tone="amber" title="Not yet linked on the Preparation tab"><Link2 size={11} />Prep tab missing</Chip>
              : <Chip tone="green" title="One upload fills both tabs"><Link2 size={11} />+ Prep tab</Chip>
          )}
          {nodiff && <Chip tone="violet">No difference</Chip>}
          {!item.required && <Chip tone="slate" title="Optional: never counted as missing">Optional</Chip>}
        </div>
        {att && state.note && <div className="mt-0.5 text-xs text-amber-700">{state.note}</div>}
        {!done && !nodiff && !att && !busy && (
          <div className="mt-0.5 truncate text-xs text-slate-400">Saves as <span className="font-mono">{ep.short}_{item.slug}{item.multi ? "_01" : ""}.ext</span> · {item.folder.map((f) => f.replace(/^\d+ /, "")).join(" / ")}</div>
        )}
        {busy && (
          <div className="mt-1.5">
            <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-200">
              {busy.phase === "save"
                ? <div className="absolute inset-y-0 w-1/3 animate-slide rounded-full bg-brand-500" />
                : <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.max(4, Math.round(busy.pct * 100))}%` }} />}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 size={12} className="animate-spin" />
              {busy.phase === "save" ? "Updating the sheet…" : <>Uploading <span className="truncate font-medium">{busy.name}</span> · {Math.round(busy.pct * 100)}%</>}
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {state.link && (
          <a href={state.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100" aria-label={`Open ${item.label}`}>
            Open <ExternalLink size={12} />
          </a>
        )}
        {state.status === "done" && item.mirrorsPrep && ep.hasPrep && state.prepSynced === false && (
          <button disabled={!!busy} onClick={() => onMark("sync")} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50">Sync to Prep</button>
        )}
        {att && state.link && <button disabled={!!busy} onClick={() => onMark("tick")} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50">Tick it</button>}
        {item.optional && state.status === "missing" && (
          <button disabled={!!busy} onClick={() => onMark("nodiff")} className="rounded-lg border border-violet-200 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50">No difference</button>
        )}
        {nodiff && (
          <button disabled={!!busy} onClick={() => onMark("reset")} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"><Undo2 size={12} />Undo</button>
        )}
        {canUpload && (
          <>
            <input ref={input} type="file" hidden multiple={item.multi}
              onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; onFiles(f); }} />
            <button disabled={!!busy} onClick={() => input.current?.click()}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                state.link || !item.required ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "bg-brand-600 text-white hover:bg-brand-700")}>
              {state.link ? <FileUp size={13} /> : <UploadCloud size={13} />}{verb}
            </button>
          </>
        )}
      </div>
      {over && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-brand-50/80 text-sm font-semibold text-brand-700">Drop to upload to “{item.label.trim()}”</div>}
    </li>
  );
}
