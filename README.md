
# FutureSkilz

Greenfield FutureSkilz application built for the proven Eccellere Hostinger Cloud architecture.

## Runtime

- Next.js 16 App Router with standalone output
- Node.js 22 on Hostinger Cloud
- MariaDB/MySQL through a shared `mysql2` connection pool
- Drizzle ORM with reviewable SQL migrations
- Custom HMAC sessions and provider-neutral AI

## Local development

Use XAMPP MariaDB so local database behavior matches Hostinger production.

1. Start MariaDB in XAMPP.
2. Create a `futureskilz` database with `utf8mb4` encoding.
3. Create a local `futureskilz` MariaDB user with access only to that database. The defaults in `.env.example` use the local development password `futureskilz_local_dev`.
4. Copy `.env.example` to `.env.local`.
5. Run `npm ci`, `npm run db:migrate`, then `npm run dev`.

Open `http://localhost:3000`.

## Quality gate

Run `npm run check`. It runs ESLint, TypeScript, focused tests, and the production standalone build. Pull requests and this local check are the pre-production gate because the Hostinger plan has one Node.js slot and no staging environment.

## Database migrations

Run `npm run db:generate` after changing `src/server/db/schema/`. Apply checked-in migrations with `npm run db:migrate`.

Do not run migrations in the build command. Additive changes (new tables or columns) are applied by the site itself on first use, see "Accounts and saved progress" below. Anything that changes or removes existing data still needs reviewed SQL, a production backup and hPanel/phpMyAdmin before deploying dependent code.

## Hostinger Cloud deployment

The GitHub repository root must be this directory. Hostinger documentation does not confirm a project-root selector for nested applications.

| Setting | Value |
|---|---|
| Source | GitHub repository, branch `main` |
| Framework | Next.js |
| Node.js | 22.x |
| Build command | `npm run build` |
| Start command | `npm run start` |
| Output | `.next` (standalone enabled) |

Set production environment variables in hPanel, never in Git. Use `.env.example` as the key list and supply independent random values of at least 32 characters for `SESSION_SECRET` and `MAGIC_LINK_SECRET`.

Pushes to `main` trigger Hostinger rebuilds. To see which version is live, open `/api/health`: it reports `build.id` (the commit) and `build.builtAt`; if they are older than your last merge, the rebuild failed or has not run, so check the deployment log in hPanel. The lockfile must install with the npm that ships with Node 22 (`npm ci`), which CI checks. Use hPanel Restart for runtime-only restarts. Do not upload `.next` manually.

## Accounts and saved progress

Learners start as guests; their answers live in the browser until they save. "Keep this profile" (or `/sign-in`) emails a single-use sign-in link that expires in 15 minutes. The guest snapshot travels with the link, so progress is imported on whichever device opens it. Sessions last 90 days and renew silently.

- The link token sits in the URL fragment (`#token=`), which browsers never send to a server, and is posted once from `/auth/verify`.
- Rate limits: 3 links per email per 15 minutes, 10 requests per network per hour.
- Scores are stored once, as 0–5 levels in `learner_skills`; the 0–100 pillar scores are a display projection. Check-ins are re-checked on the server before any evidence is recorded.
- The site brings its own database up to date on first use (`src/server/db/ensure-schema.ts`, approved 2026-10-18): an empty database gets every migration in `drizzle/`; a database that already has tables only gets the columns listed in `src/server/db/schema-plan.ts` that are missing. A named lock (`GET_LOCK`) stops two processes from racing. Add every new additive column to that list; a test checks the list against the migration file.
- Catalog rows that learner data points to (Skill Graph, Skill Shots, the baseline assessment) are upserted on first use (`src/server/learning/catalog.ts`), because Hostinger has no shell for `npm run db:seed`.
- Every database connection runs in UTC (`src/lib/mysql.ts`). Drizzle reads and writes dates as UTC, so any other session time zone shifts expiry checks.
- JSON columns use `jsonColumn` from `src/server/db/schema/columns.ts`: MariaDB stores JSON as text, which Drizzle's own `json()` never parses back.

### Email in production

1. hPanel → Emails → create a mailbox such as `hello@futureskilz.in`.
2. Set `NOTIFICATION_PROVIDER=smtp`, `SMTP_USER` (the full address), `SMTP_PASSWORD`, `EMAIL_FROM` and `APP_URL=https://futureskilz.in` in hPanel's environment variables.

## Problem Solving (framework workspace)

`/problem-solving` is built from the Framework Workspace Builder kit (`D:\Cowork\Futureskilz\Framework_Workspace_Builder`, route B: a separate app). The engine (`src/lib/strategyModels/*`, `src/lib/strategy*.ts`, `src/components/strategy-hub/*`, `src/lib/templateKit/*`) is copied from the Eccellere Strategy Hub at commit `f9c3ab4`. Keep its file names so it can be compared with the original; changes are marked `FUTURESKILZ`.

