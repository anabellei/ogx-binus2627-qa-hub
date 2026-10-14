import { HttpError } from "./config";

export async function gfetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return res;
}

export async function gjson<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await gfetch(token, url, init);
  if (!res.ok) throw await toError(res);
  return (await res.json()) as T;
}

export async function toError(res: Response): Promise<HttpError> {
  let msg = `Google API error (${res.status})`;
  try {
    const j = await res.json();
    msg = j?.error?.message ?? msg;
  } catch { /* ignore */ }
  if (res.status === 401) return new HttpError(401, "Your Google session expired. Please sign in again.");
  if (res.status === 403) return new HttpError(403, `Google says you don't have permission: ${msg}`);
  if (res.status === 404) return new HttpError(404, `Not found on Google (check the sheet/folder ID and your access): ${msg}`);
  return new HttpError(res.status >= 500 ? 502 : res.status, msg);
}
