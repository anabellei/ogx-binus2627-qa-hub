import { DEMO, HttpError, ROOT_FOLDER_ID } from "./config";
import { getConfig, patchAudit, type AuditCfg } from "./appconfig";
import { demoAudit, applyToGrid } from "./demo";
import { norm } from "./catalog";
import {
  MONTHS, buildMonthlyEp, buildQuarterlyEp, findEmails, matchName, parseMonthly, parseQuarterly, phaseOf,
  planMFill, planQDefer, planQFill, windowFor,
  type AuditWindow, type MEpView, type MParsed, type QEpView, type QParsed,
} from "./audit";
import { readTabs, sheetIdFromUrl, writeOps, type Tab } from "./sheets";
import * as drive from "./drive";
import { shortNames, sanitize } from "./naming";
import { computeEps, type CellOp } from "./tracker";
import { load, productCtx, epFolder, type ProductCtx } from "./service";

export interface AuditEnv {
  audit: AuditCfg; pc: ProductCtx; w: AuditWindow; ecb: string[];
  q: { tab: Tab | null; parsed: QParsed | null; sheetId: string; error?: string };
  m: { tab: Tab | null; parsed: MParsed | null; sheetId: string; error?: string };
}

const inProduct = (rowProduct: string, label: string) => !rowProduct || norm(rowProduct).includes(norm(label));

export async function loadAudit(token: string, auditId: string, productKey?: string | null): Promise<AuditEnv> {
  const cfg = await getConfig(token);
  const audit = cfg.audits.find((a) => a.id === auditId);
  if (!audit) throw new HttpError(404, "That audit setup doesn't exist. Open Audit → Settings.");
  const pc = await productCtx(token, productKey);
  const env: AuditEnv = { audit, pc, w: windowFor(audit.month), ecb: audit.ecbEmails, q: { tab: null, parsed: null, sheetId: "" }, m: { tab: null, parsed: null, sheetId: "" } };

  if (DEMO) {
    const d = demoAudit();
    const qt = d.q[pc.cfg.key] ?? d.q.gv;
    env.q = { tab: { title: "demo", sheetId: 1, grid: qt.grid, merges: qt.merges }, parsed: parseQuarterly(qt.grid, qt.merges), sheetId: "demo" };
    env.m = { tab: { title: "demo", sheetId: 2, grid: d.m.grid, merges: [] }, parsed: parseMonthly(d.m.grid), sheetId: "demo" };
    return env;
  }

  const attempt = async (url: string, what: string, specs: { prefix: string; range: string }[]) => {
    const id = sheetIdFromUrl(url);
    if (!id) throw new Error(`No ${what} link yet. Add it in Audit → Settings.`);
    const tabs = await readTabs(token, id, specs);
    return { id, tabs };
  };
  await Promise.all([
    (async () => {
      try {
        const r = await attempt(audit.quarterlyUrl, "quarterly audit sheet", [{ prefix: pc.cfg.auditTab, range: "A1:CZ150" }, { prefix: "prologue", range: "A1:H40" }]);
        env.q.sheetId = r.id;
        if (!r.tabs[0]) throw new Error(`The quarterly audit sheet has no tab starting with "${pc.cfg.auditTab}". Set the product's audit tab in Settings.`);
        env.q.tab = r.tabs[0]; env.q.parsed = parseQuarterly(r.tabs[0].grid, r.tabs[0].merges);
        if (!env.ecb.length && r.tabs[1]) env.ecb = findEmails(r.tabs[1].grid).filter((e) => /ecb/i.test(e));
      } catch (e) { env.q.error = (e as Error).message; }
    })(),
    (async () => {
      try {
        const r = await attempt(audit.monthlyUrl, "monthly report sheet", [{ prefix: "1 |", range: "A1:AC400" }]);
        env.m.sheetId = r.id;
        if (!r.tabs[0]) throw new Error('The monthly report sheet has no tab starting with "1 |" (Monthly – Outgoing).');
        env.m.tab = r.tabs[0]; env.m.parsed = parseMonthly(r.tabs[0].grid);
      } catch (e) { env.m.error = (e as Error).message; }
    })(),
  ]);
  return env;
}

