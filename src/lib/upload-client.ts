import { CHUNK_SIZE } from "./types";

function put(url: string, blob: Blob, onProgress: (loaded: number) => void): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
    x.onload = () => { let json: any = {}; try { json = JSON.parse(x.responseText); } catch { /* ignore */ } resolve({ status: x.status, json }); };
    x.onerror = () => reject(new Error("Network error while uploading."));
    x.send(blob);
  });
}

export async function uploadFile(
  product: string, epKey: string, itemKey: string, file: File, onProgress: (fraction: number) => void,
): Promise<{ fileId: string; name: string }> {
  const sres = await fetch("/api/upload/start", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product, ep: epKey, item: itemKey, name: file.name, type: file.type, size: file.size }),
  });
  const s = await sres.json();
  if (!sres.ok) throw new Error(s.error ?? "Could not start the upload.");

  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const url = `/api/upload/chunk?session=${encodeURIComponent(s.session)}&start=${offset}&total=${file.size}`;
    let attempt = 0, res: { status: number; json: any };
    for (;;) {
      try {
        res = await put(url, file.slice(offset, end), (l) => onProgress((offset + l) / file.size));
        if (res.status < 500) break;
        throw new Error(res.json.error ?? "Server error");
      } catch (e) {
        if (++attempt >= 3) throw e;
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
    if (res.status >= 400) throw new Error(res.json.error ?? "Upload failed.");
    offset = end;
    onProgress(offset / file.size);
    if (res.json.done) return { fileId: res.json.fileId, name: s.name };
  }
  throw new Error("Upload ended unexpectedly.");
}
