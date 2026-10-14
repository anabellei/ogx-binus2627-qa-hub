import type { NextRequest } from "next/server";
import { getCtx } from "@/lib/auth";
import { setSubmitted } from "@/lib/audit-service";
import { errorJson } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { token } = await getCtx(req);
    const b = await req.json();
    await setSubmitted(token, String(b.audit), !!b.submitted);
    return Response.json({ ok: true });
  } catch (e) { return errorJson(e); }
}
