import type { NextRequest } from "next/server";
import { apiCtx } from "@/lib/api";
import { errorJson, finishUpload } from "@/lib/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const { token, pc } = await apiCtx(req, b?.product);
    const ep = await finishUpload(token, pc, String(b.ep), String(b.item), Array.isArray(b.fileIds) ? b.fileIds.map(String) : []);
    return Response.json({ ep });
  } catch (e) { return errorJson(e); }
}
