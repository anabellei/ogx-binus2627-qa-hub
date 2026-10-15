export const DEMO = process.env.DEMO_MODE === "true";
/** Env values pasted into Vercel often carry spaces, newlines, quotes or a whole URL. Accept all of those. */
export const cleanEnv = (v?: string) => (v ?? "").trim().replace(/^["'`]+|["'`]+$/g, "").trim();
const idFrom = (v?: string) => { const s = cleanEnv(v); const m = /\/(?:folders|d)\/([\w-]+)/.exec(s); return m ? m[1] : s; };
export const SHEET_ID = idFrom(process.env.TRACKER_SHEET_ID);
export const ROOT_FOLDER_ID = idFrom(process.env.DRIVE_ROOT_FOLDER_ID);
export const REAL_PREFIX = process.env.REALIZATION_TAB_PREFIX ?? "3.0";
export const PREP_PREFIX = process.env.PREPARATION_TAB_PREFIX ?? "2.1";
export const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
export const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS ?? "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
export const SHEET_URL = SHEET_ID ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit` : "#";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
