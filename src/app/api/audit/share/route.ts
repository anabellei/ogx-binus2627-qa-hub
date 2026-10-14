import type { NextRequest } from "next/server";
import { getCtx } from "@/lib/auth";
import { shareAudit } from "@/lib/audit-service";
import { errorJson } from "@/lib/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { token } = await getCtx(req);
    return Response.json(await shareAudit(token, String((await req.json()).audit)));
  } catch (e) { return errorJson(e); }
}
