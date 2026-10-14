import type { NextRequest } from "next/server";
import { apiCtx } from "@/lib/api";
import { HttpError } from "@/lib/config";
import { errorJson, mark } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const { token, pc } = await apiCtx(req, b?.product);
    if (!["nodiff", "reset", "tick", "sync"].includes(b?.action)) throw new HttpError(400, "Unknown action.");
    return Response.json({ ep: await mark(token, pc, String(b.ep), String(b.item), b.action) });
  } catch (e) { return errorJson(e); }
}
