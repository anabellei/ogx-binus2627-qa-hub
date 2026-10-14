import type { NextRequest } from "next/server";
import { getCtx } from "@/lib/auth";
import { fillSlot } from "@/lib/audit-service";
import { errorJson } from "@/lib/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { token } = await getCtx(req);
    const b = await req.json();
    return Response.json({ detail: await fillSlot(token, { auditId: String(b.audit), product: b.product, ep: String(b.ep), slot: String(b.slot), items: b.items, urls: b.urls }) });
  } catch (e) { return errorJson(e); }
}