- **One definition per method** (`src/lib/strategyModels/defs/<stage>.ts`) drives the form, the Excel template and reader, the AI prompts and validators, the results, the worked example and the diagram. A new method is a definition, a sample, a diagram, a line in `groups.ts`/`registry.ts` and its text in `src/lib/problemSolving/seed.ts`. `problemSolvingContent.test.ts` checks the quality bar.
- **Every saved tool belongs to one of the learner's problems** (`ws_cases`, `ws_fillins` with `case_id`); the server checks the problem is theirs on every request.
- **AI** is off unless `AI_PROVIDER` is `openai`, `xai` or `auto` and the matching key is set. Prompts are grounded in the problem's brief, the learner's profile and the earlier tools of the same problem. A cut-off reply is retried once and never saved.
- **Uploads**: a filled template is read on the server with the vendored SheetJS 0.20.3 (`vendor/`) after a structural check (`src/lib/templateKit/serverOpen.ts`). A PDF, Word or text file becomes text (`/api/self-service/upload`), and the AI fills only blank single answers.
- **Browser journey**: start `node e2e/fake-openai.cjs` (port from `FAKE_PORT`) and run the production server with `OPENAI_BASE_URL=http://127.0.0.1:<port>/v1`, `AI_PROVIDER=openai` and a dummy key; `npx tsx e2e/make-kit-fixtures.ts <folder>` makes a filled template and a PDF to upload. Never point the journey at a real AI key.

## Expert capture (contributors, interview, knowledge, lessons, earnings)

Built from the FutureSkilz Content Platform Specification and the Expert Knowledge-to-Learning skill. Pure rules live in `src/features/capture/` (no database or framework imports, fully unit-tested); persistence and workflow in `src/server/capture/`; the `kc_` tables in `src/server/db/schema/capture.ts` (migration `0003`, also created by the site's self-setup); screens under `/contribute` and `/lessons`.

- **Adaptive interview** (`planner.ts`, `question-bank.ts`): phases A–O are a question library, not a form. Follow-ups are chosen from what the answer lacks (example, steps, result, figures, tool), named measures and tools, and sensitive details (a click-through share / anonymise / private choice). The expert picks the job order and depth; uploads turn into "is this right?" confirmations instead of repeat questions. The full state is checkpointed after every turn, so a later session opens with a recap and the same saved question. Voice uses the browser's speech services (no WebSockets or server transcription on Hostinger); typing always works.
- **Transcript as evidence** (`kc_segments` is append-only): facts link to the exact segment and quote. A correction is a new segment; the original stays. Optional AI reading (only when `AI_PROVIDER` is configured) is validated: every claim needs a real segment, a verbatim quote and no number absent from the quote, or it is dropped. Only confirmed, cleared facts reach the approved package, `skill.md`, or lessons; anonymised facts use the contributor's own approved wording. Original upload bytes are not retained yet (text, page/sheet and checksum are): a durable storage provider is an open decision.
- **Learning and earnings together**: each lesson has `kc_lesson_attribution` (basis points adding to 10000) from creation; every start, minute, completion, material use and rating is stored append-only, idempotently, against a keyed learner hash. No revenue formula is built in: an admin approves a versioned policy (`/contribute/admin`); without one, statements are "illustrative" and cannot be finalised. Ratings may carry at most 30% of the weight and count only for learners who completed the lesson.
- **Roles**: contributors are created on first interview; grant `editor` or `admin` in `user_roles` for the editor desk (`/contribute/editor`) and earnings admin.
- **Tests**: `npm test` runs the rules. `npm run test:integration` (needs the MariaDB from `.env.local`) runs the whole flow, including resume, upload, review, approval, lessons, usage and statements.

## Members area and Problem Solving kit

Signed-in people land in `/learn` ("My learning"): **Skills** (journey, skills check), **Training kits** (the Problem Solving kit; more kits join this shelf) and **Coach lessons**. `/problem-solving` and its tools require sign-in (`requireMember`, which returns the person to the page they wanted after registering). The kit is self-contained (`src/app/problem-solving`, `src/lib/problemSolving`, `src/lib/strategyModels`, `src/lib/templateKit`, `src/components/strategy-hub`, the `ws_*` tables and `/api/problem-solving`), so it is meant to be **copied** into the separate eccellere.in and eccellere.co.in apps rather than shared.

## Public previews, accounts and passwords

- **Previews (no sign-in):** the home page and `/join` end with "This is what you get after you register": tabs for Learner, Coach, Editor and Admin that click through the real screens with sample data (`src/features/preview`). Nothing is saved.
- **Passwords (optional):** most people sign in with an emailed link. An admin can create real accounts with a role and a password at `/contribute/admin/users` (the password is shown once; only a salted scrypt hash is stored; five wrong guesses lock the account for 15 minutes). Passwords sign in at `/sign-in` or `/join` under "Email and password". Set `BOOTSTRAP_ADMIN_EMAILS` to the owner's address so the first admin exists: sign in once by emailed link and that address becomes an admin.
- **Seeded demo accounts (internal):** `/demo` is off unless `DEMO_ACCESS_CODE` is set. See `docs/demo-walkthrough.md`.

## Hostinger constraints

- Managed Web/Cloud provides MariaDB only; PostgreSQL and pgvector require VPS or an external provider.
- Incoming WebSockets are unavailable; use HTTP streaming or polling for Arya.
- npm commands run during Hostinger deployment, not through shared-hosting SSH.
- Do not use privileged SQL such as `SUPER`, `GRANT`, `DEFINER`, procedures, or triggers.
- Database changes must be backward-compatible and deployed in expand/migrate/contract order.
