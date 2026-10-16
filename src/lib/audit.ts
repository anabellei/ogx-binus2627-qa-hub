import { nameScore, type Cell, type CellOp, type Grid } from "./tracker";
import type { Merge } from "./sheets";
import { AUDIT_SUGGESTIONS, MONTHLY_SUGGESTIONS, suggestFor } from "./audit-map";
import { sanitize as clean } from "./naming";

export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ---------- audit window: calendar quarters (Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec) ---------- */
export interface AuditWindow { start: string; end: string; tags: string[]; label: string }
export function windowFor(year: number, quarter: number): AuditWindow {
  const q = Math.min(4, Math.max(1, Math.round(quarter) || 1)), m0 = (q - 1) * 3;
  const s = new Date(Date.UTC(year, m0, 1)), e = new Date(Date.UTC(year, m0 + 3, 0));
  return {
    start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10), tags: [0, 1, 2].map((i) => MONTHS[m0 + i]),
    label: `Q${q} ${year} (${MONTH_NAMES[m0]} – ${MONTH_NAMES[m0 + 2]})`,
  };
}

/* ---------- helpers ---------- */
const txtRaw = (g: Grid, r: number, c: number) => (g[r]?.[c]?.v ?? "").replace(/\s+/g, " ").trim();
const slugKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function cellDate(c: Cell): Date | null {
  if (!c) return null;
  if (typeof c.n === "number" && c.n > 20000 && c.n < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(c.n) * 86400000);
  const v = (c.v ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(v);
  if (m) return new Date(Date.UTC(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]));
  return null;
}
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);

function anchorFn(merges: Merge[]) {
  const map = new Map<string, [number, number]>();
  for (const m of merges) {
    if ((m.r2 - m.r1) * (m.c2 - m.c1) > 800) continue;
    for (let r = m.r1; r < m.r2; r++) for (let c = m.c1; c < m.c2; c++) if (r !== m.r1 || c !== m.c1) map.set(`${r},${c}`, [m.r1, m.c1]);
  }
  return (r: number, c: number): [number, number] => map.get(`${r},${c}`) ?? [r, c];
}

export const findEmails = (g: Grid): string[] => {
  const out = new Set<string>();
  for (const row of g) for (const c of row) for (const m of (c?.v ?? "").match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []) out.add(m.toLowerCase());
  return [...out];
};

/* ===================== Quarterly audit (criteria rows x EP columns) ===================== */
export type DateType = "approved" | "realized" | "finished";
export interface QSlotDef { id: string; rows: number[]; criteria: string[]; requirement: string; format: string }
export interface QBlockDef { code: string; dateType: DateType; slots: QSlotDef[] }
export interface QEp { key: string; name: string; col: number; host?: string; dates: Record<DateType, Date | null> }
export interface QParsed { blocks: QBlockDef[]; eps: QEp[] }

export function parseQuarterly(grid: Grid, merges: Merge[]): QParsed {
  const anchor = anchorFn(merges);
  const get = (r: number, c: number) => { const [ar, ac] = anchor(r, c); return txtRaw(grid, ar, ac); };
  let hr = -1;
  for (let r = 0; r < Math.min(grid.length, 40); r++) if (/^ep name$/i.test(txtRaw(grid, r, 1))) { hr = r; break; }
  if (hr < 0) throw new Error("Quarterly audit tab: couldn't find the 'EP Name' row. Is this the right tab?");
  const rowOf = (re: RegExp) => { for (let r = hr; r < Math.min(grid.length, hr + 20); r++) if (re.test(txtRaw(grid, r, 1))) return r; return -1; };
  const rA = rowOf(/^approved date/i), rR = rowOf(/^realized date/i), rF = rowOf(/^finished date/i), rH = rowOf(/^host entity/i);
  const used = new Set<string>();
  const eps: QEp[] = [];
  for (let c = 2; c < (grid[hr]?.length ?? 0); c++) {
    const name = txtRaw(grid, hr, c);
    if (!name) continue;
    let key = slugKey(name); while (used.has(key)) key += "-2"; used.add(key);
    eps.push({
      key, name, col: c, host: rH >= 0 ? txtRaw(grid, rH, c) : undefined,
      dates: { approved: rA >= 0 ? cellDate(grid[rA]?.[c] ?? null) : null, realized: rR >= 0 ? cellDate(grid[rR]?.[c] ?? null) : null, finished: rF >= 0 ? cellDate(grid[rF]?.[c] ?? null) : null },
    });
  }
  let start = -1;
  for (let r = hr + 1; r < Math.min(grid.length, hr + 30); r++) if (/^criteria$/i.test(txtRaw(grid, r, 1))) { start = r; break; }
  if (start < 0) throw new Error("Quarterly audit tab: couldn't find the 'Criteria' header row.");

  const blocks: QBlockDef[] = [];
  let cur: QBlockDef | null = null, skipping = false;
  for (let r = start + 1; r < grid.length; r++) {
    const code = txtRaw(grid, r, 2); // raw cell: criteria rows are merged B:F, block headers are not
    if (code && !/^overal/i.test(get(r, 1))) {
      skipping = /example/i.test(code);
      cur = skipping ? null : { code, dateType: /realiz/i.test(code) ? "realized" : /finish/i.test(code) ? "finished" : "approved", slots: [] };
      if (cur) blocks.push(cur);
      continue;
    }
    if (/^overal/i.test(get(r, 1))) { cur = null; continue; }
    if (!cur) continue;
    const crit = get(r, 1), req = get(r, 6), fmt = get(r, 8);
    if (!req || /auto check/i.test(req)) continue;
    const [ar] = anchor(r, 6);
    const existing = cur.slots.find((s) => s.id === `q${blocks.length - 1}-${ar}`);
    if (existing) { existing.rows.push(r); if (crit && !existing.criteria.includes(crit)) existing.criteria.push(crit); }
    else cur.slots.push({ id: `q${blocks.length - 1}-${ar}`, rows: [r], criteria: crit ? [crit] : [], requirement: req, format: fmt });
  }
  return { blocks, eps };
}

