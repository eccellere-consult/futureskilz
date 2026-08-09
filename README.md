
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

Do not run migrations in the build command. Review generated SQL, back up production, and apply approved SQL through hPanel/phpMyAdmin before deploying dependent code.

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

Pushes to `main` trigger Hostinger rebuilds. Use hPanel Restart for runtime-only restarts. Do not upload `.next` manually.

## Hostinger constraints

- Managed Web/Cloud provides MariaDB only; PostgreSQL and pgvector require VPS or an external provider.
- Incoming WebSockets are unavailable; use HTTP streaming or polling for Arya.
- npm commands run during Hostinger deployment, not through shared-hosting SSH.
- Do not use privileged SQL such as `SUPER`, `GRANT`, `DEFINER`, procedures, or triggers.
- Database changes must be backward-compatible and deployed in expand/migrate/contract order.
