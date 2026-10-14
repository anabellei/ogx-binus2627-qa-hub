import type { NextRequest } from "next/server";
import { getCtx } from "@/lib/auth";
import { deferLater } from "@/lib/audit-service";
import { errorJson } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { token } = await getCtx(req);
    const b = await req.json();
    return Response.json({ detail: await deferLater(token, String(b.audit), b.product, String(b.ep)) });
  } catch (e) { return errorJson(e); }
}
