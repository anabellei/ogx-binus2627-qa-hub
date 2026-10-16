import { ALIAS_GROUPS, MULTI_FILE_PREFIXES, OPTIONAL_ITEMS, PREP_IGNORE, PREP_MAP, norm } from "./catalog";
import { itemSlug, shortNames } from "./naming";
import {
  EpView, ItemDef, ItemState, STAGE_ORDER, StageKey, Status,
} from "./types";

/* ---------- Grid model (what we read from Sheets / the demo fixture) ---------- */
export type Cell = { v?: string; l?: string; b?: boolean; n?: number; note?: string } | null;
export type Grid = Cell[][];
export type CellOp =
  | { tab: "real" | "prep"; row: number; col: number; kind: "link"; text: string; url: string }
  | { tab: "real" | "prep"; row: number; col: number; kind: "text"; text: string }
  | { tab: "real" | "prep"; row: number; col: number; kind: "bool"; value: boolean };

const cell = (g: Grid, r: number, c: number): Cell => g[r]?.[c] ?? null;
const txt = (g: Grid, r: number, c: number) => (cell(g, r, c)?.v ?? "").replace(/\s+/g, " ").trim();

/* ---------- Parsed structure ---------- */
export interface ParsedItem extends ItemDef { realRow?: number; prepRow?: number }
export interface ParsedEp {
  key: string; name: string; short: string; breakTag?: string; number?: number;
  responsible: string; program: string; hostLC: string; credit: boolean;
  realCol: number; prepCol?: number;
}
export interface Parsed { items: ParsedItem[]; eps: ParsedEp[]; warnings: string[] }

const slugKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pad2 = (n: number) => String(n).padStart(2, "0");

function stageOf(raw: string | null): { stage: StageKey; folder: string } {
  const s = (raw ?? "").toLowerCase();
  if (s.startsWith("prep")) return { stage: "preparation", folder: "01 Preparation" };
  if (s.startsWith("exp")) return { stage: "experience", folder: "02 Experience" };
  if (s.startsWith("post")) return { stage: "post", folder: "03 Post-Experience" };
  return { stage: "general", folder: "00 General" };
}

/* ---------- fuzzy EP name matching (tabs spell names slightly differently) ---------- */
function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
export const tokens = (s: string) =>
  s.toLowerCase().replace(/\[[^\]]*\]/g, "").replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
export function nameScore(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  let hit = 0;
  for (const x of ta) if (tb.some((y) => x === y || (Math.min(x.length, y.length) >= 5 && lev(x, y) <= 1))) hit++;
  if (hit < Math.min(2, ta.length, tb.length)) return 0;
  return hit / Math.max(ta.length, tb.length);
}

