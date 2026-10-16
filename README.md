# oGX QA Hub

1. **Exchange QA**: staff upload a document once; it is renamed, filed in the EP's Drive folder, and the tracker (Realization + Preparation tabs) is updated.
2. **Audit**: for each audit round, build every EP's checklist from their dates, copy the right documents into a separate audit folder, and link the copies in the ECB audit sheets.
3. **Settings**: paste links to sheets/folders in the app (no code edits).

## Try it with fake data
```bash
npm install
npm run demo        # works on Windows/Mac/Linux, http://localhost:3000
```

## Go live
### Google Cloud (once)
Enable **Drive API** + **Sheets API**; OAuth consent screen (Internal for a Workspace domain); OAuth client (Web app) with redirect URIs
`http://localhost:3000/api/auth/callback/google` and `https://YOUR-APP.vercel.app/api/auth/callback/google`.

### Environment variables (local `.env.local` and Vercel)
See `.env.example`. Required: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DRIVE_ROOT_FOLDER_ID`.
`DRIVE_ROOT_FOLDER_ID` = the MAIN folder that contains your `GV` and `GTa` folders.

### First run
Sign in → **Settings** → add your products (GV, GTa): name + tracker sheet link + the product's Drive folder link → **Check** each link → Save.
Settings are stored in `_qa-hub-settings.json` inside the main folder, so they survive redeploys.

## Counting rules (Exchange QA)
- **Break status**: an EP whose name starts with `[BREAK RE]` / `[BREAK APD]` in the Realization tab is shown as "On break". Their documents are not counted: not in the EP's progress, not in the dashboard totals, not as "missing". They can still upload.
- **Optional documents** never count as missing and don't affect progress: Volunteer working timeline, Letter for University, Letter from University. Edit the list (`OPTIONAL_ITEMS`) in `src/lib/catalog.ts`.

## Existing Drive folders (adopted, not reorganised)
- The app finds each EP's folder by name (`01. Melina Patricia`, `03. Nicolas Khristanto (BREAK RE)` ... numbers and brackets are ignored, spelling can differ slightly). If none exists it creates `NN. Name (TAG)`.
- Files you already have stay exactly where they are. The tracker's links are the source of truth, so nothing breaks.
- **New** uploads go to `<EP folder>/QA Hub/<stage>/<standard>/…`, so they never mix with the folders each EPM made. (Change `APP_SUBFOLDER` in `src/lib/catalog.ts`; empty = directly in the EP folder.)

## Audit
Set up in Settings: audit name, **year + quarter**, link to your copy of the quarterly audit sheet, link to your copy of the monthly/APD report, ECB emails.
- **Window** = the calendar quarter you pick in Settings: Q1 Jan–Mar, Q2 Apr–Jun, Q3 Jul–Sep, Q4 Oct–Dec. Month tags (`[JUL]` `[AUG]` `[SEP]`…) come from this.
- **Checklist per EP, per block** (read from the sheet):
  - Block date inside the window → **due**, tagged with the month of that date (APD/General blocks use the Approved date, Realized uses Realized, Finished uses Finished).
  - Date after the window (or missing) → **next quarter**. One click writes "Next Quarter" into the empty cells.
  - Date before the window → **covered earlier** (left alone).
  - An EP with no approved/realized/finished date in the window is not part of the audit (hidden by default).
- **Fill a row**: tick suggested files from the EP's tracker items, browse the EP's Drive folder, or paste a link → **Copy & link**. Files are copied to `Audit/<audit name>/<product>/<EP>/<requirement>/` (originals untouched, safe to change later). The sheet gets `[AUG] here` linked to the copy (one file) or to the folder (several / "compile in drive").
  - "Direct link" requirements need exactly one file; the app tells you if you picked several.
  - Shared documents (national ES tracker, risk tool, resumption folder) are linked as-is, not copied.
  - One document covering several criteria rows (e.g. the ECB template PDF) fills all of those rows at once.
- **Share with ECB**: explicit button, gives the ECB emails *view* access to the audit folder. No email is sent.
- **Mark as submitted**: locks changes in the app (not in Drive/Sheets).
- Suggestions (which tracker item usually answers which requirement) are in `src/lib/audit-map.ts`; edit freely.

## Adding teammates
1. **Google permissions** (this is what actually controls access, the app acts as each person): give them *Editor* on the tracker sheets, the audit sheets, and the main Drive folder.
2. **Let them sign in** (Google Cloud → OAuth consent screen):
   - Workspace accounts → set the app to **Internal**, nothing else needed.
   - Personal Gmail → **External**. While the app is in *Testing*, add each person under *Test users* (max 100) and note that Google expires their login every 7 days. To avoid weekly re-login, click **Publish app** (In production). No verification needed for up to 100 users; they see an "unverified app" screen once: Advanced → Go to app.
3. **Optional lock-down**: set `ALLOWED_EMAILS` (and/or `ALLOWED_EMAIL_DOMAINS`) in Vercel so only your team can sign in.

## If sign-in fails on Vercel ("State cookie was missing")
Login cookies belong to ONE web address. Make sure `NEXTAUTH_URL` is exactly your production address (`https://your-app.vercel.app`, https, no trailing slash), the same address is in Google's *Authorized redirect URIs* (`…/api/auth/callback/google`), then **redeploy** (env changes only apply to new deployments). The app also redirects any other Vercel address to `NEXTAUTH_URL` automatically.

## Deploy to Vercel
Push to GitHub → import → add the env vars → set `NEXTAUTH_URL` to the Vercel URL → add the Vercel callback URL to the OAuth client.
Large files are uploaded in 4 MB chunks to fit Vercel's request limit.
