import type { NextRequest } from "next/server";
import { getCtx } from "@/lib/auth";
import { DEMO } from "@/lib/config";
import { driveIdFromUrl, getMeta } from "@/lib/drive";
import { sheetIdFromUrl, sheetTitles } from "@/lib/sheets";
import { errorJson } from "@/lib/service";

export const dynamic = "force-dynamic";

/** "Check this link" button in Settings: can I open it, and what is it? */
export async function POST(req: NextRequest) {
  try {
    const { token } = await getCtx(req);
    const { url, kind } = await req.json();
    if (DEMO) return Response.json({ ok: true, title: "Demo (not checked)", tabs: [] });
    if (kind === "folder") {
      const id = driveIdFromUrl(String(url));
      if (!id) return Response.json({ ok: false, message: "That doesn't look like a Drive folder link." });
      const m = await getMeta(token, id);
      return Response.json({ ok: true, title: m.name, tabs: [] });
    }
    const id = sheetIdFromUrl(String(url));
    if (!id) return Response.json({ ok: false, message: "That doesn't look like a Google Sheets link." });
    return Response.json({ ok: true, ...(await sheetTitles(token, id)) });
  } catch (e) { return Response.json({ ok: false, message: (e as Error).message }); }
}