/* ---------- Parser ---------- */
export function parseTracker(real: Grid, prep: Grid): Parsed {
  const warnings: string[] = [];

  /* Realization tab */
  let hr = -1;
  for (let r = 0; r < Math.min(real.length, 20); r++) if (/^exchange standard/i.test(txt(real, r, 1))) { hr = r; break; }
  if (hr < 0) throw new Error("Realization tab: couldn't find the 'Exchange Standard' header row.");

  let itemStart = -1;
  for (let r = hr + 1; r < real.length; r++) if (/^(home|host)$/i.test(txt(real, r, 4))) { itemStart = r; break; }
  if (itemStart < 0) throw new Error("Realization tab: couldn't find the first checklist row (Home/Host column).");

  const rawEps: { col: number; name: string; tag?: string }[] = [];
  for (let c = 6; c < (real[hr]?.length ?? 0); c++) {
    const raw = txt(real, hr, c);
    if (!raw) continue;
    const tagM = /^\[([^\]]+)\]\s*/.exec(raw);
    rawEps.push({ col: c, name: raw.replace(/^\[[^\]]+\]\s*/, "").trim(), tag: tagM?.[1] });
  }

  /* Items */
  const items: ParsedItem[] = [];
  const usedKeys = new Set<string>();
  let curStage = stageOf(null);
  let curNum: number | null = null;
  let curStd = "";
  for (let r = itemStart; r < real.length; r++) {
    const label = txt(real, r, 5);
    if (!label) break;
    const b = txt(real, r, 1);
    if (b) curStage = stageOf(b);
    const c = txt(real, r, 2);
    if (c) { const m = /(\d+)/.exec(c); curNum = m ? parseInt(m[1], 10) : null; curStd = txt(real, r, 3); }
    const standard = curNum !== null ? `${pad2(curNum)} ${curStd}` : "Core documents";
    const owner = /^home$/i.test(txt(real, r, 4)) ? "Home" : /^host$/i.test(txt(real, r, 4)) ? "Host" : undefined;
    const n = norm(label);
    let key = slugKey(label) || `row-${r}`;
    while (usedKeys.has(key)) key += "-2";
    usedKeys.add(key);
    items.push({
      key, label, slug: itemSlug(label), stage: curStage.stage, standard,
      folder: [curStage.folder, standard.replace(/[\\/:*?"<>|]/g, "-")],
      owner, multi: MULTI_FILE_PREFIXES.some((p) => n.startsWith(p)),
      optional: /^\(if change\)/i.test(label), creditOnly: false,
      required: !OPTIONAL_ITEMS.includes(n), inRealization: true, mirrorsPrep: false, realRow: r,
    });
  }

  /* Preparation tab */
  let phr = -1;
  for (let r = 0; r < Math.min(prep.length, 30); r++) if (/^ep name$/i.test(txt(prep, r, 1))) { phr = r; break; }
  const prepEps: { col: number; name: string }[] = [];
  const meta: Record<string, number> = {};
  const prepRows = new Map<string, { row: number; label: string; creditOnly: boolean }>();
  if (phr < 0) {
    warnings.push("Preparation tab: couldn't find the 'EP Name' row. Only the Realization tab will be used.");
  } else {
    for (let c = 2; c < (prep[phr]?.length ?? 0); c++) {
      const n = txt(prep, phr, c);
      if (n) prepEps.push({ col: c, name: n });
    }
    let lastMeta = phr;
    for (let r = phr + 1; r < Math.min(prep.length, phr + 14); r++) {
      const l = txt(prep, r, 1).toLowerCase();
      if (["credit conversion", "country", "host lc", "program portfolio", "status", "timeline"].includes(l)) { meta[l] = r; lastMeta = Math.max(lastMeta, r); }
    }
    let creditRegion = false;
    for (let r = lastMeta + 1; r < prep.length; r++) {
      const label = txt(prep, r, 1);
      if (!label) continue;
      if (label.startsWith("*")) { if (/credit/i.test(label)) creditRegion = true; continue; }
      if (PREP_IGNORE.includes(norm(label))) continue;
      const isSlot = prepEps.some(({ col }) => { const c = cell(prep, r, col); return !!c?.l || /^here$/i.test((c?.v ?? "").trim()); });
      if (!isSlot) continue;
      prepRows.set(norm(label), { row: r, label, creditOnly: creditRegion });
    }
  }

  /* Link realization items to prep rows; remaining prep rows become prep-only items */
  const claimed = new Set<string>();
  for (const it of items) {
    const pn = PREP_MAP[norm(it.label)];
    const pr = pn ? prepRows.get(pn) : undefined;
    if (pr) { it.prepRow = pr.row; it.mirrorsPrep = true; claimed.add(pn!); }
  }
  for (const [k, pr] of prepRows) {
    if (claimed.has(k)) continue;
    let key = "prep-" + (slugKey(pr.label) || pr.row);
    while (usedKeys.has(key)) key += "-2";
    usedKeys.add(key);
    items.push({
      key, label: pr.label, slug: itemSlug(pr.label), stage: "general",
      standard: "Preparation documents", folder: ["00 General", "Preparation documents"],
      multi: false, optional: false, creditOnly: pr.creditOnly, required: !OPTIONAL_ITEMS.includes(k), inRealization: false,
      mirrorsPrep: false, prepRow: pr.row,
    });
  }

  /* EPs */
  const shorts = shortNames(rawEps.map((e) => e.name));
  const usedEp = new Set<string>();
  const eps: ParsedEp[] = rawEps.map((e, i) => {
    let key = slugKey(e.name);
    while (usedEp.has(key)) key += "-2";
    usedEp.add(key);
    const num = /^(\d+)\./.exec(txt(real, hr + 2, e.col));
    return {
      key, name: e.name, short: shorts[i], breakTag: e.tag,
      number: num ? parseInt(num[1], 10) : undefined,
      responsible: txt(real, hr + 1, e.col) || "Unassigned",
      program: txt(real, hr + 3, e.col), hostLC: txt(real, hr + 7, e.col),
      credit: true, realCol: e.col,
    };
  });

  /* Match prep columns to realization EPs */
  const usedPrep = new Set<number>();
  for (const ep of eps) {
    let best: { col: number; score: number; name: string } | null = null;
    for (const pe of prepEps) {
      if (usedPrep.has(pe.col)) continue;
      const s = nameScore(ep.name, pe.name);
      if (!best || s > best.score) best = { col: pe.col, score: s, name: pe.name };
    }
    if (best && best.score >= 0.6) {
      ep.prepCol = best.col; usedPrep.add(best.col);
      if (norm(best.name) !== norm(ep.name)) warnings.push(`"${ep.name}" is spelled "${best.name}" on the Preparation tab (matched automatically).`);
      const cr = meta["credit conversion"];
      if (cr !== undefined) { const v = txt(prep, cr, best.col).toLowerCase(); ep.credit = v !== "" && v !== "no"; }
    } else if (phr >= 0) {
      warnings.push(`"${ep.name}" has no column on the Preparation tab — preparation-only documents are hidden for this EP.`);
    }
  }
  for (const pe of prepEps) if (!usedPrep.has(pe.col)) warnings.push(`Preparation tab has "${pe.name}" but the Realization tab doesn't — ignored.`);

  return { items, eps, warnings };
}

/* ---------- State computation ---------- */
export function computeEps(parsed: Parsed, real: Grid, prep: Grid): EpView[] {
  return parsed.eps.map((ep) => {
    const states: Record<string, ItemState> = {};
    for (const it of parsed.items) {
      if (it.creditOnly && !ep.credit) continue;
      let st: ItemState;
      if (it.realRow !== undefined) {
        const link = cell(real, it.realRow, ep.realCol);
        const chk = cell(real, it.realRow, ep.realCol + 1);
        const ticked = chk?.b === true || (chk?.v ?? "").toLowerCase() === "true";
        const url = link?.l;
        const t = (link?.v ?? "").trim().toLowerCase();
        let status: Status; let note: string | undefined;
        if (ticked && t.startsWith("no difference")) status = "nodiff";
        else if (ticked && url) status = "done";
        else if (ticked) { status = "attention"; note = "Ticked in the sheet but no file is linked"; }
        else if (url) { status = "attention"; note = "File is linked but the box isn't ticked"; }
        else status = "missing";
        st = { status, link: url, note };
        if (it.mirrorsPrep && ep.prepCol !== undefined && it.prepRow !== undefined) st.prepSynced = !!cell(prep, it.prepRow, ep.prepCol)?.l;
      } else {
        if (ep.prepCol === undefined || it.prepRow === undefined) continue;
        const url = cell(prep, it.prepRow, ep.prepCol)?.l;
        st = { status: url ? "done" : "missing", link: url };
      }
      states[it.key] = st;
    }
    const stages = Object.fromEntries(STAGE_ORDER.map((s) => [s, { done: 0, total: 0 }])) as EpView["stages"];
    let done = 0, total = 0, attention = 0;
    for (const it of parsed.items) {
      const s = states[it.key]; if (!s || !it.required) continue; // optional documents never count
      total++; stages[it.stage].total++;
      if (s.status === "done" || s.status === "nodiff") { done++; stages[it.stage].done++; }
      if (s.status === "attention") attention++;
    }
    return {
      key: ep.key, name: ep.name, short: ep.short, breakTag: ep.breakTag, number: ep.number,
      responsible: ep.responsible, program: ep.program, hostLC: ep.hostLC, credit: ep.credit,
      hasPrep: ep.prepCol !== undefined, onBreak: /^break/i.test(ep.breakTag ?? ""), states, done, total, attention, stages,
    };
  });
}

/* ---------- Write planning ---------- */
function groupOf(item: ParsedItem, all: ParsedItem[]): ParsedItem[] {
  const n = norm(item.label);
  const g = ALIAS_GROUPS.find((grp) => grp.includes(n));
  if (!g) return [item];
  return all.filter((i) => i.inRealization && g.includes(norm(i.label)));
}

/** A new file (or folder) was uploaded for this item: fill every place that should point to it. */
export function planLink(parsed: Parsed, ep: ParsedEp, item: ParsedItem, url: string, prep: Grid): CellOp[] {
  const ops = new Map<string, CellOp>();
  const put = (o: CellOp) => ops.set(`${o.tab}:${o.row}:${o.col}:${o.kind}`, o);
  for (const it of groupOf(item, parsed.items)) {
    if (it.realRow !== undefined) {
      put({ tab: "real", row: it.realRow, col: ep.realCol, kind: "link", text: "Here", url });
      put({ tab: "real", row: it.realRow, col: ep.realCol + 1, kind: "bool", value: true });
    }
    if (it.prepRow !== undefined && ep.prepCol !== undefined) {
      const existing = (cell(prep, it.prepRow, ep.prepCol)?.v ?? "").trim();
      put({ tab: "prep", row: it.prepRow, col: ep.prepCol, kind: "link", text: existing || "here", url });
    }
  }
  return [...ops.values()];
}

export function planMark(
  parsed: Parsed, ep: ParsedEp, item: ParsedItem, action: "nodiff" | "reset" | "tick", prep: Grid,
  currentLink?: string,
): CellOp[] {
  if (item.realRow === undefined) return [];
  const r = item.realRow;
  if (action === "nodiff") return [
    { tab: "real", row: r, col: ep.realCol, kind: "text", text: "No difference" },
    { tab: "real", row: r, col: ep.realCol + 1, kind: "bool", value: true },
  ];
  if (action === "reset") return [
    { tab: "real", row: r, col: ep.realCol, kind: "text", text: "Here" },
    { tab: "real", row: r, col: ep.realCol + 1, kind: "bool", value: false },
  ];
  void prep; void currentLink;
  return [{ tab: "real", row: r, col: ep.realCol + 1, kind: "bool", value: true }];
}
