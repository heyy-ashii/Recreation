# AGENTS.md

## Project

OGEA – "Opportunities Beyond Campus". React (Vite) frontend + Express API.
Frontend in `src/`, API in `server/`, Vercel serverless entry in `api/index.js`.

## Commands

- `npm run dev` – API (:4000) + Vite (:5173) together
- `npm test` – vitest (spins up an in-memory MongoDB)
- `npm run lint` / `npm run typecheck` / `npm run build`
- `npm run seed:admin` – needs `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- `npm run sheets:sync` – copy programs from MongoDB into the Google Sheet

## Data layer

Two interchangeable datastores. Setting `SHEETS_API_URL` + `SHEETS_API_TOKEN`
switches **everything** (users, OTPs, chats, messages, programs) onto a Google
Sheet and MongoDB is not touched; leaving them unset keeps MongoDB.

- MongoDB (default): Mongoose models in `server/models/`.
- Google Sheets: `server/sheets/odm.js` mimics the Mongoose surface the routes
  use (`find`, `findOne`, `create`, `save`, `populate`, `aggregate`) over an Apps
  Script Web App (`google-apps-script/Code.gs`). Models in `server/models/` pick
  their driver from `sheetsConfigured()`; routes are driver-agnostic.
- Programs additionally have a named-action store (`server/sheets/programsStore.js`)
  used by the programs routes; it returns `_id`, `status`, `imageurls`, `tags`,
  pagination and search in the shape the frontend expects.

See `docs/google-sheets.md`. Keep the spreadsheet **private** (Share ▸
Restricted): the Apps Script runs as its owner and reads it, and every request
is gated by a constant-time `SHEETS_TOKEN` check. Password hashes and OTP codes
are in the sheet, so link-sharing it would leak them.

## Conventions

- API responses: `{ status, data }`; errors via `AppError` (operational → its
  status code, otherwise a generic 500 with no internals leaked).
- IDs: Mongo ObjectIds under MongoDB; the Sheet uses UUIDs, so validators accept
  either (`objectId` and `programId` in `server/middleware/validate.js`).
- Compare ids with `String(a) === String(b)`, never `a.equals(b)` — the Sheets
  driver returns plain strings.
- The Sheets ODM applies schema defaults (`spec.defaults`) and must resolve
  `findOne`/`findById` to a single document, not an array.
- Tests live in `server/tests/`; `sheets.test.js` runs the full app against a
  local in-memory fake of the Apps Script protocol, with no MongoDB.

## Gotchas

- Apps Script POSTs answer 302 to `script.googleusercontent.com`; Node's fetch
  drops the body on redirect, so the client re-POSTs. Keep that behaviour.
- Frontend `useEffect` callbacks must not implicitly return a value that is not
  a function (React throws "destroy is not a function").
- The sandbox resets between sessions: Docker, MongoDB and the dev servers are
  gone on return and must be restarted.
