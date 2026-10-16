import { DEMO, HttpError, ROOT_FOLDER_ID, SHEET_ID } from "./config";
import { driveIdFromUrl, readJsonFile, writeJsonFile } from "./drive";
import { sheetIdFromUrl } from "./sheets";

export interface ProductCfg {
  key: string; label: string; sheetUrl: string; folderUrl: string;
  realPrefix: string; prepPrefix: string;
  auditTab: string; // tab name (prefix) of this product inside the quarterly audit sheet, e.g. "OGV"
}
export interface AuditCfg {
  id: string; label: string; quarterlyUrl: string; monthlyUrl: string;
  folderUrl: string; // optional Drive folder to build "Audit/<name>/…" in (default: the main folder)
  year: number; quarter: 1 | 2 | 3 | 4; // calendar quarter being audited (Q3 = Jul–Sep)
  ecbEmails: string[]; submitted?: boolean;
}
export interface AppConfig { products: ProductCfg[]; audits: AuditCfg[] }

const FILE = "_qa-hub-settings.json";
const g = globalThis as unknown as { __gvCfg?: AppConfig; __gvCfgCache?: { at: number; cfg: AppConfig; id: string | null } };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const now = () => { const d = new Date(); return { year: d.getUTCFullYear(), quarter: (Math.floor(d.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4 }; };
/** Reads year/quarter; older saved settings only had a "month", so fall back to the quarter that month is in. */
function quarterOf(a: Partial<AuditCfg> & { month?: string }): { year: number; quarter: 1 | 2 | 3 | 4 } {
  const legacy = /^(\d{4})-(\d{2})$/.exec(a.month ?? "");
  const year = Number(a.year) >= 2020 && Number(a.year) <= 2100 ? Number(a.year) : legacy ? Number(legacy[1]) : now().year;
  const q = Number(a.quarter);
  const quarter = (q >= 1 && q <= 4 ? q : legacy ? Math.ceil(Number(legacy[2]) / 3) : now().quarter) as 1 | 2 | 3 | 4;
  return { year, quarter };
}

export function defaultConfig(): AppConfig {
  if (DEMO) {
    return {
      products: [
        { key: "gv", label: "GV", sheetUrl: "demo", folderUrl: "", realPrefix: "3.0", prepPrefix: "2.1", auditTab: "OGV" },
        { key: "gta", label: "GTa", sheetUrl: "demo", folderUrl: "", realPrefix: "3.0", prepPrefix: "2.1", auditTab: "OGTa" },
      ],
      audits: [{ id: "demo-q3", label: "Q3 2026 audit", quarterlyUrl: "demo", monthlyUrl: "demo", folderUrl: "", year: 2026, quarter: 3, ecbEmails: ["ecb.idn@aiesec.net", "ecbidn.ac@aiesec.net"] }],
    };
  }
  return {
    products: SHEET_ID ? [{ key: "gv", label: "GV", sheetUrl: SHEET_ID, folderUrl: "", realPrefix: "3.0", prepPrefix: "2.1", auditTab: "OGV" }] : [],
    audits: [],
  };
}

export async function getConfig(token: string, fresh = false): Promise<AppConfig> {
  if (DEMO) return (g.__gvCfg ??= defaultConfig());
  const c = g.__gvCfgCache;
  if (!fresh && c && Date.now() - c.at < 20_000) return c.cfg;
  if (!ROOT_FOLDER_ID) throw new HttpError(500, "DRIVE_ROOT_FOLDER_ID must be set.");
  const f = await readJsonFile<AppConfig>(token, ROOT_FOLDER_ID, FILE).catch((e) => {
    if (e instanceof HttpError && (e.status === 404 || e.status === 403 || e.status === 400)) {
      const id = ROOT_FOLDER_ID;
      throw new HttpError(400, `Can't open the main Drive folder (DRIVE_ROOT_FOLDER_ID is ${id.length} characters: "${id.slice(0, 5)}…${id.slice(-4)}"; a real folder ID is about 33). Check the value in Vercel (no spaces, quotes or extra text) and that the account you signed in with has access to that folder. Google said: ${e.message}`);
    }
    throw e;
  });
  const cfg = f?.data ? { ...f.data, audits: f.data.audits.map((a) => ({ ...a, ...quarterOf(a) })) } : defaultConfig();
  g.__gvCfgCache = { at: Date.now(), cfg, id: f?.id ?? null };
  return cfg;
}

export function sanitize(input: AppConfig, prev: AppConfig): AppConfig {
  const used = new Set<string>();
  const products = (input.products ?? []).filter((p) => p.label?.trim()).map((p) => {
    let key = slug(p.label) || "product"; while (used.has(key)) key += "-2"; used.add(key);
    return {
      key, label: p.label.trim(), sheetUrl: (p.sheetUrl ?? "").trim(), folderUrl: (p.folderUrl ?? "").trim(),
      realPrefix: (p.realPrefix ?? "").trim() || "3.0", prepPrefix: (p.prepPrefix ?? "").trim() || "2.1",
      auditTab: (p.auditTab ?? "").trim() || p.label.trim(),
    };
  });
  const audits = (input.audits ?? []).filter((a) => a.label?.trim()).map((a) => ({
    id: a.id || `a-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    label: a.label.trim(), quarterlyUrl: (a.quarterlyUrl ?? "").trim(), monthlyUrl: (a.monthlyUrl ?? "").trim(), folderUrl: (a.folderUrl ?? "").trim(),
    ...quarterOf(a),
    ecbEmails: (a.ecbEmails ?? []).map((e) => e.trim()).filter((e) => /^\S+@\S+\.\S+$/.test(e)),
    submitted: prev.audits.find((x) => x.id === a.id)?.submitted, // only changed via the Submit action
  }));
  return { products, audits };
}

export async function saveConfig(token: string, input: AppConfig): Promise<AppConfig> {
  const prev = await getConfig(token, true);
  const cfg = sanitize(input, prev);
  if (DEMO) { g.__gvCfg = cfg; return cfg; }
  await writeJsonFile(token, ROOT_FOLDER_ID, FILE, g.__gvCfgCache?.id ?? null, cfg);
  g.__gvCfgCache = undefined;
  return getConfig(token, true);
}

export async function patchAudit(token: string, id: string, patch: Partial<AuditCfg>) {
  const cfg = await getConfig(token, true);
  const next = { ...cfg, audits: cfg.audits.map((a) => (a.id === id ? { ...a, ...patch } : a)) };
  if (DEMO) { g.__gvCfg = next; return; }
  await writeJsonFile(token, ROOT_FOLDER_ID, FILE, g.__gvCfgCache?.id ?? null, next);
  g.__gvCfgCache = undefined;
}

export const productSheetId = (p: ProductCfg) => sheetIdFromUrl(p.sheetUrl);
export const productFolderId = (p: ProductCfg) => (p.folderUrl ? driveIdFromUrl(p.folderUrl) : "");