export type SlotStatus = "filled" | "partial" | "deferred" | "missing";
export interface SlotView {
  id: string; label: string; criteria: string[]; requirement: string; format: string; mode: "copy" | "link";
  status: SlotStatus; link?: string; text?: string; auditor?: string; folderName: string; suggest: string[]; sharedLink?: string;
}
export interface BlockView { code: string; dateType: DateType; date?: string; phase: "due" | "later" | "earlier"; tag?: string; slots: SlotView[]; filled: number; total: number }
export interface QEpView {
  key: string; name: string; host?: string; inAudit: boolean;
  dates: Record<DateType, string | undefined>; blocks: BlockView[]; filled: number; total: number;
}

const inWin = (d: Date | null, w: AuditWindow) => !!d && iso(d)! >= w.start && iso(d)! <= w.end;
export function phaseOf(d: Date | null, w: AuditWindow): "due" | "later" | "earlier" {
  if (!d) return "later";
  const s = iso(d)!;
  return s < w.start ? "earlier" : s > w.end ? "later" : "due";
}

export function buildQuarterlyEp(p: QParsed, grid: Grid, ep: QEp, w: AuditWindow): QEpView {
  const inAudit = (["approved", "realized", "finished"] as DateType[]).some((t) => inWin(ep.dates[t], w));
  let filled = 0, total = 0;
  const blocks: BlockView[] = p.blocks.map((b) => {
    const d = ep.dates[b.dateType], phase = phaseOf(d, w);
    const tag = phase === "due" ? MONTHS[d!.getUTCMonth()] : undefined;
    const slots: SlotView[] = b.slots.map((s) => {
      const cells = s.rows.map((r) => grid[r]?.[ep.col] ?? null);
      const linked = cells.filter((c) => c?.l).length;
      const first = cells[0];
      const text = (first?.v ?? "").trim();
      const status: SlotStatus = linked === cells.length ? "filled" : linked > 0 ? "partial" : /next quarter/i.test(text) ? "deferred" : "missing";
      const title = s.requirement.replace(/\s+/g, " ");
      return {
        id: s.id, label: title, criteria: s.criteria, requirement: s.requirement, format: s.format, mode: "copy" as const,
        status, link: first?.l, text, auditor: txtRaw(grid, s.rows[0], ep.col + 1) || undefined,
        folderName: clean(`${b.code} - ${title}`.slice(0, 70)), suggest: suggestFor(AUDIT_SUGGESTIONS, `${s.requirement} ${s.criteria.join(" ")}`),
      };
    });
    const f = slots.filter((s) => s.status === "filled").length;
    if (phase === "due" && inAudit) { filled += f; total += slots.length; }
    return { code: b.code, dateType: b.dateType, date: iso(d), phase, tag, slots, filled: f, total: slots.length };
  });
  return { key: ep.key, name: ep.name, host: ep.host, inAudit, dates: { approved: iso(ep.dates.approved), realized: iso(ep.dates.realized), finished: iso(ep.dates.finished) }, blocks, filled, total };
}

export const planQFill = (p: QParsed, ep: QEp, slotId: string, tag: string, url: string): CellOp[] => {
  const s = p.blocks.flatMap((b) => b.slots).find((x) => x.id === slotId);
  return (s?.rows ?? []).map((row) => ({ tab: "real" as const, row, col: ep.col, kind: "link" as const, text: `[${tag}] here`, url }));
};

/** Write "Next Quarter" into empty doc cells of blocks the EP hasn't reached yet. */
export function planQDefer(p: QParsed, grid: Grid, ep: QEp, w: AuditWindow): CellOp[] {
  const ops: CellOp[] = [];
  for (const b of p.blocks) {
    if (phaseOf(ep.dates[b.dateType], w) !== "later") continue;
    for (const s of b.slots) for (const row of s.rows) {
      const c = grid[row]?.[ep.col];
      if (!c?.v && !c?.l) ops.push({ tab: "real", row, col: ep.col, kind: "text", text: "Next Quarter" });
    }
  }
  return ops;
}

