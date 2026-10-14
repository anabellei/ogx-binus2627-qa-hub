"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ExternalLink, Search, Info } from "lucide-react";
import type { EpView } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/types";
import { Avatar, Bar, Chip, cn, pctOf } from "./ui";

type Sort = "attention" | "progress" | "name";

export default function Dashboard({ eps, warnings, sheetUrl, product }: { eps: EpView[]; warnings: string[]; sheetUrl: string; product: string }) {
  const [q, setQ] = useState("");
  const [resp, setResp] = useState("All");
  const [sort, setSort] = useState<Sort>("attention");
  const [showWarn, setShowWarn] = useState(false);

  const responsibles = useMemo(() => ["All", ...Array.from(new Set(eps.map((e) => e.responsible))).sort()], [eps]);
  const totals = useMemo(() => {
    const done = eps.reduce((a, e) => a + e.done, 0), total = eps.reduce((a, e) => a + e.total, 0);
    return { done, total, missing: total - done, attention: eps.reduce((a, e) => a + e.attention, 0) };
  }, [eps]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const f = eps.filter((e) => (resp === "All" || e.responsible === resp) && (!t || `${e.name} ${e.hostLC} ${e.program}`.toLowerCase().includes(t)));
    const p = (e: EpView) => pctOf(e.done, e.total);
    return [...f].sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name)
      : sort === "progress" ? p(a) - p(b)
      : (b.total - b.done) - (a.total - a.done));
  }, [eps, q, resp, sort]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Exchange Standard QA</h1>
          <p className="mt-1 text-sm text-slate-500">Pick an EP to see what's uploaded and what's still missing.</p>
        </div>
        <a href={sheetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
          Open tracker sheet <ExternalLink size={14} />
        </a>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="EPs" value={eps.length} />
        <Stat label="Overall complete" value={`${pctOf(totals.done, totals.total)}%`} />
        <Stat label="Items missing" value={totals.missing} />
        <Stat label="Need attention" value={totals.attention} tone={totals.attention ? "amber" : undefined} hint="Ticked without a file, or file without a tick" />
      </div>

      {warnings.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70">
          <button onClick={() => setShowWarn((s) => !s)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-amber-900" aria-expanded={showWarn}>
            <Info size={16} /> Sheet health: {warnings.length} note{warnings.length > 1 ? "s" : ""}
            <ChevronDown size={16} className={cn("ml-auto transition", showWarn && "rotate-180")} />
          </button>
          {showWarn && <ul className="list-disc space-y-1 px-9 pb-3 text-sm text-amber-900/90">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <span className="sr-only">Search EPs</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, host LC, program…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400" />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by responsible">
          {responsibles.map((r) => (
            <button key={r} onClick={() => setResp(r)} aria-pressed={resp === r}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", resp === r ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>{r}</button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-500">Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700">
            <option value="attention">Most missing first</option>
            <option value="progress">Lowest progress first</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
      </div>

      {list.length === 0 ? (
        <p className="mt-10 text-center text-sm text-slate-500">No EPs match that filter.</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => <li key={e.key}><EpCard ep={e} product={product} /></li>)}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string | number; tone?: "amber"; hint?: string }) {
  return (
    <div title={hint} className={cn("rounded-xl border bg-white p-4", tone === "amber" ? "border-amber-200" : "border-slate-200")}>
      <div className={cn("text-2xl font-bold", tone === "amber" ? "text-amber-600" : "text-slate-900")}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function EpCard({ ep, product }: { ep: EpView; product: string }) {
  const pct = pctOf(ep.done, ep.total), missing = ep.total - ep.done;
  return (
    <Link href={`/ep/${ep.key}?p=${product}`} className="group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900 group-hover:text-brand-700">{ep.name}</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">{[ep.hostLC, ep.program].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="text-right"><div className="text-xl font-bold leading-none text-slate-900">{pct}%</div></div>
      </div>
      <Bar done={ep.done} total={ep.total} className="mt-3" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(["preparation", "experience", "post"] as const).map((s) => (
          <div key={s}>
            <div className="truncate text-[10px] uppercase tracking-wide text-slate-400">{STAGE_LABEL[s].replace("-experience", "")}</div>
            <Bar done={ep.stages[s].done} total={ep.stages[s].total} className="mt-1 h-1.5" />
            <div className="mt-0.5 text-[11px] text-slate-500">{ep.stages[s].done}/{ep.stages[s].total}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600"><Avatar name={ep.responsible} size={20} /><span className="truncate">{ep.responsible}</span></span>
        <span className="flex items-center gap-1.5">
          {ep.breakTag && <Chip tone="violet">{ep.breakTag}</Chip>}
          {ep.attention > 0 && <Chip tone="amber"><AlertTriangle size={11} />{ep.attention}</Chip>}
          <Chip tone={missing === 0 ? "green" : "slate"}>{missing === 0 ? "Complete" : `${missing} missing`}</Chip>
        </span>
      </div>
    </Link>
  );
}
