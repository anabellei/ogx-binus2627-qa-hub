import type { NextRequest } from "next/server";
import { getCtx } from "@/lib/auth";
import { DEMO, ROOT_FOLDER_ID, SHEET_ID, cleanEnv } from "@/lib/config";
import { getMeta } from "@/lib/drive";

export const dynamic = "force-dynamic";

/** Open /api/health (signed in) to see what the deployment can see. Shows no secrets. */
export async function GET(req: NextRequest) {
  const out: Record<string, unknown> = {
    demo: DEMO,
    region: process.env.VERCEL_REGION ?? "local",
    nextauthUrl: cleanEnv(process.env.NEXTAUTH_URL) || "(not set)",
    requestHost: req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
    googleClientIdSet: !!cleanEnv(process.env.GOOGLE_CLIENT_ID),
    googleClientSecretSet: !!cleanEnv(process.env.GOOGLE_CLIENT_SECRET),
    nextauthSecretSet: !!cleanEnv(process.env.NEXTAUTH_SECRET),
    rootFolderIdLength: ROOT_FOLDER_ID.length,
    rootFolderIdPreview: ROOT_FOLDER_ID ? `${ROOT_FOLDER_ID.slice(0, 5)}…${ROOT_FOLDER_ID.slice(-4)}` : "(not set)",
    trackerSheetIdSet: !!SHEET_ID,
    allowedEmailsSet: !!cleanEnv(process.env.ALLOWED_EMAILS),
  };
  try {
    const { token, user } = await getCtx(req);
    out.signedInAs = user.email;
    if (!DEMO && ROOT_FOLDER_ID) {
      try { const m = await getMeta(token, ROOT_FOLDER_ID); out.rootFolder = `OK: "${m.name}"`; }
      catch (e) { out.rootFolder = `CAN'T OPEN: ${(e as Error).message}`; }
    }
  } catch (e) { out.signedIn = (e as Error).message; }
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