/* ===================== Monthly / APD report (EP rows x document columns) ===================== */
export interface MCol { col: number; header: string; kind: "doc" | "date"; note?: string; mode: "copy" | "link" }
export interface MRow { row: number; key: string; name: string; product: string; month?: string }
export interface MParsed { cols: MCol[]; rows: MRow[] }

const META = /^(status|apd month|product|ep name|ep id|op name|op id|host entity|sending entity|open date|apd date|re date|fi date)$/i;

export function parseMonthly(grid: Grid): MParsed {
  let hr = -1, nameCol = -1;
  for (let r = 0; r < Math.min(grid.length, 25) && hr < 0; r++)
    for (let c = 0; c < (grid[r]?.length ?? 0); c++) if (/^ep name$/i.test(txtRaw(grid, r, c))) { hr = r; nameCol = c; break; }
  if (hr < 0) throw new Error("Monthly report tab: couldn't find the 'EP Name' header row. Is this the right tab?");
  const colOf = (re: RegExp) => { for (let c = 0; c < (grid[hr]?.length ?? 0); c++) if (re.test(txtRaw(grid, hr, c))) return c; return -1; };
  const cProduct = colOf(/^product$/i), cMonth = colOf(/^apd month$/i);
  const cols: MCol[] = [];
  for (let c = 0; c < (grid[hr]?.length ?? 0); c++) {
    const h = txtRaw(grid, hr, c);
    if (!h || META.test(h)) continue;
    const kind = /date$/i.test(h) ? "date" : "doc";
    cols.push({ col: c, header: h, kind, note: grid[hr]?.[c]?.note?.trim(), mode: /tracker|risk|resumption/i.test(h) ? "link" : "copy" });
  }
  const rows: MRow[] = [];
  const used = new Set<string>();
  for (let r = hr + 1; r < grid.length; r++) {
    const name = txtRaw(grid, r, nameCol);
    if (!name) continue;
    let key = slugKey(name); while (used.has(key)) key += "-2"; used.add(key);
    rows.push({ row: r, key, name, product: cProduct >= 0 ? txtRaw(grid, r, cProduct) : "", month: cMonth >= 0 ? txtRaw(grid, r, cMonth) : undefined });
  }
  return { cols, rows };
}

export interface MSlotView { id: string; label: string; requirement?: string; mode: "copy" | "link"; status: SlotStatus; link?: string; text?: string; suggest: string[]; sharedLink?: string; folderName: string }
export interface MEpView {
  key: string; name: string; month?: string; slots: MSlotView[]; dates: { label: string; filled: boolean }[];
  filled: number; total: number; datesFilled: number; datesTotal: number;
}
const HANDLED = /^(break|n\/a|na$)/i;

export function buildMonthlyEp(p: MParsed, grid: Grid, row: MRow): MEpView {
  const docCols = p.cols.filter((c) => c.kind === "doc");
  const slots: MSlotView[] = docCols.map((c) => {
    const cell = grid[row.row]?.[c.col] ?? null;
    const text = (cell?.v ?? "").trim();
    // Most common link in this column across all EPs = a shared document (risk tool, national tracker, resumption folder...).
    const counts = new Map<string, number>();
    for (const r of p.rows) { const l = grid[r.row]?.[c.col]?.l; if (l) counts.set(l, (counts.get(l) ?? 0) + 1); }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const status: SlotStatus = cell?.l ? "filled" : HANDLED.test(text) ? "deferred" : "missing";
    return {
      id: `m${row.row}:${c.col}`, label: c.header, requirement: c.note, mode: c.mode, status, link: cell?.l, text,
      suggest: suggestFor(MONTHLY_SUGGESTIONS, c.header), sharedLink: top && top[1] >= 2 ? top[0] : undefined, folderName: clean(c.header),
    };
  });
  const dates = p.cols.filter((c) => c.kind === "date").map((c) => ({ label: c.header, filled: !!cellDate(grid[row.row]?.[c.col] ?? null) }));
  return {
    key: row.key, name: row.name, month: row.month, slots, dates,
    filled: slots.filter((s) => s.status === "filled" || s.status === "deferred").length, total: slots.length,
    datesFilled: dates.filter((d) => d.filled).length, datesTotal: dates.length,
  };
}

export const planMFill = (p: MParsed, slotId: string, url: string): CellOp[] => {
  const m = /^m(\d+):(\d+)$/.exec(slotId);
  return m && p.cols.some((c) => c.col === +m[2]) ? [{ tab: "real", row: +m[1], col: +m[2], kind: "link", text: "here", url }] : [];
};

export const matchName = <T extends { name: string }>(name: string, list: T[]): T | null => {
  let best: T | null = null, bs = 0;
  for (const x of list) { const s = nameScore(name, x.name); if (s > bs) { bs = s; best = x; } }
  return bs >= 0.6 ? best : null;
};
