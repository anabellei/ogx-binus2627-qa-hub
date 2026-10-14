import { HttpError } from "./config";
import { gjson } from "./google";
import type { Cell, CellOp, Grid } from "./tracker";

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";
export interface Merge { r1: number; r2: number; c1: number; c2: number }
export interface Tab { title: string; sheetId: number; grid: Grid; merges: Merge[] }
export interface SheetIds { real: number; prep: number }

interface ApiCell {
  formattedValue?: string; hyperlink?: string; note?: string;
  effectiveValue?: { boolValue?: boolean; numberValue?: number };
  textFormatRuns?: { format?: { link?: { uri?: string } } }[];
}
interface ApiSheet {
  properties: { sheetId: number; title: string };
  merges?: { startRowIndex?: number; endRowIndex: number; startColumnIndex?: number; endColumnIndex: number }[];
  data?: { rowData?: { values?: ApiCell[] }[] }[];
}

export const sheetIdFromUrl = (u: string): string => {
  const m = /\/spreadsheets\/d\/([\w-]+)/.exec(u);
  if (m) return m[1];
  return /^[\w-]{20,}$/.test(u.trim()) ? u.trim() : "";
};

const qr = (t: string, range: string) => `ranges=${encodeURIComponent(`'${t.replace(/'/g, "''")}'!${range}`)}`;
const norm = (s: string) => s.trim().toLowerCase();

export async function sheetTitles(token: string, sheetId: string): Promise<{ title: string; tabs: string[] }> {
  const m = await gjson<{ properties: { title: string }; sheets: ApiSheet[] }>(token, `${BASE}/${sheetId}?fields=properties.title,sheets.properties(sheetId,title)`);
  return { title: m.properties.title, tabs: m.sheets.map((s) => s.properties.title) };
}

/** Read several tabs (found by name prefix, else "contains") in one request. Missing tabs come back null. */
export async function readTabs(token: string, sheetId: string, specs: { prefix: string; range: string }[]): Promise<(Tab | null)[]> {
  const meta = await gjson<{ sheets: ApiSheet[] }>(token, `${BASE}/${sheetId}?fields=sheets.properties(sheetId,title)`);
  const found = specs.map((sp) => {
    const p = norm(sp.prefix);
    return meta.sheets.find((s) => norm(s.properties.title).startsWith(p)) ?? meta.sheets.find((s) => norm(s.properties.title).includes(p)) ?? null;
  });
  const wanted = specs.map((sp, i) => (found[i] ? qr(found[i]!.properties.title, sp.range) : "")).filter(Boolean);
  if (!wanted.length) return specs.map(() => null);
  const fields = encodeURIComponent(
    "sheets(properties(sheetId),merges,data(rowData(values(formattedValue,hyperlink,note,effectiveValue(boolValue,numberValue),textFormatRuns(format(link(uri)))))))",
  );
  const data = await gjson<{ sheets: ApiSheet[] }>(token, `${BASE}/${sheetId}?includeGridData=true&${wanted.join("&")}&fields=${fields}`);
  return found.map((f) => {
    if (!f) return null;
    const s = data.sheets.find((x) => x.properties.sheetId === f.properties.sheetId);
    const grid: Grid = (s?.data?.[0]?.rowData ?? []).map((row) =>
      (row.values ?? []).map((c): Cell => {
        const l = c.hyperlink ?? c.textFormatRuns?.find((t) => t.format?.link?.uri)?.format?.link?.uri;
        const b = c.effectiveValue?.boolValue, n = c.effectiveValue?.numberValue;
        if (c.formattedValue === undefined && !l && b === undefined && !c.note) return null;
        return { v: c.formattedValue, l, b, n, note: c.note };
      }),
    );
    const merges = (s?.merges ?? []).map((m) => ({ r1: m.startRowIndex ?? 0, r2: m.endRowIndex, c1: m.startColumnIndex ?? 0, c2: m.endColumnIndex }));
    return { title: f.properties.title, sheetId: f.properties.sheetId, grid, merges };
  });
}

export async function readSheets(token: string, sheetId: string, realPrefix: string, prepPrefix: string) {
  const [r, p] = await readTabs(token, sheetId, [
    { prefix: realPrefix, range: "A1:AZ120" }, { prefix: prepPrefix, range: "A1:AZ80" },
  ]);
  if (!r) throw new HttpError(500, `No tab starting with "${realPrefix}" (realization) in this tracker. Check the product's tab prefix in Settings.`);
  return { real: r.grid, prep: p?.grid ?? [], ids: { real: r.sheetId, prep: p?.sheetId ?? -1 } as SheetIds };
}

export async function writeOps(token: string, spreadsheetId: string, ids: SheetIds, ops: CellOp[]) {
  if (!ops.length) return;
  const requests = ops.map((o) => {
    const sheetId = o.tab === "real" ? ids.real : ids.prep;
    const range = { sheetId, startRowIndex: o.row, endRowIndex: o.row + 1, startColumnIndex: o.col, endColumnIndex: o.col + 1 };
    if (o.kind === "bool") return { updateCells: { range, fields: "userEnteredValue", rows: [{ values: [{ userEnteredValue: { boolValue: o.value } }] }] } };
    if (o.kind === "text") return { updateCells: { range, fields: "userEnteredValue,textFormatRuns", rows: [{ values: [{ userEnteredValue: { stringValue: o.text } }] }] } };
    return {
      updateCells: {
        range, fields: "userEnteredValue,textFormatRuns",
        rows: [{ values: [{ userEnteredValue: { stringValue: o.text }, textFormatRuns: [{ startIndex: 0, format: { link: { uri: o.url } } }] }] }],
      },
    };
  });
  await gjson(token, `${BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requests }),
  });
}
