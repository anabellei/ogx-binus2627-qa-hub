import { HttpError } from "./config";
import { gfetch, gjson, toError } from "./google";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER = "application/vnd.google-apps.folder";
const common = "supportsAllDrives=true&includeItemsFromAllDrives=true";
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export interface DriveFile { id: string; name: string; mimeType?: string; parents?: string[]; webViewLink?: string }

export async function findFolder(token: string, parent: string, name: string): Promise<string | null> {
  const q = `'${parent}' in parents and name = '${esc(name)}' and mimeType = '${FOLDER}' and trashed = false`;
  const r = await gjson<{ files: DriveFile[] }>(token, `${API}/files?${common}&fields=files(id)&pageSize=1&q=${encodeURIComponent(q)}`);
  return r.files[0]?.id ?? null;
}

export async function ensureFolder(token: string, parent: string, name: string): Promise<string> {
  const found = await findFolder(token, parent, name);
  if (found) return found;
  const f = await gjson<DriveFile>(token, `${API}/files?supportsAllDrives=true&fields=id`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] }),
  });
  return f.id;
}

export async function ensurePath(token: string, root: string, parts: string[]): Promise<string> {
  let cur = root;
  for (const p of parts) cur = await ensureFolder(token, cur, p);
  return cur;
}

export async function listFiles(token: string, folder: string): Promise<DriveFile[]> {
  const q = `'${folder}' in parents and mimeType != '${FOLDER}' and trashed = false`;
  const r = await gjson<{ files: DriveFile[] }>(token, `${API}/files?${common}&fields=files(id,name)&pageSize=200&q=${encodeURIComponent(q)}`);
  return r.files;
}

export async function getFile(token: string, id: string): Promise<DriveFile> {
  return gjson<DriveFile>(token, `${API}/files/${id}?supportsAllDrives=true&fields=id,name,parents,webViewLink`);
}

export async function moveFile(token: string, id: string, from: string, to: string) {
  await gjson(token, `${API}/files/${id}?supportsAllDrives=true&addParents=${to}&removeParents=${from}&fields=id`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}",
  });
}

