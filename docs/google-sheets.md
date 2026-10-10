# Using Google Sheets as the whole datastore

OGEA can run with **no database at all**: when `SHEETS_API_URL` is set, users,
OTPs, chats, messages and posts all live in a Google Sheet. Leave it unset
and everything stays in MongoDB.

```
frontend ──▶ Express API ──▶ Sheets ODM ──▶ Apps Script Web App ──▶ Google Sheet
```

The routes and the frontend contract do not change. A small ODM
(`server/sheets/odm.js`) mimics the parts of Mongoose the app uses — `find`,
`findOne`, `create`, `save`, `populate`, `aggregate` — and matches queries in
Node, so `$or`, `$regex` and date comparisons behave as before.

## 1. Prepare the sheet

1. Open the sheet and go to **Extensions ▸ Apps Script**.
2. Replace `Code.gs` with `google-apps-script/Code.gs` from this repo.
3. **Project Settings ▸ Script properties ▸ Add script property**
   - `SHEETS_TOKEN` = a long random string:
     ```
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
4. Run `setup()` once (authorise when prompted). This creates the `Users`,
   `Otps`, `Conversations`, `Messages` and `Posts` tabs.

## 2. Keep the spreadsheet private

Set **Share ▸ Restricted**. The Apps Script runs *as you*, so it can read the
private sheet while the Web App stays reachable. Only the token grants access.

> This matters. A link-shared sheet would expose password hashes and OTP codes
> to anyone with the URL. Do not share the sheet itself — share nothing; the
> script is the only reader.

## 3. Deploy the web app

1. **Deploy ▸ New deployment ▸ Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
2. Copy the deployment URL (ends in `/exec`).
3. Re-deploy a new version whenever you change `Code.gs`.

"Anyone" only means the URL is reachable; every request must present the token.

## 4. Point the API at it

```
SHEETS_API_URL=https://script.google.com/macros/s/XXXXXXXX/exec
SHEETS_API_TOKEN=<the same value as SHEETS_TOKEN>
SHEETS_TIMEOUT_MS=8000
```

MongoDB is not used in this mode; `MONGODB_URI` may be left empty. Restart the
API and `GET /api/v1/health` reports `"datastore": "sheets"`.

## 5. Seed an admin

```
SHEETS_API_URL=... SHEETS_API_TOKEN=... \
  ADMIN_USERNAME=admin ADMIN_PASSWORD=your-password ADMIN_EMAIL=you@example.com \
  npm run seed:admin
```

## Migrating existing data

Users, chats and OTPs are not copied between datastores — recreate the admin
with `seed:admin` and let users sign up again.

## Limits — read before choosing this

| Concern | Reality |
|---|---|
| Requests | Apps Script allows ~20k URL-fetch calls/day and ~90 min execution/day per account |
| Latency | Every query is an HTTPS round-trip to Apps Script; expect hundreds of ms, not single-digit ms |
| Scale | The whole table is fetched and filtered in Node. Fine for hundreds of rows, not hundreds of thousands |
| Atomicity | `LockService` serialises writes, but there are no transactions |
| Uniqueness | `unique` is not enforced by the sheet; duplicates are only as good as the app's checks |
| Security | Password hashes and OTPs sit in the sheet. Keep it private. bcrypt (cost 12) still applies |

If any of those bite, put `MONGODB_URI` back and remove `SHEETS_API_URL` —
the app switches back to MongoDB with no code change.
