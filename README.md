# OGEA — Opportunities Beyond Campus

Student-opportunities platform (quizzes, workshops, writing competitions, seminars, conferences, Kitab, Hadith …) with a public site, an admin dashboard, email-OTP sign-up and a built-in **Chat with Admin**.

Created by **Ashique.Pilassery**.

One Vercel project serves both parts:

| Part | Tech | Path |
| --- | --- | --- |
| Frontend | Vite · React 19 · TypeScript · Tailwind CSS v4 · TanStack Query · React Router | `src/` → built to `dist/` |
| API | Express 5 · Mongoose (MongoDB) · JWT in HttpOnly cookie · Zod · Helmet · rate limiting · Nodemailer · Cloudinary | `server/`, exposed by `api/index.js` at `/api/v1/*` |

Because the site and the API share one domain, there is no cross-site cookie/CORS setup to get wrong.

## Routes

**Public:** `/` · `/discover` · `/search` · `/about` (credits + login / Create Account) · `/contact` · `/programs/:id` · `/login` · `/signup` · `/account` (signed-in users)

**Admin (role `admin` only):** `/admin` (stats) · `/admin/users` (user table) · `/admin/programs` (program CRUD + image upload) · `/admin/chats` (chat inbox)

**API (`/api/v1`):**

| Area | Endpoints |
| --- | --- |
| Health | `GET /health` |
| Auth | `POST /auth/signup/request-otp`, `POST /auth/signup/verify`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/password/request-otp`, `POST /auth/password/reset`, `GET /auth/me`, `PATCH /auth/update-me`, `PATCH /auth/update-password` |
| Programs | `GET /programs` (`q`, `category`, `status`, `sort`, `page`, `limit`), `GET /programs/categories`, `GET /programs/:id`, admin: `POST /programs`, `PATCH /programs/:id`, `DELETE /programs/:id` |
| Admin | `GET /admin/stats`, `GET/POST /admin/users`, `PATCH/DELETE /admin/users/:id` |
| Chat | user: `GET /chat/me`, `GET /chat/me/unread`, `POST /chat/me/messages`; admin: `GET /chat/conversations`, `GET/POST /chat/conversations/:id/messages`, `PATCH /chat/conversations/:id` |
| Upload | admin: `POST /upload` (multipart `images`, Cloudinary) |

## Features

- **Footer:** `ogea.sms@gmail.com` opens the mail app (`mailto:`); **Chat with Admin** opens the chat panel.
- **Chat with Admin:** signed-in users message the admins from any page; admins reply from `/admin/chats` and can mark conversations resolved. Messages are stored in MongoDB and refreshed by polling every 5 s (Vercel functions can't hold WebSocket connections).
- **Create Account:** on `/about`, `/login` or `/signup`. The user enters an email, receives a 6-digit code, then picks a name, username and password. Phone/SMS sign-up is not built yet (see *Adding SMS later*).
- **Forgot password:** reset by emailed code.
- **Admin user table:** search, filter by role or status, add, edit, change role, enable or disable, reset password, delete. Passwords are bcrypt-hashed, so **nobody, admins included, can view an existing password**. An admin can only set a new one. Admins can't demote, disable or delete themselves.
- **Programs:** create, edit and delete; upload images to Cloudinary or paste image URLs; set status, deadline, event date and tags. On detail pages, phone numbers, emails and links are clickable, and there are Apply and Share buttons.

## Security

- Passwords hashed with bcrypt (cost 12); OTP codes hashed too, expire after 10 min, allow 5 attempts, have a 60 s resend cooldown, and can be used once.
- JWT in an `HttpOnly`, `Secure` (prod), `SameSite=Lax` cookie; tokens are invalidated after a password change or when the account is disabled.
- Sign-up always creates `role: user` (the request body can't set role).
- Rate limits on the whole API, plus stricter ones on login, OTP and chat; accounts lock for 15 min after 5 failed logins.
- Helmet headers, no `X-Powered-By`, CORS limited to an explicit allow-list (never reflects arbitrary origins).
- Input validation with Zod; invalid IDs return a clean 400/404; production errors never expose database internals.

## Local development

Requires Node 20+ (22 recommended).

```bash
npm install
npm run dev          # web on http://localhost:5173, API on http://localhost:4000 (proxied at /api)
```

Without `MONGODB_URI`, the dev server starts an **in-memory MongoDB** and seeds sample data plus two accounts:

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `admin12345` | admin |
| `student` | `student12345` | user |

These exist **only** in local dev with in-memory data. They are never created in production.

**OTP without SMTP:** if the `SMTP_*` variables aren't set, the code is printed in the API terminal (`[mail:dev] …`). Outside production, the sign-up form also shows it so you can test the flow end to end.

To use a real database locally, copy `.env.example` to `.env` and fill it in.

Other scripts:

```bash
npm run build        # type-check + production build
npm run lint         # oxlint
npm test             # API integration tests (in-memory MongoDB)
npm run seed:admin   # create/update an admin (see below)
npm run import:programs  # copy programs from the old API (see below)
```

## Deploying to Vercel

1. **MongoDB Atlas.** Create a cluster (the free M0 tier works) and a database user. Under *Network Access*, allow `0.0.0.0/0`, since Vercel uses dynamic IPs. Copy the connection string, e.g. `mongodb+srv://user:pass@cluster0.xxxx.mongodb.net/ogea`.
   - To keep your existing 19 programs, point `MONGODB_URI` at the **same database** the old API uses. The schema is compatible. Or run the import script (step 6).
