export const DEMO = process.env.DEMO_MODE === "true";
export const SHEET_ID = process.env.TRACKER_SHEET_ID ?? "";
export const ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID ?? "";
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
