# Using Google Sheets for Programs

OGEA stores **users, chats and OTPs in MongoDB** (they need password hashing,
transactions and atomic counters) and can store **programs in a Google Sheet**.
Set `SHEETS_API_URL` to switch the programs store over; leave it unset to keep
using MongoDB.

```
frontend ──▶ Express /api/v1/programs ──▶ programsStore ──┬─▶ MongoDB (default)
                                                          └─▶ Apps Script Web App ──▶ Google Sheet
```

The routes and the frontend contract do not change: the store returns `_id`,
`status`, `imageurls`, `tags`, `deadline`, `eventDate`, pagination and search
exactly as the MongoDB driver did.

## 1. Prepare the sheet

1. Open the sheet and go to **Extensions ▸ Apps Script**.
2. Replace the contents of `Code.gs` with `google-apps-script/Code.gs` from this repo.
3. **Project Settings ▸ Script properties ▸ Add script property**
   - `SHEETS_TOKEN` = a long random string. Generate one with:
     ```
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
4. Run the `setup()` function once (authorise when prompted). This creates the
   `Programs` tab with the right headers.

## 2. Deploy the web app

1. **Deploy ▸ New deployment ▸ Web app**
   - Description: `OGEA programs API`
   - Execute as: **Me**
   - Who has access: **Anyone**
2. Copy the **deployment URL** (it ends in `/exec`).
3. Re-deploy a new version whenever you change `Code.gs`.

> "Anyone" only means the URL is reachable. Every request must still present the
> correct `SHEETS_TOKEN`, which is compared in constant time and never logged.

## 3. Point the API at it

Add to the API environment (Vercel project settings or local `.env`):

```
SHEETS_API_URL=https://script.google.com/macros/s/XXXXXXXX/exec
SHEETS_API_TOKEN=<the same value as SHEETS_TOKEN>
# optional
SHEETS_TIMEOUT_MS=8000
```

Restart the API. `GET /api/v1/health` now reports `"programs": "sheets"`.

## 4. Copy existing programs (optional)

```
SHEETS_API_URL=... SHEETS_API_TOKEN=... npm run sheets:sync
```

Re-running is safe: programs already in the sheet (matched by `id`) are skipped.

## Notes and limits

- **Programs only.** Do not put users, passwords, chats or OTPs in the sheet.
- **Quotas.** Apps Script allows ~20k URL-fetch calls/day and ~90 min execution/day
  per account. Reads are cached by the API for 60s (300s for categories).
- **Writes are serialised** with `LockService`, but Apps Script offers no
  transactions. For heavy write traffic, keep programs in MongoDB.
- **Column order is free.** The script reads by header name; you can add or
  reorder columns as long as the header names are kept.