/* ---------- overview (all EPs) ---------- */
export interface OverviewRow {
  key: string; name: string;
  q?: { inAudit: boolean; filled: number; total: number; blocks: { code: string; phase: string; tag?: string; filled: number; total: number }[] };
  m?: { filled: number; total: number; datesFilled: number; datesTotal: number };
}
export interface AuditOverview {
  audit: AuditCfg; window: AuditWindow; product: string; errors: { q?: string; m?: string }; rows: OverviewRow[];
}

export async function overview(token: string, auditId: string, productKey?: string | null): Promise<AuditOverview> {
  const env = await loadAudit(token, auditId, productKey);
  const rows: OverviewRow[] = [];
  if (env.q.parsed && env.q.tab) {
    for (const ep of env.q.parsed.eps) {
      const v = buildQuarterlyEp(env.q.parsed, env.q.tab.grid, ep, env.w);
      rows.push({ key: ep.key, name: ep.name, q: { inAudit: v.inAudit, filled: v.filled, total: v.total, blocks: v.blocks.map((b) => ({ code: b.code, phase: b.phase, tag: b.tag, filled: b.filled, total: b.total })) } });
    }
  }
  if (env.m.parsed && env.m.tab) {
    for (const r of env.m.parsed.rows.filter((x) => inProduct(x.product, env.pc.cfg.label))) {
      const v = buildMonthlyEp(env.m.parsed, env.m.tab.grid, r);
      const mm = { filled: v.filled, total: v.total, datesFilled: v.datesFilled, datesTotal: v.datesTotal };
      const hit = matchName(r.name, rows);
      if (hit) hit.m = mm; else rows.push({ key: r.key, name: r.name, m: mm });
    }
  }
  return { audit: env.audit, window: env.w, product: env.pc.cfg.label, errors: { q: env.q.error, m: env.m.error }, rows };
}

/* ---------- one EP ---------- */
export interface SourceItem { key: string; label: string; link: string; stage: string }
export interface AuditEpDetail {
  audit: AuditCfg; window: AuditWindow; product: string; name: string; key: string; submitted: boolean;
  q: QEpView | null; m: MEpView | null; errors: { q?: string; m?: string };
  sources: SourceItem[]; trackerMatched: boolean; ecb: string[];
}

export async function epDetail(token: string, auditId: string, productKey: string | null | undefined, epKey: string, env?: AuditEnv): Promise<AuditEpDetail> {
  env ??= await loadAudit(token, auditId, productKey);
  const qEp = env.q.parsed?.eps.find((e) => e.key === epKey) ?? null;
  const mRow = env.m.parsed?.rows.find((r) => r.key === epKey) ?? (qEp && env.m.parsed ? matchName(qEp.name, env.m.parsed.rows.filter((x) => inProduct(x.product, env.pc.cfg.label))) : null);
  const name = qEp?.name ?? mRow?.name;
  if (!name) throw new HttpError(404, "That EP isn't in the audit sheet.");

  // tracker EP -> source files for suggestions
  let sources: SourceItem[] = [], trackerMatched = false;
  try {
    const l = await load(token, env.pc);
    const tEp = matchName(name, l.parsed.eps);
    if (tEp) {
      trackerMatched = true;
      const view = computeEps(l.parsed, l.real, l.prep).find((e) => e.key === tEp.key)!;
      sources = l.parsed.items.filter((i) => view.states[i.key]?.link).map((i) => ({ key: i.key, label: i.label.trim(), link: view.states[i.key].link!, stage: i.standard }));
    }
  } catch { /* tracker problems shouldn't block the audit page */ }
  const byNorm = new Map(sources.map((s) => [norm(s.label), s.key]));
  const toKeys = (n: string[]) => n.map((x) => byNorm.get(x)).filter(Boolean) as string[];

  const q = qEp && env.q.parsed && env.q.tab ? buildQuarterlyEp(env.q.parsed, env.q.tab.grid, qEp, env.w) : null;
  q?.blocks.forEach((b) => b.slots.forEach((s) => { s.suggest = toKeys(s.suggest); }));
  const m = mRow && env.m.parsed && env.m.tab ? buildMonthlyEp(env.m.parsed, env.m.tab.grid, mRow) : null;
  m?.slots.forEach((s) => { s.suggest = toKeys(s.suggest); if (/tracker/i.test(s.label) && !s.sharedLink && !DEMO) s.sharedLink = `https://docs.google.com/spreadsheets/d/${env!.pc.sheetId}/edit`; });
  return { audit: env.audit, window: env.w, product: env.pc.cfg.label, name, key: epKey, submitted: !!env.audit.submitted, q, m, errors: { q: env.q.error, m: env.m.error }, sources, trackerMatched, ecb: env.ecb };
}

