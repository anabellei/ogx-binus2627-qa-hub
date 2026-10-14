import type { NextRequest } from "next/server";
import { apiCtx } from "@/lib/api";
import { epView, errorJson, load, snapshot } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { token, pc } = await apiCtx(req);
    const ep = req.nextUrl.searchParams.get("ep");
    if (ep) return Response.json({ ep: epView(await load(token, pc), ep) });
    return Response.json(await snapshot(token, pc));
  } catch (e) { return errorJson(e); }
}
