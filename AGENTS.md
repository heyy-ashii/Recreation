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

Users, chats and OTPs always live in MongoDB (bcrypt, transactions, atomic counters).
Programs use a store adapter (`server/sheets/programsStore.js`) with two drivers:

- MongoDB by default
- Google Sheets when `SHEETS_API_URL` + `SHEETS_API_TOKEN` are set

The Sheets driver talks to an Apps Script Web App (`google-apps-script/Code.gs`)
and returns the same shape the frontend expects (`_id`, `status`, `imageurls`,
`tags`, pagination, search). See `docs/google-sheets.md`.

## Conventions

- API responses: `{ status, data }`; errors via `AppError` (operational → its
  status code, otherwise a generic 500 with no internals leaked).
- IDs: Mongo ObjectIds for users/chats, but programs accept ObjectId or UUID
  (`programId` validator) because the Sheet uses UUIDs.
- Tests live in `server/tests/`; `sheets.test.js` runs against a local
  in-memory fake of the Apps Script protocol.

## Gotchas

- Apps Script POSTs answer 302 to `script.googleusercontent.com`; Node's fetch
  drops the body on redirect, so the client re-POSTs. Keep that behaviour.
- Frontend `useEffect` callbacks must not implicitly return a value that is not
  a function (React throws "destroy is not a function").