/* ---------- writing ---------- */
async function writeAudit(token: string, env: AuditEnv, which: "q" | "m", ops: CellOp[]) {
  if (!ops.length) return;
  if (DEMO) { applyToGrid(which === "q" ? demoAudit().q[env.pc.cfg.key]?.grid ?? demoAudit().q.gv.grid : demoAudit().m.grid, ops); return; }
  const t = env[which];
  await writeOps(token, t.sheetId, { real: t.tab!.sheetId, prep: -1 }, ops);
}

const auditFolder = async (token: string, a: AuditCfg) => drive.ensurePath(token, ROOT_FOLDER_ID, ["Audit", sanitize(a.label)]);
const guard = (a: AuditCfg) => { if (a.submitted) throw new HttpError(403, "This audit is marked as submitted, so it is locked. Unlock it first if you really need to change something."); };

export interface FillInput { auditId: string; product?: string | null; ep: string; slot: string; items?: string[]; urls?: string[] }

export async function fillSlot(token: string, inp: FillInput): Promise<AuditEpDetail> {
  const env = await loadAudit(token, inp.auditId, inp.product);
  guard(env.audit);
  const detail = await epDetail(token, inp.auditId, inp.product, inp.ep, env);
  const isQ = inp.slot.startsWith("q");
  const slot = isQ ? detail.q?.blocks.flatMap((b) => b.slots).find((s) => s.id === inp.slot) : detail.m?.slots.find((s) => s.id === inp.slot);
  if (!slot) throw new HttpError(404, "That checklist row no longer exists in the sheet. Refresh the page.");

  const urls = [
    ...(inp.items ?? []).map((k) => detail.sources.find((s) => s.key === k)?.link).filter(Boolean) as string[],
    ...(inp.urls ?? []).map((u) => u.trim()).filter(Boolean),
  ];
  if (!urls.length) throw new HttpError(400, "Pick at least one file or paste a link first.");

  let link: string;
  if (slot.mode === "link") {
    link = urls[0];
  } else if (DEMO) {
    link = `https://drive.google.com/drive/folders/DEMO-${slot.id}`;
  } else {
    const dest = await drive.ensurePath(token, await auditFolder(token, env.audit), [sanitize(env.pc.cfg.label), sanitize(detail.name), slot.folderName]);
    const prefix = `${shortNames([detail.name])[0]}_`;
    const files: drive.DriveFile[] = [];
    const budget = { left: 150 };
    for (const u of urls) {
      const id = drive.driveIdFromUrl(u);
      if (!id) throw new HttpError(400, `That isn't a Google Drive link: ${u}`);
      const meta = await drive.getMeta(token, id).catch(() => { throw new HttpError(400, `Can't open ${u}. Check that you have access to it.`); });
      if (meta.mimeType === drive.FOLDER_MIME) files.push(...(await drive.copyTree(token, id, dest, budget, prefix)));
      else files.push((await drive.findCopy(token, dest, id)) ?? (await drive.copyFile(token, id, `${prefix}${meta.name}`, dest, id)));
    }
    const fmtRaw = isQ ? (slot as unknown as { format: string }).format : "";
    const fmt = fmtRaw.toLowerCase();
    if (/direct link/.test(fmt) && files.length !== 1) throw new HttpError(400, `This requirement needs ONE direct file link (format: "${fmtRaw}"), but ${files.length} files were selected. Pick a single file, or merge them into one PDF first.`);
    link = /compile|folder/.test(fmt) || files.length !== 1 ? drive.folderUrl(dest) : files[0].webViewLink ?? drive.folderUrl(dest);
  }

  let ops: CellOp[];
  if (isQ) {
    const qEp = env.q.parsed!.eps.find((e) => e.key === inp.ep)!;
    const blk = detail.q!.blocks.find((b) => b.slots.some((s) => s.id === inp.slot))!;
    const tag = blk.tag ?? (blk.date ? MONTHS[+blk.date.slice(5, 7) - 1] : env.w.tags[2]);
    ops = planQFill(env.q.parsed!, qEp, inp.slot, tag, link);
  } else ops = planMFill(env.m.parsed!, inp.slot, link);
  await writeAudit(token, env, isQ ? "q" : "m", ops);
  return epDetail(token, inp.auditId, inp.product, inp.ep, DEMO ? undefined : await loadAudit(token, inp.auditId, inp.product));
}

