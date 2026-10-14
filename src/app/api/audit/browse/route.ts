import type { NextRequest } from "next/server";
import { getCtx } from "@/lib/auth";
import { browse } from "@/lib/audit-service";
import { errorJson } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { token } = await getCtx(req);
    const sp = req.nextUrl.searchParams;
    return Response.json(await browse(token, sp.get("p"), sp.get("name") ?? "", sp.get("folder") ?? undefined));
  } catch (e) { return errorJson(e); }
}
