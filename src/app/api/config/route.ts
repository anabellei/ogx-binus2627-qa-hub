import type { NextRequest } from "next/server";
import { getCtx } from "@/lib/auth";
import { getConfig, saveConfig } from "@/lib/appconfig";
import { errorJson } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try { return Response.json(await getConfig((await getCtx(req)).token, true)); } catch (e) { return errorJson(e); }
}
export async function PUT(req: NextRequest) {
  try { return Response.json(await saveConfig((await getCtx(req)).token, await req.json())); } catch (e) { return errorJson(e); }
}