export async function deferLater(token: string, auditId: string, product: string | null | undefined, epKey: string) {
  const env = await loadAudit(token, auditId, product);
  guard(env.audit);
  const qEp = env.q.parsed?.eps.find((e) => e.key === epKey);
  if (!qEp || !env.q.tab) throw new HttpError(404, "EP not found in the quarterly sheet.");
  await writeAudit(token, env, "q", planQDefer(env.q.parsed!, env.q.tab.grid, qEp, env.w));
  return epDetail(token, auditId, product, epKey);
}

export async function shareAudit(token: string, auditId: string) {
  const cfg = await getConfig(token);
  const audit = cfg.audits.find((a) => a.id === auditId);
  if (!audit) throw new HttpError(404, "Audit not found.");
  let emails = audit.ecbEmails;
  if (!emails.length) throw new HttpError(400, "No ECB emails set. Add them in Audit → Settings first.");
  if (DEMO) return { emails, folderUrl: "#", failed: [] as string[] };
  const folder = await auditFolder(token, audit);
  const failed: string[] = [];
  for (const e of emails) { try { await drive.shareWith(token, folder, e); } catch (err) { failed.push(`${e}: ${(err as Error).message}`); } }
  return { emails, folderUrl: drive.folderUrl(folder), failed };
}

export async function setSubmitted(token: string, auditId: string, submitted: boolean) {
  await patchAudit(token, auditId, { submitted });
}

/* ---------- browse an EP's existing Drive folder (to pick files that aren't in the tracker) ---------- */
export interface BrowseResult { folderId: string; crumbs: { id: string; name: string }[]; items: { id: string; name: string; folder: boolean; link: string }[] }

export async function browse(token: string, product: string | null | undefined, epName: string, folderId?: string): Promise<BrowseResult> {
  if (DEMO) {
    return { folderId: "demo", crumbs: [{ id: "demo", name: epName }], items: [
      { id: "d1", name: "01 - CV & Documents", folder: true, link: "https://drive.google.com/drive/folders/DEMO1" },
      { id: "d2", name: "EPM chat export (.txt)", folder: false, link: "https://drive.google.com/file/d/DEMOchat/view" },
      { id: "d3", name: "Insurance policy.pdf", folder: false, link: "https://drive.google.com/file/d/DEMOins/view" },
    ] };
  }
  const pc = await productCtx(token, product);
  const l = await load(token, pc);
  const tEp = matchName(epName, l.parsed.eps);
  if (!tEp) throw new HttpError(404, "This EP isn't in the tracker, so their Drive folder can't be located. Paste a link instead.");
  const root = await epFolder(token, pc, tEp);
  const cur = folderId || root;
  if (cur !== root && !(await drive.isInside(token, cur, root))) throw new HttpError(403, "That folder isn't inside this EP's folder.");
  const crumbs: { id: string; name: string }[] = [];
  let walk = cur;
  for (let i = 0; i < 8; i++) {
    const m = await drive.getMeta(token, walk);
    crumbs.unshift({ id: m.id, name: m.name });
    if (walk === root || !m.parents?.[0]) break;
    walk = m.parents[0];
  }
  const items = (await drive.listChildren(token, cur)).map((f) => ({ id: f.id, name: f.name, folder: f.mimeType === drive.FOLDER_MIME, link: f.webViewLink ?? (f.mimeType === drive.FOLDER_MIME ? drive.folderUrl(f.id) : `https://drive.google.com/file/d/${f.id}/view`) }));
  return { folderId: cur, crumbs, items };
}
export { phaseOf };