2. **Gmail App Password** (for email codes). Turn on 2-Step Verification for `ogea.sms@gmail.com`, then create an App Password at https://myaccount.google.com/apppasswords.
3. **Import the repo.** In Vercel, click *Add New → Project* and pick this repo. Vercel detects **Vite** from `vercel.json`; leave the build settings at their defaults.
4. **Environment variables.** Add these under *Project → Settings → Environment Variables* (Production + Preview):

   | Name | Required | Value |
   | --- | --- | --- |
   | `MONGODB_URI` | yes | Atlas connection string |
   | `JWT_SECRET` | yes | random 64+ chars: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `SMTP_HOST` | for email OTP | `smtp.gmail.com` |
   | `SMTP_PORT` | for email OTP | `465` |
   | `SMTP_USER` | for email OTP | `ogea.sms@gmail.com` |
   | `SMTP_PASS` | for email OTP | the 16-char App Password |
   | `MAIL_FROM` | optional | `OGEA <ogea.sms@gmail.com>` |
   | `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | for uploads | from the Cloudinary dashboard (without these, admins paste image URLs) |
   | `CLOUDINARY_FOLDER` | optional | `ogea-api` |
   | `CORS_ORIGINS` | optional | only if another domain must call the API |

   > Without SMTP in production, sign-up codes only appear in *Vercel → Logs*. Set SMTP before you announce sign-ups.
5. **Deploy**, then open `https://<your-app>.vercel.app/api/v1/health`. It should return `{"status":"success","message":"OGEA API running"}`.
6. **Create the first admin** from your machine (once):
   ```bash
   MONGODB_URI="mongodb+srv://..." ADMIN_USERNAME=ashique ADMIN_PASSWORD='a-strong-password' ADMIN_EMAIL=ogea.sms@gmail.com npm run seed:admin
   ```
   Running it again resets that admin's password. To copy programs from the old API into a new database:
   ```bash
   MONGODB_URI="mongodb+srv://..." npm run import:programs
   ```
7. **Custom domain** (optional): *Project → Settings → Domains*. Nothing else needs to change, because the API is same-origin.

### How it runs on Vercel

- `vercel.json` builds the SPA into `dist/`, rewrites `/api/*` to the single serverless function `api/index.js` (the Express app), and serves `index.html` for all other paths (client-side routing).
- The Mongo connection is cached on `globalThis`, so warm function calls reuse it.
- Hashed assets are cached for a year (`immutable`), and security headers are added to every response.

## Adding SMS later

Phone sign-up is intentionally deferred. To add it, pick a provider (MSG91, Fast2SMS, Twilio), add a `sendOtpSms()` next to `sendOtpEmail()` in `server/utils/email.js`, and accept `phone` as an alternative to `email` in `server/routes/auth.js` and the `Otp`/`User` models.

## Project structure

```
api/index.js            Vercel function entry (exports the Express app)
server/
  app.js                Express app: security middleware, routes, errors
  config.js  db.js      env config, cached Mongo connection
  models/               User, Program, Otp, Conversation/Message
  routes/               auth, programs, admin, chat, upload
  middleware/           auth guards, Zod validation, rate limits, error handler
  utils/                email (OTP), JWT cookies, AppError
  scripts/              seed-admin, import-programs, dev-seed
  tests/                API integration tests (Vitest + Supertest)
  dev.js                local API server (in-memory Mongo fallback)
src/
  pages/                public pages + pages/admin/*
  components/           Navbar, Footer, ChatWidget, AuthPanel, ProgramCard, ui
  context/              Auth + UI (theme, chat, toasts)
  lib/                  API client, queries, types, utils
vercel.json             build, rewrites, headers
```
