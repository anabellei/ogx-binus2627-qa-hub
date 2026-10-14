import type { NextRequest } from "next/server";
import { getCtx } from "@/lib/auth";
import { DEMO, HttpError } from "@/lib/config";
import { isDriveSession, putChunk } from "@/lib/drive";
import { errorJson } from "@/lib/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function PUT(req: NextRequest) {
  try {
    const { token } = await getCtx(req);
    const sp = req.nextUrl.searchParams;
    const session = sp.get("session") ?? "";
    const start = Number(sp.get("start")), total = Number(sp.get("total"));
    const body = new Uint8Array(await req.arrayBuffer());
    if (!body.byteLength || !Number.isFinite(start) || !Number.isFinite(total)) throw new HttpError(400, "Bad chunk.");
    if (DEMO) {
      return Response.json(start + body.byteLength >= total ? { done: true, fileId: `demo${Date.now().toString(36)}` } : { done: false });
    }
    if (!isDriveSession(session)) throw new HttpError(400, "Invalid upload session.");
    return Response.json(await putChunk(token, session, body, start, total));
  } catch (e) { return errorJson(e); }
}