export async function startResumable(
  token: string,
  meta: { name: string; parent: string; mime: string; size: number; description: string },
): Promise<string> {
  const res = await gfetch(token, `${UPLOAD}?uploadType=resumable&supportsAllDrives=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": meta.mime || "application/octet-stream",
      "X-Upload-Content-Length": String(meta.size),
    },
    body: JSON.stringify({ name: meta.name, parents: [meta.parent], description: meta.description }),
  });
  if (!res.ok) throw await toError(res);
  const loc = res.headers.get("location");
  if (!loc) throw new HttpError(502, "Drive did not return an upload session.");
  return loc;
}

export const isDriveSession = (u: string) => u.startsWith(`${UPLOAD}?`);

export async function putChunk(
  token: string, session: string, bytes: Uint8Array, start: number, total: number,
): Promise<{ done: false } | { done: true; fileId: string }> {
  const end = start + bytes.byteLength;
  const res = await gfetch(token, session, {
    method: "PUT",
    headers: { "Content-Range": `bytes ${start}-${end - 1}/${total}`, "Content-Length": String(bytes.byteLength) },
    body: bytes as unknown as BodyInit,
  });
  if (res.status === 308) return { done: false };
  if (res.status === 200 || res.status === 201) {
    const j = (await res.json()) as { id: string };
    return { done: true, fileId: j.id };
  }
  throw await toError(res);
}

/* ---------- additions for products, audit copies and stored settings ---------- */
export const driveIdFromUrl = (u: string): string => {
  const s = u.trim();
  const m = /\/(?:folders|d)\/([\w-]{15,})/.exec(s) ?? /[?&]id=([\w-]{15,})/.exec(s);
  if (m) return m[1];
  return /^[\w-]{15,}$/.test(s) ? s : "";
};
export const FOLDER_MIME = FOLDER;
export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

export async function listChildren(token: string, folder: string): Promise<DriveFile[]> {
  const q = `'${folder}' in parents and trashed = false`;
  const r = await gjson<{ files: DriveFile[] }>(token, `${API}/files?${common}&fields=files(id,name,mimeType,webViewLink)&pageSize=300&orderBy=${encodeURIComponent("folder,name")}&q=${encodeURIComponent(q)}`);
  return r.files;
}

export async function getMeta(token: string, id: string): Promise<DriveFile> {
  return gjson<DriveFile>(token, `${API}/files/${id}?supportsAllDrives=true&fields=id,name,mimeType,parents,webViewLink`);
}

export async function copyFile(token: string, id: string, name: string, parent: string, srcId: string): Promise<DriveFile> {
  return gjson<DriveFile>(token, `${API}/files/${id}/copy?supportsAllDrives=true&fields=id,name,webViewLink`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parents: [parent], appProperties: { srcId } }),
  });
}

export async function findCopy(token: string, parent: string, srcId: string): Promise<DriveFile | null> {
  const q = `'${parent}' in parents and appProperties has { key='srcId' and value='${srcId}' } and trashed = false`;
  const r = await gjson<{ files: DriveFile[] }>(token, `${API}/files?${common}&fields=files(id,name,webViewLink)&pageSize=1&q=${encodeURIComponent(q)}`);
  return r.files[0] ?? null;
}

/** Copy every file inside a folder (up to `budget.left` files, 3 levels deep) into `dest`. */
export async function copyTree(token: string, src: string, dest: string, budget: { left: number }, prefix: string, depth = 0): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  for (const f of await listChildren(token, src)) {
    if (budget.left <= 0) break;
    if (f.mimeType === FOLDER) {
      if (depth >= 2) continue;
      const sub = await ensureFolder(token, dest, f.name);
      out.push(...(await copyTree(token, f.id, sub, budget, prefix, depth + 1)));
    } else if (!f.mimeType?.startsWith("application/vnd.google-apps.") || /document|spreadsheet|presentation/.test(f.mimeType)) {
      budget.left--;
      out.push((await findCopy(token, dest, f.id)) ?? (await copyFile(token, f.id, `${prefix}${f.name}`, dest, f.id)));
    }
  }
  return out;
}

export async function isInside(token: string, id: string, root: string): Promise<boolean> {
  let cur = id;
  for (let i = 0; i < 10; i++) {
    if (cur === root) return true;
    const m = await getMeta(token, cur).catch(() => null);
    const p = m?.parents?.[0];
    if (!p) return false;
    cur = p;
  }
  return false;
}

export async function shareWith(token: string, id: string, email: string) {
  await gjson(token, `${API}/files/${id}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "user", emailAddress: email }),
  });
}

/* tiny JSON file store (used for app settings so it works on Vercel without a database) */
export async function readJsonFile<T>(token: string, parent: string, name: string): Promise<{ id: string; data: T } | null> {
  const q = `'${parent}' in parents and name = '${esc(name)}' and trashed = false`;
  const r = await gjson<{ files: DriveFile[] }>(token, `${API}/files?${common}&fields=files(id)&pageSize=1&q=${encodeURIComponent(q)}`);
  const f = r.files[0];
  if (!f) return null;
  const res = await gfetch(token, `${API}/files/${f.id}?alt=media&supportsAllDrives=true`);
  if (!res.ok) throw await toError(res);
  return { id: f.id, data: (await res.json()) as T };
}

export async function writeJsonFile(token: string, parent: string, name: string, existingId: string | null, data: unknown) {
  const body = JSON.stringify(data, null, 2);
  if (existingId) {
    const res = await gfetch(token, `${UPLOAD}/${existingId}?uploadType=media&supportsAllDrives=true`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
    if (!res.ok) throw await toError(res);
    return;
  }
  const b = "qahubboundary";
  const multipart = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parent], mimeType: "application/json" })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
  const res = await gfetch(token, `${UPLOAD}?uploadType=multipart&supportsAllDrives=true`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${b}` }, body: multipart });
  if (!res.ok) throw await toError(res);
}

export async function listFolders(token: string, parent: string): Promise<DriveFile[]> {
  const q = `'${parent}' in parents and mimeType = '${FOLDER}' and trashed = false`;
  const r = await gjson<{ files: DriveFile[] }>(token, `${API}/files?${common}&fields=files(id,name)&pageSize=300&q=${encodeURIComponent(q)}`);
  return r.files;
}
