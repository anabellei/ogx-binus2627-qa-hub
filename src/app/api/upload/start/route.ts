import type { NextRequest } from "next/server";
import { apiCtx } from "@/lib/api";
import { errorJson, startUpload } from "@/lib/service";
import { HttpError } from "@/lib/config";
import { MAX_FILE_BYTES } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const { token, user, pc } = await apiCtx(req, b?.product);
    if (!b?.ep || !b?.item || !b?.name || !(b.size > 0)) throw new HttpError(400, "Missing upload details (or the file is empty).");
    if (b.size > MAX_FILE_BYTES) throw new HttpError(413, "File is too large (max 250 MB).");
    return Response.json(await startUpload(token, pc, user.email || user.name, b.ep, b.item, { name: String(b.name), type: String(b.type ?? ""), size: Number(b.size) }));
  } catch (e) { return errorJson(e); }
}
