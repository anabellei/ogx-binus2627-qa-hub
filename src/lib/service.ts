import { DEMO, HttpError, ROOT_FOLDER_ID } from "./config";
import { APP_SUBFOLDER } from "./catalog";
import { getConfig, productFolderId, productSheetId, type ProductCfg } from "./appconfig";
import { demoApply, demoStore } from "./demo";
import {
  Grid, Parsed, ParsedEp, ParsedItem, parseTracker, computeEps, planLink, planMark, nameScore,
} from "./tracker";
import { readSheets, writeOps, type SheetIds } from "./sheets";
import * as drive from "./drive";
import { itemFolderName, fileExt, sanitize } from "./naming";
import type { EpView, Snapshot } from "./types";

/* ---------- product context ---------- */
export interface ProductCtx { cfg: ProductCfg; sheetId: string }

export async function productCtx(token: string, key?: string | null): Promise<ProductCtx> {
  const cfg = await getConfig(token);
  const p = cfg.products.find((x) => x.key === key) ?? cfg.products[0];
  if (!p) throw new HttpError(404, "No products set up yet. Open Settings and add one (name, tracker sheet link, Drive folder link).");
  const sheetId = DEMO ? "demo" : productSheetId(p);
  if (!sheetId) throw new HttpError(400, `Product "${p.label}" has no valid tracker sheet link. Fix it in Settings.`);
  return { cfg: p, sheetId };
}

const DEMO_IDS: SheetIds = { real: 1, prep: 2 };
export interface Loaded { parsed: Parsed; real: Grid; prep: Grid; ids: SheetIds }

export async function load(token: string, pc: ProductCtx): Promise<Loaded> {
  const { real, prep, ids } = DEMO
    ? { ...demoStore(pc.cfg.key), ids: DEMO_IDS }
    : await readSheets(token, pc.sheetId, pc.cfg.realPrefix, pc.cfg.prepPrefix);
  return { parsed: parseTracker(real, prep), real, prep, ids };
}

export async function snapshot(token: string, pc: ProductCtx): Promise<Snapshot & { products: { key: string; label: string }[] }> {
  const [l, cfg] = await Promise.all([load(token, pc), getConfig(token)]);
  return {
    eps: computeEps(l.parsed, l.real, l.prep),
    items: l.parsed.items.map(stripInternal),
    warnings: l.parsed.warnings, sheetUrl: DEMO ? "#" : `https://docs.google.com/spreadsheets/d/${pc.sheetId}/edit`, demo: DEMO,
    products: cfg.products.map((p) => ({ key: p.key, label: p.label })),
  };
}

const stripInternal = ({ realRow: _r, prepRow: _p, ...rest }: ParsedItem) => rest;

export function pick(l: Loaded, epKey: string, itemKey: string): { ep: ParsedEp; item: ParsedItem } {
  const ep = l.parsed.eps.find((e) => e.key === epKey);
  const item = l.parsed.items.find((i) => i.key === itemKey);
  if (!ep || !item) throw new HttpError(404, "That EP or checklist item no longer exists in the sheet. Refresh the page.");
  return { ep, item };
}

export function epView(l: Loaded, epKey: string): EpView {
  const v = computeEps(l.parsed, l.real, l.prep).find((e) => e.key === epKey);
  if (!v) throw new HttpError(404, "EP not found.");
  return v;
}

/* ---------- Drive: adopt the existing "01. Name" EP folders ---------- */
const memo = new Map<string, { id: string; at: number }>();
const fresh = <T,>(k: string): string | null => { const h = memo.get(k); return h && Date.now() - h.at < 10 * 60_000 ? h.id : null; };

export async function productFolder(token: string, pc: ProductCtx): Promise<string> {
  const explicit = productFolderId(pc.cfg);
  if (explicit) return explicit;
  const k = `pf:${pc.cfg.key}`;
  const hit = fresh(k); if (hit) return hit;
  const sub = (await drive.listFolders(token, ROOT_FOLDER_ID)).find((f) => f.name.trim().toLowerCase() === pc.cfg.label.toLowerCase());
  const id = sub?.id ?? ROOT_FOLDER_ID;
  memo.set(k, { id, at: Date.now() });
  return id;
}

const stripName = (n: string) => n.replace(/^\s*\d+\s*[.\-)]*\s*/, "").replace(/\([^)]*\)/g, "").trim();

