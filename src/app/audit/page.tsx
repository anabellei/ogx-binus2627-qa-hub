import Link from "next/link";
import { ArrowRight, CalendarRange, Lock, Settings } from "lucide-react";
import ErrorPanel from "@/components/ErrorPanel";
import { getCtx } from "@/lib/auth";
import { getConfig } from "@/lib/appconfig";
import { windowFor } from "@/lib/audit";

export const dynamic = "force-dynamic";

export default async function AuditHome() {
  let cfg;
  try { cfg = await getConfig((await getCtx()).token); } catch (e) { return <ErrorPanel message={(e as Error).message} />; }
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Audit</h1><p className="mt-1 text-sm text-slate-500">Collect, copy and link the documents ECB asks for.</p></div>
        <Link href="/settings" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><Settings size={14} />Add / edit audits</Link>
      </div>
      {cfg.audits.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <CalendarRange className="mx-auto text-slate-400" />
          <p className="mt-2 font-medium text-slate-800">No audit set up yet</p>
          <p className="mt-1 text-sm text-slate-500">Paste the links to your audit sheets in Settings.</p>
          <Link href="/settings" className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Open Settings</Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {[...cfg.audits].reverse().map((a) => (
            <li key={a.id}>
              <Link href={`/audit/${a.id}?p=${cfg.products[0]?.key ?? ""}`} className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-900 group-hover:text-brand-700">{a.label}</div>
                  {a.submitted && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"><Lock size={11} />Submitted</span>}
                </div>
                <div className="mt-1 text-sm text-slate-500">{windowFor(a.month).label}</div>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-brand-700">Open <ArrowRight size={14} className="transition group-hover:translate-x-0.5" /></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
