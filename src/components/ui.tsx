import type { ReactNode } from "react";

export const cn = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export function Bar({ done, total, className, tone = "brand" }: { done: number; total: number; className?: string; tone?: "brand" | "green" }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-200/80", className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all duration-500", pct === 100 ? "bg-emerald-500" : tone === "green" ? "bg-emerald-500" : "bg-brand-600")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Chip({ children, tone = "slate", title }: { children: ReactNode; tone?: "slate" | "blue" | "amber" | "green" | "violet"; title?: string }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600", blue: "bg-brand-50 text-brand-700", amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700", violet: "bg-violet-50 text-violet-700",
  };
  return <span title={title} className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone])}>{children}</span>;
}

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 55% 46%)` }}>{initials}</span>
  );
}

export function Ring({ pct, size = 84, stroke = 8 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct}% complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
        stroke={pct === 100 ? "#10b981" : "#0a6cf0"} strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s ease" }} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-slate-800 text-[20px] font-bold">{pct}%</text>
    </svg>
  );
}

export const pctOf = (d: number, t: number) => (t ? Math.round((d / t) * 100) : 0);