/** Finds the EP's existing folder by (fuzzy) name; creates "NN. Name (TAG)" if there is none. */
export async function epFolder(token: string, pc: ProductCtx, ep: ParsedEp): Promise<string> {
  const k = `ef:${pc.cfg.key}:${ep.key}`;
  const hit = fresh(k); if (hit) return hit;
  const parent = await productFolder(token, pc);
  const subs = await drive.listFolders(token, parent);
  let best: { id: string; s: number } | null = null;
  for (const f of subs) { const s = nameScore(ep.name, stripName(f.name)); if (s >= 0.6 && (!best || s > best.s)) best = { id: f.id, s }; }
  const id = best?.id ?? (await drive.ensureFolder(token, parent, sanitize(`${String(ep.number ?? subs.length + 1).padStart(2, "0")}. ${ep.name}${ep.breakTag ? ` (${ep.breakTag})` : ""}`)));
  memo.set(k, { id, at: Date.now() });
  return id;
}

/** Path inside the EP folder for an item's files. */
export function folderParts(item: ParsedItem): string[] {
  return [...(APP_SUBFOLDER ? [APP_SUBFOLDER] : []), ...item.folder, ...(item.multi ? [itemFolderName(item.label)] : [])];
}
export const baseName = (ep: ParsedEp, item: ParsedItem) => `${ep.short}_${item.slug}`;

export async function startUpload(
  token: string, pc: ProductCtx, user: string, epKey: string, itemKey: string, file: { name: string; type: string; size: number },
) {
  const l = await load(token, pc);
  const { ep, item } = pick(l, epKey, itemKey);
  const ext = fileExt(file.name, file.type);
  const base = baseName(ep, item);
  if (DEMO) return { session: `demo:${Math.random().toString(36).slice(2)}`, name: `${base}${item.multi ? "_01" : ""}${ext}` };
  const folder = await drive.ensurePath(token, await epFolder(token, pc, ep), folderParts(item));
  let name = `${base}${ext}`;
  if (item.multi) {
    const existing = await drive.listFiles(token, folder);
    const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_(\\d+)`);
    const max = existing.reduce((m, f) => Math.max(m, Number(re.exec(f.name)?.[1] ?? 0)), 0);
    name = `${base}_${String(max + 1).padStart(2, "0")}${ext}`;
  }
  const session = await drive.startResumable(token, {
    name, parent: folder, mime: file.type, size: file.size,
    description: `Uploaded by ${user} via GV QA Hub on ${new Date().toISOString().slice(0, 10)}`,
  });
  return { session, name };
}

export async function finishUpload(token: string, pc: ProductCtx, epKey: string, itemKey: string, fileIds: string[]) {
  const l = await load(token, pc);
  const { ep, item } = pick(l, epKey, itemKey);
  if (!fileIds.length) throw new HttpError(400, "No files were uploaded.");
  let url: string;
  if (DEMO) {
    url = item.multi ? "https://drive.google.com/drive/folders/DEMOfolder" : `https://drive.google.com/file/d/${fileIds[0]}/view`;
  } else {
    const folder = await drive.ensurePath(token, await epFolder(token, pc, ep), folderParts(item));
    const files = await Promise.all(fileIds.map((id) => drive.getFile(token, id)));
    if (files.some((f) => !f.parents?.includes(folder))) throw new HttpError(400, "Uploaded file is not in the expected folder.");
    if (item.multi) {
      url = drive.folderUrl(folder);
    } else {
      const base = baseName(ep, item);
      const old = (await drive.listFiles(token, folder)).filter((f) => f.id !== fileIds[0] && (f.name === base || f.name.startsWith(base + ".")));
      if (old.length) {
        const archive = await drive.ensureFolder(token, folder, "_Archive");
        for (const f of old) await drive.moveFile(token, f.id, folder, archive);
      }
      url = files[0].webViewLink ?? `https://drive.google.com/file/d/${files[0].id}/view`;
    }
  }
  const ops = planLink(l.parsed, ep, item, url, l.prep);
  if (DEMO) demoApply(ops, pc.cfg.key); else await writeOps(token, pc.sheetId, l.ids, ops);
  return epView(await load(token, pc), ep.key);
}

export async function mark(token: string, pc: ProductCtx, epKey: string, itemKey: string, action: "nodiff" | "reset" | "tick" | "sync") {
  const l = await load(token, pc);
  const { ep, item } = pick(l, epKey, itemKey);
  let ops;
  if (action === "sync") {
    const url = epView(l, ep.key).states[item.key]?.link;
    if (!url) throw new HttpError(400, "Nothing to sync: this item has no file linked.");
    ops = planLink(l.parsed, ep, item, url, l.prep);
  } else {
    if (!item.inRealization) throw new HttpError(400, "This item has no checkbox.");
    ops = planMark(l.parsed, ep, item, action, l.prep);
  }
  if (DEMO) demoApply(ops, pc.cfg.key); else await writeOps(token, pc.sheetId, l.ids, ops);
  return epView(await load(token, pc), ep.key);
}

export function errorJson(e: unknown) {
  const status = e instanceof HttpError ? e.status : 500;
  const message = e instanceof Error ? e.message : "Something went wrong.";
  return Response.json({ error: message }, { status });
}
